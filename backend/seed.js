require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./config/database');

(async () => {
  const accounts = [
    ['U-ADMIN-001','System Administrator','admin@cihrm.local','admin'],
    ['U-INST-001','Demo Instructor','instructor@cihrm.local','instructor'],
    ['U-STUD-001','Demo Student','student@cihrm.local','student']
  ];
  const hash = await bcrypt.hash('Password123!', 12);
  for (const [id, name, email, role] of accounts) {
    await pool.execute(`INSERT INTO USER (user_id,full_name,email,password,role,department,year_level)
      VALUES (?,?,?,?,?,'Hospitality Management','3rd Year')
      ON DUPLICATE KEY UPDATE email=VALUES(email)`,
      [id,name,email,hash,role]);
  }
  console.log('Demo accounts ready. Password for all: Password123!');
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
