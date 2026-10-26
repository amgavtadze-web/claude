// ფიტნეს ტრენერის აღრიცხვის სისტემა + ავტომატური SMS შეხსენება
// გაშვება: ADMIN_PASSWORD=... node server.js   (დამატებითი პაკეტები არ სჭირდება, Node 18+)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TZ = process.env.TZ_NAME || 'Asia/Tbilisi';
const REMIND_HOUR = Number(process.env.REMIND_HOUR || 10); // რომელ საათზე გაიგზავნოს
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const DEFAULT_TEMPLATE = 'გამარჯობა {name}! შეგახსენებთ, რომ ხვალ ({date}) გადასახდელია აბონემენტი: {amount}₾. გმადლობთ!';

// ---------- მონაცემთა შენახვა ----------
let db = { members: [], sent: {}, template: DEFAULT_TEMPLATE, nextId: 1 };
if (fs.existsSync(DATA_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
const save = () => {
  fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
};

// ---------- თარიღები (YYYY-MM-DD სტრიქონები) ----------
const pad = n => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
const nowParts = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { today: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// შემდეგი გადახდის თარიღი: ერთი თვე წინ, dueDay-ს მიხედვით (მაგ. 31 -> თვის ბოლო დღე)
const nextMonth = (iso, dueDay) => {
  let [y, m] = iso.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad(m)}-${pad(Math.min(dueDay, daysIn(y, m)))}`;
};
// პირველი გადახდა: startDate-ის შემდეგ პირველი dueDay (თვეში ერთხელ)
const firstDue = (startIso, dueDay) => {
  const [y, m] = startIso.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(Math.min(dueDay, daysIn(y, m)))}`;
};

// ---------- SMS ----------
const normPhone = raw => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 9) d = '995' + d;           // 5XXXXXXXX -> 9955XXXXXXXX
  return d.length >= 11 ? d : null;
};
async function sendSms(phone, text) {
  const provider = (process.env.SMS_PROVIDER || 'log').toLowerCase();
  if (provider === 'log') { console.log(`[SMS-TEST] ${phone}: ${text}`); return; }
  if (provider === 'smsoffice') { // smsoffice.ge
    const u = new URL('https://smsoffice.ge/api/v2/send/');
    u.search = new URLSearchParams({
      key: process.env.SMSOFFICE_KEY, destination: phone,
      sender: process.env.SMSOFFICE_SENDER, content: text,
    });
    const r = await fetch(u); const body = await r.text();
    if (!r.ok || /error/i.test(body)) throw new Error(`smsoffice: ${r.status} ${body}`);
    return;
  }
  if (provider === 'twilio') {
    const sid = process.env.TWILIO_SID;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: '+' + phone, From: process.env.TWILIO_FROM, Body: text }),
    });
    if (!r.ok) throw new Error(`twilio: ${r.status} ${await r.text()}`);
    return;
  }
  throw new Error('უცნობი SMS_PROVIDER: ' + provider);
}
const render = (tpl, m) => tpl
  .replaceAll('{name}', m.name).replaceAll('{amount}', m.fee).replaceAll('{date}', m.nextDue.split('-').reverse().join('.'));

// ---------- ავტომატური შეხსენებები ----------
let running = false;
async function checkReminders() {
  if (running) return; running = true;
  try {
    const { today, hour } = nowParts();
    if (hour < REMIND_HOUR) return;
    const tomorrow = addDays(today, 1);
    for (const m of db.members) {
      if (!m.active || m.nextDue !== tomorrow) continue;
      const key = `${m.id}:${m.nextDue}`;
      if (db.sent[key]) continue;
      const phone = normPhone(m.phone);
      if (!phone) { console.error('არასწორი ნომერი:', m.name); continue; }
      try {
        await sendSms(phone, render(db.template, m));
        db.sent[key] = new Date().toISOString(); save();
        console.log('SMS გაიგზავნა:', m.name, m.nextDue);
      } catch (e) { console.error('SMS ვერ გაიგზავნა:', m.name, e.message); } // შემდეგ წუთს ისევ ცდის
    }
  } finally { running = false; }
}
setInterval(checkReminders, 60_000);

// ---------- HTTP ----------
const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
const readBody = req => new Promise((ok, no) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } });
});
function clean(b, old = {}) {
  const dueDay = Math.min(31, Math.max(1, Number(b.dueDay ?? old.dueDay)));
  const fee = Number(b.fee ?? old.fee);
  const name = String(b.name ?? old.name ?? '').trim();
  const phone = String(b.phone ?? old.phone ?? '').trim();
  if (!name || !normPhone(phone) || !(fee >= 0) || !dueDay) throw new Error('შეავსეთ სახელი, სწორი ნომერი, თანხა და გადახდის დღე');
  const startDate = (b.startDate ?? old.startDate) || '';
  return { name, phone, fee, dueDay, startDate, note: String(b.note ?? old.note ?? '') };
}

const server = http.createServer(async (req, res) => {
  try {
    if (PASSWORD) {
      const [u, p] = Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString().split(/:(.*)/s);
      if (p !== PASSWORD) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Trainer"' }); return res.end('პაროლი საჭიროა');
      }
    }
    const url = new URL(req.url, 'http://x');
    const seg = url.pathname.split('/').filter(Boolean);

    if (seg[0] !== 'api') { // სტატიკური გვერდი
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    }
    const { today } = nowParts();
    if (seg[1] === 'state' && req.method === 'GET')
      return send(res, 200, { today, template: db.template, members: db.members, sentCount: Object.keys(db.sent).length });

    if (seg[1] === 'template' && req.method === 'PUT') {
      const b = await readBody(req); db.template = String(b.template || DEFAULT_TEMPLATE); save();
      return send(res, 200, { ok: true });
    }
    if (seg[1] === 'members' && !seg[2] && req.method === 'POST') {
      const m = clean(await readBody(req));
      const m2 = { id: db.nextId++, active: true, ...m, nextDue: firstDue(m.startDate || today, m.dueDay) };
      // თუ პირველი თარიღი უკვე გავიდა და თარიღი მითითებული არაა, შემდეგი თვიდან დავიწყოთ
      if (!m.startDate && m2.nextDue < today) m2.nextDue = nextMonth(m2.nextDue, m.dueDay);
      db.members.push(m2); save(); return send(res, 200, m2);
    }
    const m = db.members.find(x => x.id === Number(seg[2]));
    if (seg[1] === 'members' && m) {
      if (req.method === 'PUT') {
        const old = m.dueDay, upd = clean(await readBody(req), m); Object.assign(m, upd);
        if (upd.dueDay !== old) m.nextDue = firstDue(m.nextDue, upd.dueDay);
        save(); return send(res, 200, m);
      }
      if (req.method === 'DELETE') { db.members = db.members.filter(x => x !== m); save(); return send(res, 200, { ok: true }); }
      if (seg[3] === 'paid' && req.method === 'POST') { m.nextDue = nextMonth(m.nextDue, m.dueDay); save(); return send(res, 200, m); }
      if (seg[3] === 'toggle' && req.method === 'POST') { m.active = !m.active; save(); return send(res, 200, m); }
      if (seg[3] === 'test' && req.method === 'POST') { await sendSms(normPhone(m.phone), render(db.template, m)); return send(res, 200, { ok: true }); }
    }
    send(res, 404, { error: 'ვერ მოიძებნა' });
  } catch (e) { send(res, 400, { error: e.message }); }
});
server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}  | SMS: ${process.env.SMS_PROVIDER || 'log (ტესტი)'}`);
  if (!PASSWORD) console.warn('⚠ ADMIN_PASSWORD არ არის დაყენებული — გვერდი ღიაა!');
  checkReminders();
});
