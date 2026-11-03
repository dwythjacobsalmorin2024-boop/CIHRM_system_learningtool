const $ = (s) => document.querySelector(s);
let currentUser = null;
const navByRole = {
  student: [['Dashboard','▦'],['Room Availability','▣'],['Guest Management','♙'],['Reservations','▤'],['Check-in / Check-out','⇄'],['Billing and Folio','₱'],['Housekeeping','✧'],['Learning Scenarios','◇'],['Assessments','✓'],['My Learning Progress','◷'],['Activity History','≡'],['My Profile','◎']],
  instructor: [['Dashboard','▦'],['Student Management','♙'],['Learning Scenarios','◇'],['Assessment Management','✓'],['Student Submissions','▤'],['Performance Monitoring','◷'],['Activity Logs','≡'],['Reports','▧'],['My Profile','◎']],
  admin: [['Dashboard','▦'],['User Management','♙'],['Room Management','▣'],['Guest Management','♧'],['Reservation Management','▤'],['Housekeeping','✧'],['System Settings','⚙'],['Activity Logs','≡'],['Reports','▧'],['My Profile','◎']]
};
const api = async (url, options={}) => {
  const res = await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message||'Request failed');
  return data;
};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function showApp(user){
  currentUser=user;$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');
  $('#topName').textContent=user.full_name;$('#topRole').textContent=user.role;$('#avatar').textContent=user.full_name[0].toUpperCase();
  $('#sideUser').textContent=`${user.full_name} · ${user.role}`;
  $('#navigation').innerHTML=navByRole[user.role].map(([n,i])=>`<button class="nav-link" data-page="${n}"><span>${i}</span><span>${n}</span></button>`).join('');
  $('#navigation').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)renderPage(b.dataset.page)});
  renderPage('Dashboard');
}
function showLogin(){currentUser=null;$('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden')}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email:$('#email').value,password:$('#password').value})});showApp(d.user)}catch(err){$('#loginError').textContent=err.message}});
$('#togglePassword').onclick=()=>{const p=$('#password');p.type=p.type==='password'?'text':'password';$('#togglePassword').textContent=p.type==='password'?'Show':'Hide'};
$('#logoutBtn').onclick=async()=>{try{await api('/auth/logout',{method:'POST'})}finally{showLogin()}};
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
async function renderPage(page){
  $('#pageHeading').textContent=page;
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#sidebar').classList.remove('open');
  const content=$('#content');content.innerHTML='<div class="panel empty">Loading workspace…</div>';
  try{
    if(page==='Dashboard') return await dashboard();
    if(page.includes('Room')) return await rooms(page);
    if(page.includes('Guest')) return await guests();
    if(page.includes('Reservation')) return await reservations();
    if(page.includes('Activity')||page==='Reports') return await activity(page);
    if(page.includes('Scenario')) return await scenarios();
    if(page.includes('Assessment')||page.includes('Submission')||page.includes('Performance')) return await assessments();
    if(page==='User Management') return await users();
    if(page==='My Profile') return profile();
    content.innerHTML=`<div class="welcome"><div><span class="eyebrow">TRAINING WORKSPACE</span><h2>${page}</h2><p>This module is part of the C.I.H.R.M. learning workflow.</p></div></div><div class="panel"><h3>${page}</h3><p class="role-note">The database structure and navigation are prepared for this module. Its complete operational workflow is scheduled for the next implementation part. This starter build does not simulate a completed operation.</p></div>`;
  }catch(err){content.innerHTML=`<div class="panel"><p class="error">${err.message}</p></div>`}
}
async function dashboard(){
 const d=await api('/dashboard');
 const isAdmin=currentUser.role==='admin',isInst=currentUser.role==='instructor';
 const stats=isAdmin?[['Total Users',d.users.totalUsers],['Students',d.users.students],['Instructors',d.users.instructors],['Total Rooms',d.rooms.totalRooms],['Available Rooms',d.rooms.availableRooms||0],['Occupied Rooms',d.rooms.occupiedRooms||0],['Reservations',d.reservations.totalReservations],['Pending Reservations',d.reservations.pendingReservations||0]]:
 isInst?[['Total Students',d.users.students],['Learning Scenarios', (await api('/scenarios')).length],['Assessments', (await api('/assessments')).length],['Active Rooms',d.rooms.availableRooms||0]]:
 [['Total Reservations',d.reservations.totalReservations],['Available Rooms',d.rooms.availableRooms||0],['Occupied Rooms',d.rooms.occupiedRooms||0],['Pending Reservations',d.reservations.pendingReservations||0],['Completed Check-ins',d.reservations.checkedIn||0],['Completed Check-outs',d.reservations.checkedOut||0]];
 $('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">OVERVIEW / ${currentUser.role.toUpperCase()}</span><h2>Good day, ${currentUser.full_name.split(' ')[0]}.</h2><p>Here is your hotel operations learning overview.</p></div><span class="pill">● Training environment</span></div><div class="stats">${stats.map(([l,v])=>`<div class="stat"><span class="label">${l}</span><strong>${v??0}</strong><small>Live database data</small></div>`).join('')}</div><div class="grid-two"><div class="panel"><div class="panel-head"><div><h3>Recent reservations</h3><p>Latest reservation activity</p></div><span class="pill">Updated live</span></div>${reservationTable(d.recent)}</div><div class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Common front-desk tasks</p></div></div><div class="quick-grid"><button class="quick" onclick="renderPage('Guest Management')">＋ Register guest<span>Create a guest profile</span></button><button class="quick" onclick="renderPage('Reservations')">▤ New reservation<span>Book an available room</span></button><button class="quick" onclick="renderPage('Room Availability')">▣ View rooms<span>Check room readiness</span></button><button class="quick" onclick="renderPage('Learning Scenarios')">◇ Practice scenario<span>Build hospitality skills</span></button></div></div></div>`;
}
function reservationTable(rows){if(!rows.length)return '<div class="empty">No reservations recorded yet.</div>';return `<div class="table-wrap"><table><thead><tr><th>Guest</th><th>Room</th><th>Stay</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.guest_name)}</td><td>${esc(r.room_number)}</td><td>${String(r.check_in_date).slice(0,10)} – ${String(r.check_out_date).slice(0,10)}</td><td><span class="status ${statusClass(r.reservation_status)}">${r.reservation_status}</span></td></tr>`).join('')}</tbody></table></div>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function statusClass(s){return String(s||'').toLowerCase().replace(/[^a-z]/g,'')}
async function rooms(page){
 const data=await api('/rooms');const canEdit=currentUser.role==='admin';
 $('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">ROOM INVENTORY</span><h2>${page}</h2><p>Room readiness and occupancy overview.</p></div>${canEdit?'<button class="btn primary" id="addRoom">＋ Add room</button>':''}</div><div class="panel"><div class="toolbar"><input id="roomSearch" placeholder="Search room number or type…"><select id="roomFilter"><option value="">All housekeeping statuses</option><option>Clean</option><option>Dirty</option><option>Cleaning</option><option>Maintenance</option></select></div><div id="roomTable"></div></div>`;
 const draw=()=>{const q=$('#roomSearch').value.toLowerCase(),f=$('#roomFilter').value;const list=data.filter(r=>(r.room_number+r.room_type).toLowerCase().includes(q)&&(!f||r.housekeeping_status===f));$('#roomTable').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Room</th><th>Type</th><th>Floor</th><th>Rate / night</th><th>Capacity</th><th>Housekeeping</th><th>Occupancy</th>${canEdit?'<th>Action</th>':''}</tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.room_number)}</b></td><td>${esc(r.room_type)}</td><td>${r.floor}</td><td>₱${Number(r.rate).toLocaleString()}</td><td>${r.max_occupancy}</td><td>${esc(r.housekeeping_status)}</td><td><span class="status ${statusClass(r.occupancy_status)}">${r.occupancy_status}</span></td>${canEdit?`<td><button class="btn secondary" onclick="editRoom('${r.room_id}')">Edit</button></td>`:''}</tr>`).join('')}</tbody></table></div>`||'<div class="empty">No rooms found.</div>'};
 $('#roomSearch').oninput=draw;$('#roomFilter').onchange=draw;draw();
 if(canEdit)$('#addRoom').onclick=()=>roomForm();
 window.editRoom=id=>{const r=data.find(x=>x.room_id===id);roomForm(r)};
}
function roomForm(r={}){const modal=prompt(r.room_id?'Edit housekeeping status (Clean, Dirty, Cleaning, Maintenance):':'Enter room number, room type, floor, rate, max occupancy separated by commas:',r.room_id?r.housekeeping_status:'');if(modal===null)return;if(r.room_id){const status=modal.trim();api('/rooms/'+r.room_id,{method:'PUT',body:JSON.stringify({...r,housekeeping_status:status})}).then(x=>{toast(x.message);renderPage('Room Management')}).catch(e=>toast(e.message))}else{const [room_number,room_type,floor,rate,max_occupancy]=modal.split(',').map(x=>x.trim());api('/rooms',{method:'POST',body:JSON.stringify({room_number,room_type,floor,rate,max_occupancy})}).then(x=>{toast(x.message);renderPage('Room Management')}).catch(e=>toast(e.message))}}
async function guests(){
 const rows=await api('/guests');
 $('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">GUEST RELATIONS</span><h2>Guest Management</h2><p>Maintain guest profiles for reservation practice.</p></div><button class="btn primary" id="newGuest">＋ Register guest</button></div><div class="panel"><div class="toolbar"><input id="guestSearch" placeholder="Search guest name or phone…"></div><div id="guestTable"></div></div>`;
 const draw=()=>{const q=$('#guestSearch').value.toLowerCase(),list=rows.filter(g=>(g.full_name+g.phone).toLowerCase().includes(q));$('#guestTable').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Guest name</th><th>Email</th><th>Phone</th><th>Address</th><th>ID type</th></tr></thead><tbody>${list.map(g=>`<tr><td><b>${esc(g.full_name)}</b></td><td>${esc(g.email||'—')}</td><td>${esc(g.phone)}</td><td>${esc(g.address||'—')}</td><td>${esc(g.id_type||'—')}</td></tr>`).join('')}</tbody></table></div>`};
 $('#guestSearch').oninput=draw;draw();
 $('#newGuest').onclick=async()=>{const full_name=prompt('Guest full name:');if(!full_name)return;const phone=prompt('Phone number:');if(!phone)return;const email=prompt('Email (optional):')||'';const address=prompt('Address (optional):')||'';try{const d=await api('/guests',{method:'POST',body:JSON.stringify({full_name,phone,email,address})});toast(d.message);renderPage('Guest Management')}catch(e){toast(e.message)}};
}
async function reservations(){
 const [rows,guestsList,roomsList]=await Promise.all([api('/reservations'),api('/guests'),api('/rooms')]);
 $('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">FRONT DESK</span><h2>Reservation Management</h2><p>Create walk-in or advance reservations with date conflict checking.</p></div><button class="btn primary" id="newReservation">＋ New reservation</button></div><div class="panel">${reservationTable(rows)}</div>`;
 $('#newReservation').onclick=async()=>{
  const guestOptions=guestsList.map(g=>`${g.guest_id} — ${g.full_name}`).join('\n');const guest_id=prompt('Enter guest ID:\n'+guestOptions);if(!guest_id)return;
  const roomOptions=roomsList.filter(r=>r.housekeeping_status==='Clean').map(r=>`${r.room_id} — Room ${r.room_number} (${r.room_type})`).join('\n');const room_id=prompt('Enter room ID:\n'+roomOptions);if(!room_id)return;
  const check_in_date=prompt('Check-in date (YYYY-MM-DD):');if(!check_in_date)return;const check_out_date=prompt('Check-out date (YYYY-MM-DD):');if(!check_out_date)return;
  const pax=prompt('Number of guests:','1');if(!pax)return;const booking_type=prompt('Booking type: Walk-in or Advance','Advance')||'Advance';
  try{const d=await api('/reservations',{method:'POST',body:JSON.stringify({guest_id,room_id,check_in_date,check_out_date,pax,booking_type})});toast(d.message);renderPage('Reservations')}catch(e){toast(e.message)}
 };
}
async function activity(page){const rows=await api('/activity');$('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">AUDIT TRAIL</span><h2>${page}</h2><p>Recorded actions performed in the training system.</p></div></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>User</th><th>Action</th><th>Timestamp</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.full_name)}</td><td>${esc(r.action)}</td><td>${esc(r.timestamp)}</td></tr>`).join('')}</tbody></table></div></div>`}
async function scenarios(){const rows=await api('/scenarios');$('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">EXPERIENTIAL LEARNING</span><h2>Learning Scenarios</h2><p>Practice common hotel front-desk situations.</p></div></div><div class="stats">${rows.map(s=>`<div class="stat"><span class="label">${esc(s.difficulty)} · ${s.target_points} points</span><strong style="font-size:18px">${esc(s.title)}</strong><small>${esc(s.learning_objectives||'Practical hotel operations')}</small></div>`).join('')}</div>`}
async function assessments(){const rows=await api('/assessments');$('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">STUDENT DEVELOPMENT</span><h2>Assessments & Submissions</h2><p>Assessment records visible according to your account role.</p></div></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Scenario</th><th>Score</th><th>Status</th><th>Completed</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(a.student_name)}</td><td>${esc(a.scenario_title)}</td><td>${a.score??'—'}</td><td>${esc(a.submission_status)}</td><td>${esc(a.completed_at||'—')}</td></tr>`).join('')}</tbody></table></div></div>`}
async function users(){const rows=await api('/admin/users');$('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">ACCESS CONTROL</span><h2>User Management</h2><p>Administrator-only account directory.</p></div><button class="btn primary" id="addUser">＋ Create account</button></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${esc(u.department||'—')}</td><td>${u.is_active?'Active':'Inactive'}</td></tr>`).join('')}</tbody></table></div></div>`;$('#addUser').onclick=async()=>{const full_name=prompt('Full name:');if(!full_name)return;const email=prompt('Email:');if(!email)return;const password=prompt('Temporary password (at least 8 characters):');if(!password)return;const role=prompt('Role: student, instructor, or admin','student');try{const d=await api('/admin/users',{method:'POST',body:JSON.stringify({full_name,email,password,role})});toast(d.message);renderPage('User Management')}catch(e){toast(e.message)}}}
function profile(){$('#content').innerHTML=`<div class="welcome"><div><span class="eyebrow">ACCOUNT</span><h2>My Profile</h2><p>Your signed-in training account.</p></div></div><div class="panel"><h3>${esc(currentUser.full_name)}</h3><p class="role-note">${esc(currentUser.email)}<br>Role: ${esc(currentUser.role)}<br>Department: ${esc(currentUser.department||'Not specified')}<br>Year level: ${esc(currentUser.year_level||'Not specified')}</p></div>`}
(async()=>{try{const d=await api('/auth/me');showApp(d.user)}catch(_){showLogin()}})();
