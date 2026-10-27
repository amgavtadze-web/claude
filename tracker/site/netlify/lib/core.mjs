// საერთო ლოგიკა: მონაცემები (Netlify Blobs), თარიღები, SMS (UBill), შეხსენებები
import fs from 'node:fs';

export const TZ = 'Asia/Tbilisi';
export const DEFAULT_TEMPLATE = 'გამარჯობა {name}! შეგახსენებთ, რომ ხვალ ({date}) გადასახდელია აბონემენტი: {amount}₾. გმადლობთ!';

// ---------- მონაცემთა შენახვა ----------
const emptyDb = () => ({ members: [], sent: {}, template: DEFAULT_TEMPLATE, nextId: 1 });

async function blobStore() {
  const { getStore } = await import('@netlify/blobs');
  return getStore('trainer');
}
export async function loadDb() {
  if (process.env.LOCAL_DB) { // მხოლოდ ლოკალური ტესტისთვის
    return fs.existsSync(process.env.LOCAL_DB) ? { ...emptyDb(), ...JSON.parse(fs.readFileSync(process.env.LOCAL_DB, 'utf8')) } : emptyDb();
  }
  const db = await (await blobStore()).get('db', { type: 'json' });
  return { ...emptyDb(), ...(db || {}) };
}
export async function saveDb(db) {
  if (process.env.LOCAL_DB) return fs.writeFileSync(process.env.LOCAL_DB, JSON.stringify(db, null, 2));
  await (await blobStore()).setJSON('db', db);
}

// ---------- თარიღები (YYYY-MM-DD სტრიქონები) ----------
const pad = n => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function today() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const nextMonth = (iso, dueDay) => {
  let [y, m] = iso.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad(m)}-${pad(Math.min(dueDay, daysIn(y, m)))}`;
};
export const firstDue = (iso, dueDay) => {
  const [y, m] = iso.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(Math.min(dueDay, daysIn(y, m)))}`;
};
export const ddmm = iso => String(iso).split('-').reverse().join('.');

// ---------- მოსწავლეები ----------
export const normPhone = raw => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 9) d = '995' + d;
  return d.length >= 11 ? d : null;
};
export function clean(b, old = {}) {
  const dueDay = Math.min(31, Math.max(1, Number(b.dueDay ?? old.dueDay)));
  const fee = Number(b.fee ?? old.fee);
  const name = String(b.name ?? old.name ?? '').trim();
  const phone = String(b.phone ?? old.phone ?? '').trim();
  if (!name || !normPhone(phone) || !(fee >= 0) || !dueDay) throw new Error('შეავსეთ სახელი, სწორი ნომერი, თანხა და გადახდის დღე');
  return { name, phone, fee, dueDay, startDate: (b.startDate ?? old.startDate) || '', note: String(b.note ?? old.note ?? '') };
}
export const render = (tpl, m, date) => tpl
  .replaceAll('{name}', m.name).replaceAll('{amount}', m.fee).replaceAll('{date}', ddmm(date || m.nextDue));

// ---------- SMS (UBill) ----------
// POST https://api.ubill.dev/v1/sms/send, სათაური `key`, ტანი {brandID, numbers[], text, stopList}
const UBILL = () => process.env.UBILL_URL || 'https://api.ubill.dev';
let brandCache = null;
async function brandId() {
  if (process.env.UBILL_BRAND_ID) return Number(process.env.UBILL_BRAND_ID) || process.env.UBILL_BRAND_ID;
  if (brandCache) return brandCache;
  const r = await fetch(UBILL() + '/v1/sms/brandNames', { headers: { key: (process.env.UBILL_KEY || '').trim() } });
  const raw = await r.text(); let j = {}; try { j = JSON.parse(raw); } catch {}
  if (!r.ok) throw new Error(`UBill-მა სათაურების სია არ დაგვიბრუნა (${r.status}). ეს გასაღების ან უფლებების პრობლემაა, არა სახელის. პასუხი: ${raw.slice(0, 200)}`);
  const list = j.brands || j.data || (Array.isArray(j) ? j : []);
  const want = (process.env.UBILL_BRAND_NAME || 'BeroFitness').toLowerCase();
  const b = list.find(x => String(x.name).toLowerCase() === want);
  if (!b) throw new Error(`UBill: სათაური "${process.env.UBILL_BRAND_NAME || 'BeroFitness'}" სიაში არ არის. ნაპოვნია: ${list.map(x => x.name).join(', ') || 'არაფერი'}. ან ჩაწერე UBILL_BRAND_ID.`);
  return (brandCache = b.id);
}
export async function sendSms(phone, text) {
  if ((process.env.SMS_PROVIDER || '').toLowerCase() === 'log') { console.log(`[SMS-TEST] ${phone}: ${text}`); return { dry: true }; }
  if (!process.env.UBILL_KEY) throw new Error('UBILL_KEY არ არის დაყენებული');
  const r = await fetch(UBILL() + '/v1/sms/send', {
    method: 'POST',
    headers: { key: process.env.UBILL_KEY.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandID: await brandId(), numbers: [phone], text, stopList: process.env.UBILL_STOPLIST !== 'false' }),
  });
  const body = await r.text(); let j = {}; try { j = JSON.parse(body); } catch {}
  if (!r.ok || (j.statusID !== undefined && Number(j.statusID) !== 0)) throw new Error(`UBill ${r.status}: ${body.slice(0, 300)}`);
  return j;
}

// ---------- ავტომატური შეხსენებები ----------
// მოსწავლეს, რომლის გადახდაც ხვალაა, ერთხელ იგზავნება SMS. წარუმატებელი გაგზავნა მომდევნო გაშვებისას ისევ სცდება.
export async function runReminders() {
  const db = await loadDb();
  const tomorrow = addDays(today(), 1);
  const out = { date: tomorrow, sent: [], failed: [], skipped: 0 };
  for (const m of db.members) {
    if (!m.active || m.nextDue !== tomorrow) continue;
    const key = `${m.id}:${m.nextDue}`;
    if (db.sent[key]) { out.skipped++; continue; }
    const phone = normPhone(m.phone);
    if (!phone) { out.failed.push({ name: m.name, error: 'არასწორი ნომერი' }); continue; }
    try {
      await sendSms(phone, render(db.template, m));
      db.sent[key] = new Date().toISOString();
      await saveDb(db);
      out.sent.push(m.name);
    } catch (e) { out.failed.push({ name: m.name, error: e.message }); }
  }
  console.log('remind', JSON.stringify(out));
  return out;
}
