const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");

app.use(express.json());
app.use(express.static("public"));

const DB_FILE = "./db.json";

// ===== helper DB =====
function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ===== LOGIN / CREATE USER ID =====
app.post("/api/login", (req, res) => {
    let db = readDB();

    const userId = "USR" + Math.floor(Math.random() * 999999);
    const user = {
        id: userId,
        balance: 0,
        createdAt: new Date()
    };

    db.users.push(user);
    writeDB(db);

    res.json(user);
});

// ===== GET USER =====
app.get("/api/user/:id", (req, res) => {
    let db = readDB();
    const user = db.users.find(u => u.id === req.params.id);
    res.json(user || null);
});

// ===== TOPUP (ADMIN ONLY DEMO) =====
app.post("/api/topup", (req, res) => {
    let db = readDB();
    const { id, amount } = req.body;

    let user = db.users.find(u => u.id === id);
    if (!user) return res.json({ error: "User not found" });

    user.balance += Number(amount);
    writeDB(db);

    res.json({ success: true, balance: user.balance });
});

// ===== WITHDRAW (DEDUCT BALANCE DEMO) =====
app.post("/api/withdraw", (req, res) => {
    let db = readDB();
    const { id, amount } = req.body;

    let user = db.users.find(u => u.id === id);
    if (!user) return res.json({ error: "User not found" });

    if (user.balance < amount) {
        return res.json({ error: "Not enough balance" });
    }

    user.balance -= Number(amount);
    writeDB(db);

    res.json({ success: true, balance: user.balance });
});

// ===== ADMIN ADD ADS =====
app.post("/api/ads", (req, res) => {
    let db = readDB();
    db.ads.push(req.body);
    writeDB(db);
    res.json({ success: true });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for(let i=0;i<8;i++) r+=c.charAt(Math.floor(Math.random()*c.length));
  return r;
}

function now() {
  const n = new Date();
  return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}

// LOGIN / DAFTAR
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  if(!phone||!password) return res.status(400).json({e:'Sila isi nombor & password.'});
  const p = phone.replace(/[^0-9]/g,'');
  if(p.length<9||p.length>12) return res.status(400).json({e:'Format nombor tak sah.'});
  if(password.length<4) return res.status(400).json({e:'Password min 4 aksara.'});
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(p);
  if(user) {
    if(!bcrypt.compareSync(password, user.password)) return res.status(401).json({e:'Password salah.'});
    const token = jwt.sign({pid:user.player_id,phone:user.phone}, JWT_SECRET, {expiresIn:'30d'});
    return res.json({ok:true,token,pid:user.player_id,phone:user.phone,balance:user.balance||0,msg:'Login berjaya!'});
  }
  const hash = bcrypt.hashSync(password,10);
  let pid; do { pid = genId(); } while(db.prepare('SELECT id FROM users WHERE player_id=?').get(pid));
  db.prepare('INSERT INTO users (player_id,phone,password,balance,withdraw_count,withdraw_date) VALUES (?,?,?,0,0,"")').run(pid,p,hash);
  const token = jwt.sign({pid:pid,phone:p}, JWT_SECRET, {expiresIn:'30d'});
  res.status(201).json({ok:true,token,pid:pid,phone:p,balance:0,msg:'Daftar berjaya! ID: '+pid});
});

// GET PROFILE
app.get('/api/me', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE player_id=?').get(req.user.pid);
  if(!u) return res.status(404).json({e:'Tak jumpa.'});
  res.json({pid:u.player_id,phone:u.phone,balance:u.balance||0,wd_count:u.withdraw_count||0,wd_date:u.withdraw_date||''});
});

// BET
app.post('/api/bet', auth, (req, res) => {
  const { period, type, amount } = req.body;
  if(!period||!type||!amount) return res.status(400).json({e:'Data tak lengkap.'});
  if(type!=='BIG'&&type!=='SMALL') return res.status(400).json({e:'Jenis salah.'});
  const amt = parseFloat(amount);
  if(isNaN(amt)||amt<1) return res.status(400).json({e:'Min RM1.'});
  const u = db.prepare('SELECT * FROM users WHERE player_id=?').get(req.user.pid);
  if(!u) return res.status(404).json({e:'Tak jumpa.'});
  const bal = u.balance||0;
  if(amt>bal) return res.status(400).json({e:'Baki tak cukup.'});
  const rn = Math.floor(Math.random()*10);
  const rt = rn>=5?'BIG':'SMALL';
  const won = type===rt;
  const wa = won?amt*1.96:0;
  const nb = won?(bal-amt+wa):(bal-amt);
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,req.user.pid);
  db.prepare('INSERT INTO history (player_id,period,bet_type,bet_amount,result_number,result_type,won,win_amount,balance_after) VALUES (?,?,?,?,?,?,?,?,?)').run(req.user.pid,period,type,amt,rn,rt,won?1:0,wa,nb);
  res.json({ok:true,rn,rt,won,wa,nb});
});

// HISTORY
app.get('/api/history', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM history WHERE player_id=? ORDER BY id DESC LIMIT 30').all(req.user.pid));
});

// DEPOSIT
app.post('/api/deposit', auth, (req, res) => {
  const amt = parseFloat(req.body.amount);
  if(isNaN(amt)||amt<20) return res.status(400).json({e:'Min RM20.'});
  res.json({ok:true,url:'https://t.me/moinsveit?text='+encodeURIComponent('NAK DEPOSIT RM '+amt.toFixed(2)+' ID:'+req.user.pid)});
});

// WITHDRAW
app.post('/api/withdraw', auth, (req, res) => {
  const amt = parseFloat(req.body.amount);
  if(isNaN(amt)||amt<30) return res.status(400).json({e:'Min RM30.'});
  const u = db.prepare('SELECT * FROM users WHERE player_id=?').get(req.user.pid);
  if(!u) return res.status(404).json({e:'Tak jumpa.'});
  const bal = u.balance||0;
  const td = now();
  let wc = u.withdraw_count||0;
  if((u.withdraw_date||'')!==td) wc=0;
  if(wc>=2) return res.status(400).json({e:'Had harian capai (2x).'});
  if(amt>bal) return res.status(400).json({e:'Baki tak cukup.'});
  db.prepare('UPDATE users SET withdraw_count=?, withdraw_date=? WHERE player_id=?').run(wc+1,td,req.user.pid);
  res.json({ok:true,url:'https://t.me/moinsveit?text='+encodeURIComponent('WITHDRAW RM '+amt.toFixed(2)+' ID:'+req.user.pid+' Baki:RM '+bal.toFixed(2)),rem:2-(wc+1)});
});

// WD INFO
app.get('/api/wdinfo', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE player_id=?').get(req.user.pid);
  if(!u) return res.status(404).json({e:'Tak jumpa.'});
  const td = now();
  let wc = u.withdraw_count||0;
  if((u.withdraw_date||'')!==td) wc=0;
  res.json({rem:Math.max(0,2-wc),max:2,min:30});
});

// ADMIN LOGIN
app.post('/api/admin/login', (req, res) => {
  if(req.body.password===ADMIN_PASS) {
    const t = jwt.sign({role:'admin'}, JWT_SECRET, {expiresIn:'12h'});
    return res.json({ok:true,token:t});
  }
  res.status(401).json({e:'Password admin salah.'});
});

// ADMIN PLAYERS
app.get('/api/admin/players', adminAuth, (req, res) => {
  const list = db.prepare('SELECT player_id,phone,balance,withdraw_count FROM users ORDER BY id DESC').all();
  res.json(list.map(p=>({...p,balance:p.balance||0,withdraw_count:p.withdraw_count||0})));
});

// ADMIN TOPUP
app.post('/api/admin/topup', adminAuth, (req, res) => {
  const {pid,amount}=req.body;
  const a=parseFloat(amount);
  if(isNaN(a)||a<=0) return res.status(400).json({e:'Jumlah tak sah.'});
  const p=db.prepare('SELECT * FROM users WHERE player_id=?').get(pid);
  if(!p) return res.status(404).json({e:'Player tak jumpa.'});
  const nb=(p.balance||0)+a;
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,pid);
  res.json({ok:true,msg:'Topup RM'+a.toFixed(2)+' ke '+pid+' berjaya!',nb});
});

// ADMIN DEDUCT
app.post('/api/admin/deduct', adminAuth, (req, res) => {
  const {pid,amount}=req.body;
  const a=parseFloat(amount);
  if(isNaN(a)||a<=0) return res.status(400).json({e:'Jumlah tak sah.'});
  const p=db.prepare('SELECT * FROM users WHERE player_id=?').get(pid);
  if(!p) return res.status(404).json({e:'Player tak jumpa.'});
  const bal=p.balance||0;
  if(a>bal) return res.status(400).json({e:'Melebihi baki.'});
  const nb=bal-a;
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,pid);
  res.json({ok:true,msg:'Tolak RM'+a.toFixed(2)+' dari '+pid+' berjaya!',nb});
});

// ADMIN RESET WD
app.post('/api/admin/resetwd', adminAuth, (req, res) => {
  db.prepare('UPDATE users SET withdraw_count=0,withdraw_date="" WHERE player_id=?').run(req.body.pid);
  res.json({ok:true,msg:'Had withdraw '+req.body.pid+' direset!'});
});

// ADMIN STATS
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const tp=db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const tb=db.prepare('SELECT SUM(balance) as t FROM users').get().t||0;
  res.json({tp,tb:tb||0});
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('WINGO PORT '+PORT));  }
  res.status(401).json({error:'Password admin salah.'});
});

app.get('/api/admin/players', adminAuth, (req, res) => {
  const players = db.prepare('SELECT player_id,phone,balance,withdraw_count,withdraw_date FROM users ORDER BY id DESC').all();
  const result = players.map(p=>({...p,balance:p.balance||0,withdraw_count:p.withdraw_count||0}));
  res.json(result);
});

app.post('/api/admin/topup', adminAuth, (req, res) => {
  const {player_id,amount}=req.body;
  const a=parseFloat(amount);
  if(isNaN(a)||a<=0) return res.status(400).json({error:'Jumlah tak sah.'});
  const p=getUser(player_id);
  if(!p) return res.status(404).json({error:'Player ID tak jumpa.'});
  const nb=(p.balance||0)+a;
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,player_id);
  res.json({success:true,newBalance:nb,message:'Topup RM'+a.toFixed(2)+' ke '+player_id+' berjaya!'});
});

app.post('/api/admin/deduct', adminAuth, (req, res) => {
  const {player_id,amount}=req.body;
  const a=parseFloat(amount);
  if(isNaN(a)||a<=0) return res.status(400).json({error:'Jumlah tak sah.'});
  const p=getUser(player_id);
  if(!p) return res.status(404).json({error:'Player ID tak jumpa.'});
  const pBal=p.balance||0;
  if(a>pBal) return res.status(400).json({error:'Melebihi baki player.'});
  const nb=pBal-a;
  db.prepare('UPDATE users SET balance=? WHERE player_id=?').run(nb,player_id);
  res.json({success:true,newBalance:nb,message:'Tolak RM'+a.toFixed(2)+' dari '+player_id+' berjaya!'});
});

app.post('/api/admin/reset-withdraw', adminAuth, (req, res) => {
  const p=getUser(req.body.player_id);
  if(!p) return res.status(404).json({error:'Player ID tak jumpa.'});
  db.prepare('UPDATE users SET withdraw_count=0,withdraw_date="" WHERE player_id=?').run(req.body.player_id);
  res.json({success:true,message:'Had withdraw '+req.body.player_id+' direset!'});
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const tp=db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const tb=db.prepare('SELECT SUM(balance) as t FROM users').get().t||0;
  res.json({totalPlayers:tp,totalBalance:tb||0});
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('WINGO RUNNING PORT '+PORT));
