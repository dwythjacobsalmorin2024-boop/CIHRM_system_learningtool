require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('connect-mysql2')(session);
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./config/database');
const { requireAuth, allowRoles } = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  key: 'cihrm.sid',
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  store: new MySQLStore({}, pool),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, '../frontend')));

async function logAction(userId, action) {
  await pool.execute('INSERT INTO ACTIVITY_LOG (user_id, action) VALUES (?, ?)', [userId, action]);
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    const [rows] = await pool.execute(
      'SELECT user_id, full_name, email, password, role, department, year_level, is_active FROM USER WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
    }
    req.session.user = {
      user_id: user.user_id, full_name: user.full_name, email: user.email,
      role: user.role, department: user.department, year_level: user.year_level
    };
    await logAction(user.user_id, 'Logged in');
    res.json({ user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to sign in.' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try { await logAction(req.session.user.user_id, 'Logged out'); } catch (_) {}
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.session.user }));

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [[roomStats]] = await pool.query(`
      SELECT COUNT(*) totalRooms,
      SUM(occupancy_status='Available' AND housekeeping_status='Clean') availableRooms,
      SUM(occupancy_status='Occupied') occupiedRooms FROM ROOM`);
    const [[reservationStats]] = await pool.query(`
      SELECT COUNT(*) totalReservations,
      SUM(reservation_status='Pending') pendingReservations,
      SUM(reservation_status='Checked-in') checkedIn,
      SUM(reservation_status='Checked-out') checkedOut FROM RESERVATION`);
    const [[userStats]] = await pool.query(`
      SELECT COUNT(*) totalUsers,
      SUM(role='student') students, SUM(role='instructor') instructors FROM USER WHERE is_active=1`);
    const [recent] = await pool.query(`
      SELECT r.reservation_id, g.full_name guest_name, rm.room_number,
      r.check_in_date, r.check_out_date, r.reservation_status
      FROM RESERVATION r JOIN GUEST g ON g.guest_id=r.guest_id
      JOIN ROOM rm ON rm.room_id=r.room_id ORDER BY r.created_at DESC LIMIT 8`);
    res.json({ rooms: roomStats, reservations: reservationStats, users: userStats, recent, role: req.session.user.role });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Dashboard data could not be loaded.' }); }
});

app.get('/api/rooms', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM ROOM ORDER BY room_number');
  res.json(rows);
});
app.post('/api/rooms', allowRoles('admin'), async (req, res) => {
  try {
    const { room_number, room_type, floor, rate, max_occupancy } = req.body;
    if (!room_number || !room_type || !(Number(rate) >= 0) || !(Number(max_occupancy) > 0)) return res.status(400).json({ message: 'Complete all required room fields.' });
    const id = `RM-${Date.now()}`;
    await pool.execute('INSERT INTO ROOM (room_id, room_number, room_type, floor, rate, max_occupancy) VALUES (?,?,?,?,?,?)',
      [id, room_number, room_type, Number(floor || 1), Number(rate), Number(max_occupancy)]);
    await logAction(req.session.user.user_id, `Created room ${room_number}`);
    res.status(201).json({ message: 'Room created.' });
  } catch (e) { res.status(400).json({ message: e.code === 'ER_DUP_ENTRY' ? 'Room number already exists.' : 'Could not create room.' }); }
});
app.put('/api/rooms/:id', allowRoles('admin'), async (req, res) => {
  const { room_type, floor, rate, max_occupancy, housekeeping_status, occupancy_status } = req.body;
  await pool.execute(`UPDATE ROOM SET room_type=?, floor=?, rate=?, max_occupancy=?,
    housekeeping_status=?, occupancy_status=? WHERE room_id=?`,
    [room_type, Number(floor), Number(rate), Number(max_occupancy), housekeeping_status, occupancy_status, req.params.id]);
  await logAction(req.session.user.user_id, `Updated room ${req.params.id}`);
  res.json({ message: 'Room updated.' });
});
app.delete('/api/rooms/:id', allowRoles('admin'), async (req, res) => {
  try {
    await pool.execute('DELETE FROM ROOM WHERE room_id=?', [req.params.id]);
    await logAction(req.session.user.user_id, `Deleted room ${req.params.id}`);
    res.json({ message: 'Room deleted.' });
  } catch (_) { res.status(409).json({ message: 'Room cannot be deleted because it is linked to a reservation.' }); }
});

app.get('/api/guests', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM GUEST ORDER BY full_name');
  res.json(rows);
});
app.post('/api/guests', requireAuth, async (req, res) => {
  try {
    const { full_name, email, phone, address, id_type, preferences } = req.body;
    if (!full_name || !phone) return res.status(400).json({ message: 'Guest name and phone are required.' });
    await pool.execute(`INSERT INTO GUEST (guest_id, full_name, email, phone, address, id_type, preferences)
      VALUES (?,?,?,?,?,?,?)`,
      [`G-${Date.now()}`, full_name, email || null, phone, address || null, id_type || null, preferences || null]);
    await logAction(req.session.user.user_id, `Registered guest ${full_name}`);
    res.status(201).json({ message: 'Guest registered.' });
  } catch (e) { res.status(400).json({ message: 'Could not register guest. Check the details.' }); }
});
app.put('/api/guests/:id', requireAuth, async (req, res) => {
  const { full_name, email, phone, address, id_type, preferences } = req.body;
  await pool.execute(`UPDATE GUEST SET full_name=?, email=?, phone=?, address=?, id_type=?, preferences=? WHERE guest_id=?`,
    [full_name, email || null, phone, address || null, id_type || null, preferences || null, req.params.id]);
  await logAction(req.session.user.user_id, `Updated guest ${req.params.id}`);
  res.json({ message: 'Guest updated.' });
});

app.get('/api/reservations', requireAuth, async (req, res) => {
  const [rows] = await pool.query(`SELECT r.*, g.full_name guest_name, rm.room_number, rm.room_type
    FROM RESERVATION r JOIN GUEST g ON g.guest_id=r.guest_id
    JOIN ROOM rm ON rm.room_id=r.room_id ORDER BY r.created_at DESC`);
  res.json(rows);
});
app.post('/api/reservations', requireAuth, async (req, res) => {
  const { guest_id, room_id, booking_type, check_in_date, check_out_date, pax } = req.body;
  if (!guest_id || !room_id || !check_in_date || !check_out_date || !pax) return res.status(400).json({ message: 'Complete all reservation fields.' });
  if (new Date(check_out_date) <= new Date(check_in_date)) return res.status(400).json({ message: 'Check-out must be after check-in.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rooms] = await conn.execute('SELECT * FROM ROOM WHERE room_id=? FOR UPDATE', [room_id]);
    const room = rooms[0];
    if (!room) throw new Error('Room not found.');
    if (room.housekeeping_status !== 'Clean' || Number(room.max_occupancy) < Number(pax)) throw new Error('Room is not clean or guest count exceeds room capacity.');
    const [overlap] = await conn.execute(`SELECT reservation_id FROM RESERVATION
      WHERE room_id=? AND reservation_status IN ('Pending','Confirmed','Checked-in')
      AND check_in_date < ? AND check_out_date > ? FOR UPDATE`,
      [room_id, check_out_date, check_in_date]);
    if (overlap.length) throw new Error('This room is already reserved for overlapping dates.');
    const nights = Math.ceil((new Date(check_out_date) - new Date(check_in_date)) / 86400000);
    const reservationId = `RS-${Date.now()}`;
    await conn.execute(`INSERT INTO RESERVATION
      (reservation_id, guest_id, room_id, user_id, booking_type, check_in_date, check_out_date, number_of_nights, pax, reservation_status)
      VALUES (?,?,?,?,?,?,?,?,?,'Confirmed')`,
      [reservationId, guest_id, room_id, req.session.user.user_id, booking_type || 'Advance', check_in_date, check_out_date, nights, Number(pax)]);
    await conn.commit();
    await logAction(req.session.user.user_id, `Created reservation ${reservationId}`);
    res.status(201).json({ message: 'Reservation confirmed.', reservation_id: reservationId });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ message: e.message || 'Reservation could not be created.' });
  } finally { conn.release(); }
});

app.get('/api/activity', requireAuth, async (req, res) => {
  const [rows] = await pool.query(`SELECT a.*, u.full_name FROM ACTIVITY_LOG a
    JOIN USER u ON u.user_id=a.user_id ORDER BY a.timestamp DESC LIMIT 100`);
  res.json(rows);
});

app.get('/api/admin/users', allowRoles('admin'), async (req, res) => {
  const [rows] = await pool.query('SELECT user_id,full_name,email,role,department,year_level,is_active,created_at FROM USER ORDER BY created_at DESC');
  res.json(rows);
});
app.post('/api/admin/users', allowRoles('admin'), async (req, res) => {
  try {
    const { full_name, email, password, role, department, year_level } = req.body;
    if (!full_name || !email || !password || !['student','instructor','admin'].includes(role)) return res.status(400).json({ message: 'Provide name, email, password and a valid role.' });
    const hash = await bcrypt.hash(password, 12);
    await pool.execute(`INSERT INTO USER (user_id,full_name,email,password,role,department,year_level)
      VALUES (?,?,?,?,?,?,?)`, [`U-${Date.now()}`, full_name, email.toLowerCase(), hash, role, department || null, year_level || null]);
    await logAction(req.session.user.user_id, `Created ${role} account ${email}`);
    res.status(201).json({ message: 'Account created.' });
  } catch (_) { res.status(400).json({ message: 'Could not create account. Email may already exist.' }); }
});

app.get('/api/scenarios', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM SCENARIO ORDER BY scenario_id');
  res.json(rows);
});
app.get('/api/assessments', requireAuth, async (req, res) => {
  let sql = `SELECT a.*, u.full_name student_name, s.title scenario_title
    FROM STUDENT_ASSESSMENT a JOIN USER u ON u.user_id=a.user_id
    JOIN SCENARIO s ON s.scenario_id=a.scenario_id`;
  const params = [];
  if (req.session.user.role === 'student') { sql += ' WHERE a.user_id=?'; params.push(req.session.user.user_id); }
  sql += ' ORDER BY a.completed_at DESC';
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`C.I.H.R.M. running at http://localhost:${port}`));
