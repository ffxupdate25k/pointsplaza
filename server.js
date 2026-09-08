const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret-in-production";
const dbDir = path.join(__dirname, "data");
fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

const db = new Database(path.join(dbDir, "points-plaza.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL UNIQUE,
 full_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 task_balance INTEGER NOT NULL DEFAULT 0,
 referral_balance INTEGER NOT NULL DEFAULT 0,
 referral_code TEXT NOT NULL UNIQUE,
 referred_by INTEGER,
 is_admin INTEGER NOT NULL DEFAULT 0,
 is_banned INTEGER NOT NULL DEFAULT 0,
 ip_address TEXT,
 device_info TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(referred_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 instructions TEXT NOT NULL,
 link TEXT NOT NULL,
 reward INTEGER NOT NULL,
 submission_limit INTEGER NOT NULL,
 proof_type TEXT NOT NULL CHECK(proof_type IN ('screenshot','text')),
 display_order INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS task_submissions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 proof_type TEXT NOT NULL,
 proof_text TEXT,
 screenshot_url TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,
 reviewed_by INTEGER,
 UNIQUE(task_id,user_id),
 FOREIGN KEY(task_id) REFERENCES tasks(id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(reviewed_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS referrals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 referrer_id INTEGER NOT NULL,
 referred_user_id INTEGER NOT NULL UNIQUE,
 reward INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(referrer_id) REFERENCES users(id),
 FOREIGN KEY(referred_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS milestones (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 referral_requirement INTEGER NOT NULL,
 reward INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS milestone_claims (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 milestone_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 reward INTEGER NOT NULL,
 claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(milestone_id,user_id),
 FOREIGN KEY(milestone_id) REFERENCES milestones(id),
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS withdrawals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 wallet_type TEXT NOT NULL CHECK(wallet_type IN ('task','referral')),
 pts_amount INTEGER NOT NULL,
 conversion_rate REAL NOT NULL,
 ngn_amount REAL NOT NULL,
 bank_name TEXT NOT NULL,
 account_name TEXT NOT NULL,
 account_number TEXT NOT NULL,
 completed_tasks INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,
 reviewed_by INTEGER,
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(reviewed_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 type TEXT NOT NULL,
 wallet TEXT NOT NULL,
 amount INTEGER NOT NULL,
 description TEXT NOT NULL,
 reference TEXT NOT NULL,
 balance_after INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 read INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 admin_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 target TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(admin_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS bank_details (
 user_id INTEGER PRIMARY KEY,
 bank_name TEXT NOT NULL,
 account_name TEXT NOT NULL,
 account_number TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const defaults = {
 referral_reward: "50",
 task_withdrawal_enabled: "1",
 task_min: "1000",
 task_max: "10000",
 referral_withdrawal_enabled: "1",
 referral_min: "500",
 referral_max: "20000",
 required_tasks: "10",
 pts_per_ngn: "1",
 whatsapp: "https://wa.me/",
 telegram: "https://t.me/"
};
const setDefault = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaults)) setDefault.run(k,v);

function setting(k) { return db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value; }
function now() { return new Date().toISOString(); }
function ip(req) { return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
function tokenFor(user) { return jwt.sign({ id:user.id }, JWT_SECRET, { expiresIn:"7d" }); }
function publicUser(u) {
  return { id:u.id, username:u.username, email:u.email, full_name:u.full_name,
    task_balance:u.task_balance, referral_balance:u.referral_balance, is_admin:!!u.is_admin,
    is_banned:!!u.is_banned, created_at:u.created_at, referral_code:u.referral_code };
}
function auth(req,res,next) {
  try {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) throw new Error();
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(p.id);
    if (!u) return res.status(401).json({error:"Session expired."});
    if (u.is_banned) return res.status(403).json({error:"Your account is banned."});
    req.user = u;
    next();
  } catch { res.status(401).json({error:"Authentication required."}); }
}
function admin(req,res,next) {
  if (!req.user?.is_admin) return res.status(403).json({error:"Administrator access required."});
  next();
}
function addTx(userId,type,wallet,amount,description,reference,balanceAfter) {
  db.prepare(`INSERT INTO transactions(user_id,type,wallet,amount,description,reference,balance_after)
              VALUES(?,?,?,?,?,?,?)`).run(userId,type,wallet,amount,description,reference,balanceAfter);
}
function notify(userId,title,message) {
  db.prepare("INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)").run(userId,title,message);
}
function audit(adminId,action,target) {
  db.prepare("INSERT INTO admin_logs(admin_id,action,target) VALUES(?,?,?)").run(adminId,action,target);
}

const upload = multer({
  dest: path.join(__dirname,"uploads"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_,file,cb) => cb(null, /^image\/(png|jpe?g|webp)$/i.test(file.mimetype))
});

app.post("/api/register", (req,res) => {
  try {
    const {username,email,fullName,password,confirmPassword,ref} = req.body;
    if (!username || !email || !fullName || !password || password !== confirmPassword)
      return res.status(400).json({error:"Please complete all fields and make sure passwords match."});
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"Invalid email address."});
    if (password.length < 8) return res.status(400).json({error:"Password must be at least 8 characters."});
    const exists = db.prepare("SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)").get(username,email);
    if (exists) return res.status(409).json({error:"Username or email already exists."});
    const refUser = ref ? db.prepare("SELECT * FROM users WHERE username=? OR referral_code=?").get(ref,ref) : null;
    const code = username.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,18) + "-" + Math.random().toString(36).slice(2,7);
    const hash = bcrypt.hashSync(password, 12);
    const tx = db.transaction(() => {
      const result = db.prepare(`INSERT INTO users(username,email,full_name,password_hash,referral_code,referred_by,ip_address,device_info)
        VALUES(?,?,?,?,?,?,?,?)`).run(username,email,fullName,hash,code,refUser?.id || null,ip(req),req.headers["user-agent"] || "");
      const id = result.lastInsertRowid;
      if (refUser && refUser.id !== id) {
        const reward = Number(setting("referral_reward"));
        const refNow = db.prepare("SELECT referral_balance FROM users WHERE id=?").get(refUser.id).referral_balance + reward;
        db.prepare("UPDATE users SET referral_balance=?,updated_at=? WHERE id=?").run(refNow,now(),refUser.id);
        db.prepare("INSERT INTO referrals(referrer_id,referred_user_id,reward) VALUES(?,?,?)").run(refUser.id,id,reward);
        addTx(refUser.id,"referral","referral",reward,"Referral reward",`referral:${id}`,refNow);
        notify(refUser.id,"Referral reward received",`You earned ${reward} PTS for a new referral.`);
      }
      return db.prepare("SELECT * FROM users WHERE id=?").get(id);
    });
    const user = tx();
    res.json({token:tokenFor(user),user:publicUser(user)});
  } catch(e) { res.status(500).json({error:"Registration failed. Please try again."}); }
});

app.post("/api/login",(req,res)=>{
  const {identifier,password}=req.body;
  const u=db.prepare("SELECT * FROM users WHERE lower(email)=lower(?) OR lower(username)=lower(?)").get(identifier||"",identifier||"");
  if (!u || !bcrypt.compareSync(password||"",u.password_hash)) return res.status(401).json({error:"Invalid login details."});
  if (u.is_banned) return res.status(403).json({error:"Your account is banned."});
  res.json({token:tokenFor(u),user:publicUser(u)});
});

app.get("/api/me",auth,(req,res)=>res.json({user:publicUser(req.user)}));

app.get("/api/dashboard",auth,(req,res)=>{
  const completed=db.prepare("SELECT COUNT(*) c FROM task_submissions WHERE user_id=? AND status='approved'").get(req.user.id).c;
  const total=db.prepare("SELECT COUNT(*) c FROM tasks WHERE active=1").get().c;
  const referrals=db.prepare("SELECT COUNT(*) c FROM referrals WHERE referrer_id=?").get(req.user.id).c;
  const milestones=db.prepare("SELECT * FROM milestones WHERE active=1 ORDER BY referral_requirement").all();
  const claimed=new Set(db.prepare("SELECT milestone_id FROM milestone_claims WHERE user_id=?").all(req.user.id).map(x=>x.milestone_id));
  res.json({
    user:publicUser(req.user), completedTasks:completed, availableTasks:total, referrals,
    taskProgressTarget:Math.max(total,1),
    milestones:milestones.map(m=>({...m,claimed:claimed.has(m.id),eligible:referrals>=m.referral_requirement}))
  });
});

app.get("/api/tasks",auth,(req,res)=>{
  const tasks=db.prepare(`SELECT t.*, 
    (SELECT COUNT(*) FROM task_submissions s WHERE s.task_id=t.id AND s.status='approved') approved,
    (SELECT COUNT(*) FROM task_submissions s WHERE s.task_id=t.id AND s.status='pending') pending,
    (SELECT status FROM task_submissions s WHERE s.task_id=t.id AND s.user_id=? LIMIT 1) my_status
    FROM tasks t WHERE t.active=1 ORDER BY t.display_order,t.id`).all(req.user.id);
  res.json({tasks});
});

app.post("/api/tasks/:id/submit",auth,upload.single("screenshot"),(req,res)=>{
  try {
    const task=db.prepare("SELECT * FROM tasks WHERE id=? AND active=1").get(req.params.id);
    if (!task) return res.status(404).json({error:"Task not available."});
    const approved=db.prepare("SELECT COUNT(*) c FROM task_submissions WHERE task_id=? AND status='approved'").get(task.id).c;
    if (approved>=task.submission_limit) return res.status(400).json({error:"Task is full."});
    const old=db.prepare("SELECT * FROM task_submissions WHERE task_id=? AND user_id=?").get(task.id,req.user.id);
    if (old) return res.status(409).json({error:"You have already submitted this task."});
    if (task.proof_type==="screenshot" && !req.file) return res.status(400).json({error:"Please upload a screenshot."});
    if (task.proof_type==="text" && !req.body.proofText) return res.status(400).json({error:"Please enter the required proof."});
    const url=req.file ? `/uploads/${path.basename(req.file.path)}` : null;
    db.prepare(`INSERT INTO task_submissions(task_id,user_id,proof_type,proof_text,screenshot_url)
      VALUES(?,?,?,?,?)`).run(task.id,req.user.id,task.proof_type,req.body.proofText||null,url);
    notify(req.user.id,"Proof submitted",`Your proof for ${task.name} is waiting for review.`);
    res.json({message:"Proof submitted successfully. Waiting for review."});
  } catch { res.status(500).json({error:"Task submission failed. Please try again."}); }
});

app.post("/api/milestones/:id/claim",auth,(req,res)=>{
  try {
    const m=db.prepare("SELECT * FROM milestones WHERE id=? AND active=1").get(req.params.id);
    if (!m) return res.status(404).json({error:"Milestone not found."});
    const count=db.prepare("SELECT COUNT(*) c FROM referrals WHERE referrer_id=?").get(req.user.id).c;
    if (count<m.referral_requirement) return res.status(400).json({error:"Milestone is not unlocked yet."});
    const tx=db.transaction(()=>{
      if (db.prepare("SELECT id FROM milestone_claims WHERE milestone_id=? AND user_id=?").get(m.id,req.user.id))
        throw new Error("ALREADY");
      const bal=db.prepare("SELECT referral_balance FROM users WHERE id=?").get(req.user.id).referral_balance + m.reward;
      db.prepare("UPDATE users SET referral_balance=?,updated_at=? WHERE id=?").run(bal,now(),req.user.id);
      db.prepare("INSERT INTO milestone_claims(milestone_id,user_id,reward) VALUES(?,?,?)").run(m.id,req.user.id,m.reward);
      addTx(req.user.id,"milestone","referral",m.reward,"Milestone bonus",`milestone:${m.id}`,bal);
      notify(req.user.id,"Milestone bonus claimed",`You received ${m.reward} PTS.`);
    });
    tx(); res.json({message:"Bonus claimed."});
  } catch(e) { res.status(e.message==="ALREADY"?409:500).json({error:e.message==="ALREADY"?"Milestone already claimed.":"Could not claim milestone."}); }
});

app.get("/api/team",auth,(req,res)=>{
  const list=db.prepare(`SELECT u.username,u.created_at,u.is_banned,r.reward
    FROM referrals r JOIN users u ON u.id=r.referred_user_id WHERE r.referrer_id=? ORDER BY r.created_at DESC`).all(req.user.id);
  res.json({referralLink:`${req.protocol}://${req.get("host")}/register.html?ref=${encodeURIComponent(req.user.referral_code)}`, referrals:list});
});

app.get("/api/settings/public",auth,(req,res)=>res.json({
  whatsapp:setting("whatsapp"),telegram:setting("telegram"),
  taskEnabled:setting("task_withdrawal_enabled")==="1", referralEnabled:setting("referral_withdrawal_enabled")==="1",
  taskMin:Number(setting("task_min")),taskMax:Number(setting("task_max")),
  referralMin:Number(setting("referral_min")),referralMax:Number(setting("referral_max")),
  requiredTasks:Number(setting("required_tasks")),rate:Number(setting("pts_per_ngn"))
}));

app.get("/api/bank",auth,(req,res)=>res.json({bank:db.prepare("SELECT * FROM bank_details WHERE user_id=?").get(req.user.id)||null}));
app.put("/api/bank",auth,(req,res)=>{
  const {bankName,accountName,accountNumber}=req.body;
  if(!bankName||!accountName||!/^\d{6,20}$/.test(accountNumber||"")) return res.status(400).json({error:"Enter valid bank details."});
  db.prepare(`INSERT INTO bank_details(user_id,bank_name,account_name,account_number) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET bank_name=excluded.bank_name,account_name=excluded.account_name,account_number=excluded.account_number,updated_at=CURRENT_TIMESTAMP`)
    .run(req.user.id,bankName,accountName,accountNumber);
  res.json({message:"Bank details saved."});
});

app.post("/api/withdrawals",auth,(req,res)=>{
  try {
    const {walletType,ptsAmount}=req.body;
    const s=db.prepare("SELECT * FROM bank_details WHERE user_id=?").get(req.user.id);
    if(!s) return res.status(400).json({error:"Save your bank details first."});
    const amount=Math.floor(Number(ptsAmount));
    if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:"Invalid withdrawal amount."});
    const enabled=walletType==="task" ? setting("task_withdrawal_enabled")==="1" : setting("referral_withdrawal_enabled")==="1";
    const min=Number(walletType==="task"?setting("task_min"):setting("referral_min"));
    const max=Number(walletType==="task"?setting("task_max"):setting("referral_max"));
    if(!enabled) return res.status(400).json({error:"Withdrawals are currently unavailable."});
    if(amount<min) return res.status(400).json({error:`Minimum withdrawal is ${min} PTS.`});
    if(amount>max) return res.status(400).json({error:`Maximum withdrawal is ${max} PTS.`});
    const completed=db.prepare("SELECT COUNT(*) c FROM task_submissions WHERE user_id=? AND status='approved'").get(req.user.id).c;
    const required=Number(setting("required_tasks"));
    if(completed<required) return res.status(400).json({error:`You must complete ${required-completed} more tasks before withdrawing.`});
    const u=db.prepare("SELECT task_balance,referral_balance FROM users WHERE id=?").get(req.user.id);
    const balance=walletType==="task"?u.task_balance:u.referral_balance;
    if(balance<amount) return res.status(400).json({error:"Insufficient balance."});
    const rate=Number(setting("pts_per_ngn"));
    db.prepare(`INSERT INTO withdrawals(user_id,wallet_type,pts_amount,conversion_rate,ngn_amount,bank_name,account_name,account_number,completed_tasks)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(req.user.id,walletType,amount,rate,amount*rate,s.bank_name,s.account_name,s.account_number,completed);
    notify(req.user.id,"Withdrawal submitted",`Your ${amount} PTS withdrawal is pending review.`);
    res.json({message:"Withdrawal request submitted."});
  } catch { res.status(500).json({error:"Could not create withdrawal."}); }
});

app.get("/api/withdrawals",auth,(req,res)=>res.json({withdrawals:db.prepare("SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC").all(req.user.id)}));
app.get("/api/transactions",auth,(req,res)=>res.json({transactions:db.prepare("SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 200").all(req.user.id)}));
app.get("/api/notifications",auth,(req,res)=>res.json({notifications:db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50").all(req.user.id)}));
app.post("/api/notifications/read",auth,(req,res)=>{db.prepare("UPDATE notifications SET read=1 WHERE user_id=?").run(req.user.id);res.json({ok:true});});

app.put("/api/password",auth,(req,res)=>{
  const {currentPassword,newPassword,confirmPassword}=req.body;
  if(!bcrypt.compareSync(currentPassword||"",req.user.password_hash)) return res.status(400).json({error:"Current password is incorrect."});
  if(!newPassword || newPassword.length<8 || newPassword!==confirmPassword) return res.status(400).json({error:"New passwords must match and be at least 8 characters."});
  db.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").run(bcrypt.hashSync(newPassword,12),now(),req.user.id);
  res.json({message:"Password changed successfully."});
});

/* Admin */
app.get("/api/admin/overview",auth,admin,(req,res)=>{
  const q=t=>db.prepare(t).get().c||0;
  res.json({
    totalUsers:q("SELECT COUNT(*) c FROM users"),activeUsers:q("SELECT COUNT(*) c FROM users WHERE is_banned=0"),
    bannedUsers:q("SELECT COUNT(*) c FROM users WHERE is_banned=1"),totalTasks:q("SELECT COUNT(*) c FROM tasks"),
    pendingSubmissions:q("SELECT COUNT(*) c FROM task_submissions WHERE status='pending'"),
    pendingWithdrawals:q("SELECT COUNT(*) c FROM withdrawals WHERE status='pending'"),
    totalPts:q("SELECT COALESCE(SUM(amount),0) c FROM transactions WHERE amount>0"),
    suspicious:q("SELECT COUNT(*) c FROM (SELECT ip_address FROM users WHERE ip_address IS NOT NULL AND ip_address!='' GROUP BY ip_address HAVING COUNT(*)>1)")
  });
});
app.get("/api/admin/users",auth,admin,(req,res)=>{
  const term=(req.query.search||"").trim();
  const users=term
    ? db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id=u.id) referrals,
       (SELECT COUNT(*) FROM task_submissions s WHERE s.user_id=u.id AND s.status='approved') completed_tasks
       FROM users u WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ? ORDER BY id DESC LIMIT 200`).all(`%${term}%`,`%${term}%`,`%${term}%`)
    : db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id=u.id) referrals,
       (SELECT COUNT(*) FROM task_submissions s WHERE s.user_id=u.id AND s.status='approved') completed_tasks
       FROM users u ORDER BY id DESC LIMIT 200`).all();
  res.json({users});
});
app.get("/api/admin/users/:id",auth,admin,(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if(!u)return res.status(404).json({error:"User not found."});
  res.json({
    user:u, referrals:db.prepare(`SELECT u.username,u.email,r.reward,r.created_at FROM referrals r JOIN users u ON u.id=r.referred_user_id WHERE r.referrer_id=?`).all(u.id),
    submissions:db.prepare(`SELECT s.*,t.name,t.reward FROM task_submissions s JOIN tasks t ON t.id=s.task_id WHERE s.user_id=? ORDER BY s.submitted_at DESC`).all(u.id),
    withdrawals:db.prepare("SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC").all(u.id),
    transactions:db.prepare("SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC").all(u.id)
  });
});
app.post("/api/admin/users/:id/adjust",auth,admin,(req,res)=>{
  const {wallet,amount,reason}=req.body; const n=Math.floor(Number(amount));
  if(!["task","referral"].includes(wallet)||!Number.isFinite(n)||n===0)return res.status(400).json({error:"Invalid balance adjustment."});
  const tx=db.transaction(()=>{
    const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id); if(!u)throw new Error("User not found");
    const col=wallet==="task"?"task_balance":"referral_balance"; const after=u[col]+n; if(after<0)throw new Error("Balance cannot become negative.");
    db.prepare(`UPDATE users SET ${col}=?,updated_at=? WHERE id=?`).run(after,now(),u.id);
    addTx(u.id,"admin_adjustment",wallet,n,reason||"Admin balance adjustment",`admin:${req.user.id}:${Date.now()}`,after);
    notify(u.id,"Balance updated",`${n>0?"+":""}${n} PTS was applied to your ${wallet} balance.`);
    audit(req.user.id,n>0?"Admin added PTS":"Admin removed PTS",`user:${u.username}`);
  }); try{tx();res.json({message:"Balance updated."})}catch(e){res.status(400).json({error:e.message})}
});
app.post("/api/admin/users/:id/status",auth,admin,(req,res)=>{
  const {banned}=req.body; db.prepare("UPDATE users SET is_banned=?,updated_at=? WHERE id=?").run(banned?1:0,now(),req.params.id);
  audit(req.user.id,banned?"Banned user":"Unbanned user",`user:${req.params.id}`); res.json({message:"Account status updated."});
});
app.post("/api/admin/users/:id/admin",auth,admin,(req,res)=>{
  db.prepare("UPDATE users SET is_admin=?,updated_at=? WHERE id=?").run(req.body.isAdmin?1:0,now(),req.params.id);
  audit(req.user.id,req.body.isAdmin?"Made admin":"Removed admin",`user:${req.params.id}`);res.json({message:"Admin status updated."});
});

app.get("/api/admin/tasks",auth,admin,(req,res)=>res.json({tasks:db.prepare(`SELECT t.*,
 (SELECT COUNT(*) FROM task_submissions s WHERE s.task_id=t.id AND s.status='approved') approved,
 (SELECT COUNT(*) FROM task_submissions s WHERE s.task_id=t.id AND s.status='pending') pending
 FROM tasks t ORDER BY display_order,id`).all()}));
app.post("/api/admin/tasks",auth,admin,(req,res)=>{
  const {name,instructions,link,reward,submissionLimit,proofType,active}=req.body;
  if(!name||!instructions||!link||!Number(reward)||!Number(submissionLimit)||!["screenshot","text"].includes(proofType))return res.status(400).json({error:"Complete all task fields."});
  const max=db.prepare("SELECT COALESCE(MAX(display_order),0) m FROM tasks").get().m;
  const r=db.prepare(`INSERT INTO tasks(name,instructions,link,reward,submission_limit,proof_type,display_order,active) VALUES(?,?,?,?,?,?,?,?)`)
    .run(name,instructions,link,Number(reward),Number(submissionLimit),proofType,max+1,active?1:0);
  audit(req.user.id,"Created task",`task:${r.lastInsertRowid}`);res.json({message:"Task created."});
});
app.put("/api/admin/tasks/:id",auth,admin,(req,res)=>{
  const {name,instructions,link,reward,submissionLimit,proofType,active}=req.body;
  db.prepare(`UPDATE tasks SET name=?,instructions=?,link=?,reward=?,submission_limit=?,proof_type=?,active=?,updated_at=? WHERE id=?`)
    .run(name,instructions,link,Number(reward),Number(submissionLimit),proofType,active?1:0,now(),req.params.id);
  audit(req.user.id,"Edited task",`task:${req.params.id}`);res.json({message:"Task updated."});
});
app.delete("/api/admin/tasks/:id",auth,admin,(req,res)=>{
  db.prepare("UPDATE tasks SET active=0,updated_at=? WHERE id=?").run(now(),req.params.id);
  audit(req.user.id,"Disabled task",`task:${req.params.id}`);res.json({message:"Task disabled."});
});
app.post("/api/admin/tasks/:id/move",auth,admin,(req,res)=>{
  const task=db.prepare("SELECT * FROM tasks WHERE id=?").get(req.params.id);
  const dir=req.body.direction==="up"?-1:1;
  const other=db.prepare(`SELECT * FROM tasks WHERE display_order ${dir<0?"<":" >"} ? ORDER BY display_order ${dir<0?"DESC":"ASC"} LIMIT 1`).get(task.display_order);
  if(other){
    const tx=db.transaction(()=>{db.prepare("UPDATE tasks SET display_order=? WHERE id=?").run(other.display_order,task.id);db.prepare("UPDATE tasks SET display_order=? WHERE id=?").run(task.display_order,other.id)});
    tx();
  } res.json({message:"Order updated."});
});

app.get("/api/admin/submissions",auth,admin,(req,res)=>{
  const status=req.query.status;
  const where=status&&status!=="all"?"WHERE s.status=?":"";
  const rows=status&&status!=="all"
    ? db.prepare(`SELECT s.*,u.username,u.email,t.name,t.reward FROM task_submissions s JOIN users u ON u.id=s.user_id JOIN tasks t ON t.id=s.task_id ${where} ORDER BY s.submitted_at DESC`).all(status)
    : db.prepare(`SELECT s.*,u.username,u.email,t.name,t.reward FROM task_submissions s JOIN users u ON u.id=s.user_id JOIN tasks t ON t.id=s.task_id ORDER BY s.submitted_at DESC`).all();
  res.json({submissions:rows});
});
function approveSubmission(id,adminId){
  const tx=db.transaction(()=>{
    const s=db.prepare("SELECT s.*,t.reward,t.name,t.submission_limit FROM task_submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=?").get(id);
    if(!s || s.status!=="pending") throw new Error("Already reviewed.");
    const approved=db.prepare("SELECT COUNT(*) c FROM task_submissions WHERE task_id=? AND status='approved'").get(s.task_id).c;
    if(approved>=s.submission_limit) throw new Error("Task is already full.");
    const u=db.prepare("SELECT task_balance FROM users WHERE id=?").get(s.user_id);
    const after=u.task_balance+s.reward;
    db.prepare("UPDATE task_submissions SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=?").run(now(),adminId,id);
    db.prepare("UPDATE users SET task_balance=?,updated_at=? WHERE id=?").run(after,now(),s.user_id);
    addTx(s.user_id,"task_reward","task",s.reward,`Task reward — ${s.name}`,`submission:${id}`,after);
    notify(s.user_id,"Task approved",`+${s.reward} PTS — ${s.name}`);
    audit(adminId,"Approved task submission",`submission:${id}`);
  }); tx();
}
app.post("/api/admin/submissions/:id/review",auth,admin,(req,res)=>{
  try {
    const s=db.prepare("SELECT * FROM task_submissions WHERE id=?").get(req.params.id);
    if(!s||s.status!=="pending")return res.status(409).json({error:"Submission already reviewed."});
    if(req.body.action==="approve")approveSubmission(req.params.id,req.user.id);
    else {
      db.prepare("UPDATE task_submissions SET status='declined',reviewed_at=?,reviewed_by=? WHERE id=?").run(now(),req.user.id,req.params.id);
      notify(s.user_id,"Task declined","Your task proof was declined.");
      audit(req.user.id,"Declined task submission",`submission:${req.params.id}`);
    }
    res.json({message:"Submission reviewed."});
  }catch(e){res.status(400).json({error:e.message||"Review failed."})}
});
app.post("/api/admin/submissions/approve-all",auth,admin,(req,res)=>{
  const ids=db.prepare("SELECT id FROM task_submissions WHERE status='pending' ORDER BY id").all().map(x=>x.id);
  let approved=0; for(const id of ids){try{approveSubmission(id,req.user.id);approved++}catch{}}
  res.json({message:`Approved ${approved} valid pending submissions.`});
});

app.get("/api/admin/withdrawals",auth,admin,(req,res)=>{
  const status=req.query.status;
  const sql=status&&status!=="all"
    ? `SELECT w.*,u.username,u.email FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.status=? ORDER BY w.created_at DESC`
    : `SELECT w.*,u.username,u.email FROM withdrawals w JOIN users u ON u.id=w.user_id ORDER BY w.created_at DESC`;
  res.json({withdrawals:(status&&status!=="all"?db.prepare(sql).all(status):db.prepare(sql).all())});
});
app.post("/api/admin/withdrawals/:id/review",auth,admin,(req,res)=>{
  try {
    const tx=db.transaction(()=>{
      const w=db.prepare("SELECT * FROM withdrawals WHERE id=?").get(req.params.id);
      if(!w||w.status!=="pending")throw new Error("Withdrawal already reviewed.");
      if(req.body.action==="decline"){
        db.prepare("UPDATE withdrawals SET status='declined',reviewed_at=?,reviewed_by=? WHERE id=?").run(now(),req.user.id,w.id);
        notify(w.user_id,"Withdrawal declined","Your withdrawal request was declined.");
        audit(req.user.id,"Declined withdrawal",`withdrawal:${w.id}`);return;
      }
      const u=db.prepare("SELECT * FROM users WHERE id=?").get(w.user_id);
      const col=w.wallet_type==="task"?"task_balance":"referral_balance";
      if(u[col]<w.pts_amount)throw new Error("Insufficient balance at approval time.");
      const after=u[col]-w.pts_amount;
      db.prepare(`UPDATE users SET ${col}=?,updated_at=? WHERE id=?`).run(after,now(),u.id);
      db.prepare("UPDATE withdrawals SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=?").run(now(),req.user.id,w.id);
      addTx(u.id,"withdrawal",w.wallet_type,-w.pts_amount,`Withdrawal — ₦${w.ngn_amount}`,`withdrawal:${w.id}`,after);
      notify(u.id,"Withdrawal approved",`Your withdrawal of ${w.pts_amount} PTS was approved.`);
      audit(req.user.id,"Approved withdrawal",`withdrawal:${w.id}`);
    });tx();res.json({message:"Withdrawal reviewed."});
  }catch(e){res.status(400).json({error:e.message||"Review failed."})}
});

app.get("/api/admin/settings",auth,admin,(req,res)=>res.json({settings:Object.fromEntries(Object.keys(defaults).map(k=>[k,setting(k)]))}));
app.put("/api/admin/settings",auth,admin,(req,res)=>{
  const allowed=Object.keys(defaults);
  const tx=db.transaction(()=>{for(const k of allowed)if(req.body[k]!==undefined)db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k,String(req.body[k]));});
  tx();audit(req.user.id,"Changed platform settings","settings");res.json({message:"Settings saved."});
});
app.get("/api/admin/milestones",auth,admin,(req,res)=>res.json({milestones:db.prepare("SELECT * FROM milestones ORDER BY referral_requirement").all()}));
app.post("/api/admin/milestones",auth,admin,(req,res)=>{
  const a=Number(req.body.referralRequirement),b=Number(req.body.reward);
  if(a<=0||b<=0)return res.status(400).json({error:"Invalid milestone."});
  db.prepare("INSERT INTO milestones(referral_requirement,reward,active) VALUES(?,?,1)").run(a,b);
  audit(req.user.id,"Created milestone",`${a} referrals`);res.json({message:"Milestone created."});
});
app.delete("/api/admin/milestones/:id",auth,admin,(req,res)=>{db.prepare("UPDATE milestones SET active=0 WHERE id=?").run(req.params.id);audit(req.user.id,"Disabled milestone",`milestone:${req.params.id}`);res.json({message:"Milestone disabled."})});
app.get("/api/admin/logs",auth,admin,(req,res)=>res.json({logs:db.prepare(`SELECT l.*,u.username FROM admin_logs l JOIN users u ON u.id=l.admin_id ORDER BY l.created_at DESC LIMIT 200`).all()}));

/* Seed admin and sample content */
const adminEmail="azeemolajuwon25@gmail.com";
if(!db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail)){
  const hash=bcrypt.hashSync("ChangeMe123!",12);
  db.prepare(`INSERT INTO users(username,email,full_name,password_hash,referral_code,is_admin,ip_address,device_info)
    VALUES(?,?,?,?,?,?,?,?)`).run("admin","azeemolajuwon25@gmail.com","Points Plaza Admin",hash,"admin-master",1,"seed","seed");
}
if(db.prepare("SELECT COUNT(*) c FROM tasks").get().c===0){
  db.prepare(`INSERT INTO tasks(name,instructions,link,reward,submission_limit,proof_type,display_order,active)
    VALUES(?,?,?,?,?,?,?,1)`).run("Join Our Official Community","Join the official community using the button below, then submit proof.","https://t.me/",50,100,"screenshot",1);
  db.prepare(`INSERT INTO tasks(name,instructions,link,reward,submission_limit,proof_type,display_order,active)
    VALUES(?,?,?,?,?,?,?,1)`).run("Follow Our Updates","Follow the official updates channel and enter your username.","https://t.me/",30,100,"text",2);
}
if(db.prepare("SELECT COUNT(*) c FROM milestones").get().c===0){
  [[10,100],[25,300],[50,700],[100,1500]].forEach(x=>db.prepare("INSERT INTO milestones(referral_requirement,reward,active) VALUES(?,?,1)").run(...x));
}

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Points Plaza running on http://localhost:${PORT}`));
