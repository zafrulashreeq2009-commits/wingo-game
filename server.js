const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wingo_secret_key_2024_secure';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

// Database
const db = new Database('wingo.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance REAL DEFAULT 0.00,
    withdraw_count INTEGER DEFAULT 0,
    withdraw_date TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    period TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    bet_amount REAL NOT NULL,
    result_number INTEGER NOT NULL,
    result_type TEXT NOT NULL,
    won INTEGER DEFAULT 0,
    win_amount REAL DEFAULT 0,
    balance_after REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Login dulu.' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch(e) { return res.status(401).json({ error: 'Token tamat.' }); }
}

function adminAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Login admin dulu.' });
  try { const d = jwt.verify(h.split(' ')[1], JWT_SECRET); if(d.role!=='admin') throw 0; next(); }
  catch(e) { return res.status(401).json({ error: 'Akses ditolak.' }); }
}

function genId() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for(let i=0;i<8;i++) r+=c.charAt(Math.floor(Math.random()*c.length));
  return r;
}

function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

// ===== AUTH API =====
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  if(!phone||!password) return res.status(400).json({error:'Sila isi nombor & password.'});
  const p = phone.replace(/[^0-9]/g,'');
  if(p.length<9||p.length>12) return res.status(400).json({error:'Format nombor tak sah.'});
  if(password.length<4) return res.status(400).json({error:'Password min 4 aksara.'});
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(p);
  if(user) {
    if(!bcrypt.compareSync(password, user.password)) return res.status(401).json({error:'Password salah.'});
    const token = jwt.sign({player_id:user.player_id,phone:user.phone}, JWT_SECRET, {expiresIn:'7d'});
    return res.json({token,player_id:user.player_id,phone:user.phone,balance:user.balance,message:'Login berjaya!'});
  }
  const hash = bcrypt.hashSync(password,10);
  let pid; do { pid = genId(); } while(db.prepare('SELECT id FROM users WHERE player_id=?').get(pid));
  db.prepare('INSERT INTO users (player_id,phone,password,balance,withdraw_count,withdraw_date) VALUES (?,?,?,0,0,"")').run(pid,p,hash);
  const token = jwt.sign({player_id:pid,phone:p}, JWT_SECRET, {expiresIn:'7d'});
  res.status(201).json({token,player_id:pid,phone:p,balance:0,message:'Daftar berjaya! ID: '+pid});
});

app.get('/api/auth/me', auth, (req, res) => {
  const u = db.prepare('SELECT player_id,phone,balance,withdraw_count,withdraw_date FROM users WHERE player_id=?').get(req.user.player_id);
  if(!u) return res.status(404).json({error:'Tak jumpa.'});
  res.json(u);
});

// ===== GAME API =====
app.post('/api/game/bet', auth, (req, res) => {
  const { period, betType, betAmount } = req.body;
  if(!period||!betType||!betAmount) return res.status(400).json({error:'Data tak lengkap.'});
  if(betType!=='BIG'&&betType!=='SMALL') return res.status(400).json({error:'Jenis salah.'});
  const amt = parseFloat(betAmount);
  if(isNaN(amt)||amt<1) return res.status(400).json({error:'Min RM1.'});
  const u = db.prepare('SELECT * FROM users WHERE player_id=?').get(req.user.player_id);
  if(!u) return res.status(404).json({error:'Tak jumpa.'});
  if(amt>u.balance) return res.status(400).json({error:'Baki tak cukup.'});
  const rn = Math.floor(Math.random()*10);
  const rt = rn>=5?'BIG':'SMALL';
  const won = betType===rt;
  const wa = won?amt*1.96:0;
  const nb = won?(u.balance-amt+wa):(u.balance-amt);
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,req.user.player_id);
  db.prepare('INSERT INTO game_history (player_id,period,bet_type,bet_amount,result_number,result_type,won,win_amount,balance_after) VALUES (?,?,?,?,?,?,?,?,?)').run(req.user.player_id,period,betType,amt,rn,rt,won?1:0,wa,nb);
  res.json({success:true,resultNumber:rn,resultType:rt,won,winAmount:wa,newBalance:nb});
});

app.get('/api/game/history', auth, (req, res) => {
  const h = db.prepare('SELECT * FROM game_history WHERE player_id=? ORDER BY id DESC LIMIT 30').all(req.user.player_id);
  res.json(h);
});

app.post('/api/game/request-deposit', auth, (req, res) => {
  const amt = parseFloat(req.body.amount);
  if(isNaN(amt)||amt<20) return res.status(400).json({error:'Min RM20.'});
  res.json({success:true,telegramUrl:'https://t.me/moinsveit?text='+encodeURIComponent('NAK DEPOSIT RM '+amt.toFixed(2)+' ID:'+req.user.player_id)});
});

app.post('/api/game/request-withdraw', auth, (req, res) => {
  const amt = parseFloat(req.body.amount);
  if(isNaN(amt)||amt<30) return res.status(400).json({error:'Min RM30.'});
  const u = db.prepare('SELECT * FROM users WHERE player_id=?').get(req.user.player_id);
  const td = today();
  let wc = u.withdraw_count;
  if(u.withdraw_date!==td) wc=0;
  if(wc>=2) return res.status(400).json({error:'Had harian capai (2x sehari).'});
  if(amt>u.balance) return res.status(400).json({error:'Baki tak cukup.'});
  db.prepare('UPDATE users SET withdraw_count=?, withdraw_date=? WHERE player_id=?').run(wc+1,td,req.user.player_id);
  res.json({success:true,telegramUrl:'https://t.me/moinsveit?text='+encodeURIComponent('WITHDRAW RM '+amt.toFixed(2)+' ID:'+req.user.player_id+' Baki:RM '+u.balance.toFixed(2)),remainingWithdraws:2-(wc+1)});
});

app.get('/api/game/withdraw-info', auth, (req, res) => {
  const u = db.prepare('SELECT withdraw_count,withdraw_date FROM users WHERE player_id=?').get(req.user.player_id);
  const td = today();
  let wc = u.withdraw_count;
  if(u.withdraw_date!==td) wc=0;
  res.json({remaining:Math.max(0,2-wc),max:2,minAmount:30});
});

// ===== ADMIN API =====
app.post('/api/admin/login', (req, res) => {
  if(req.body.password===ADMIN_PASS) {
    const t = jwt.sign({role:'admin'}, JWT_SECRET, {expiresIn:'4h'});
    return res.json({success:true,token:t});
  }
  res.status(401).json({error:'Password salah.'});
});

app.get('/api/admin/players', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT player_id,phone,balance,withdraw_count,withdraw_date,created_at FROM users ORDER BY id DESC').all());
});

app.post('/api/admin/topup', adminAuth, (req, res) => {
  const {player_id,amount}=req.body;
  const a=parseFloat(amount);
  if(isNaN(a)||a<=0) return res.status(400).json({error:'Jumlah tak sah.'});
  const p=db.prepare('SELECT * FROM users WHERE player_id=?').get(player_id);
  if(!p) return res.status(404).json({error:'Player tak jumpa.'});
  const nb=p.balance+a;
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,player_id);
  res.json({success:true,newBalance:nb,message:'Topup RM'+a.toFixed(2)+' ke '+player_id});
});

app.post('/api/admin/deduct', adminAuth, (req, res) => {
  const {player_id,amount}=req.body;
  const a=parseFloat(amount);
  if(isNaN(a)||a<=0) return res.status(400).json({error:'Jumlah tak sah.'});
  const p=db.prepare('SELECT * FROM users WHERE player_id=?').get(player_id);
  if(!p) return res.status(404).json({error:'Player tak jumpa.'});
  if(a>p.balance) return res.status(400).json({error:'Melebihi baki.'});
  const nb=p.balance-a;
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,player_id);
  res.json({success:true,newBalance:nb,message:'Tolak RM'+a.toFixed(2)+' dari '+player_id});
});

app.post('/api/admin/reset-withdraw', adminAuth, (req, res) => {
  db.prepare('UPDATE users SET withdraw_count=0,withdraw_date="" WHERE player_id=?').run(req.body.player_id);
  res.json({success:true});
});

app.get('/api/admin/history/:pid', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM game_history WHERE player_id=? ORDER BY id DESC LIMIT 50').all(req.params.pid));
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const tp=db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const tb=db.prepare('SELECT SUM(balance) as t FROM users').get().t||0;
  res.json({totalPlayers:tp,totalBalance:tb});
});

// ===== SERVE FRONTEND =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('WINGO SERVER RUNNING ON PORT ' + PORT);
});