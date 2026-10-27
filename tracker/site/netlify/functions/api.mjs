import { loadDb, saveDb, today, firstDue, nextMonth, clean, normPhone, render, sendSms, runReminders, DEFAULT_TEMPLATE } from '../lib/core.mjs';
import { timingSafeEqual } from 'node:crypto';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
function pinOk(req) {
  const want = process.env.APP_PIN || '';
  const got = req.headers.get('x-pin') || '';
  if (!want) return null;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  try {
    const ok = pinOk(req);
    if (ok === null) return json({ error: 'APP_PIN არ არის დაყენებული Netlify-ში' }, 500);
    if (!ok) return json({ error: 'არასწორი PIN' }, 401);

    const seg = new URL(req.url).pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const method = req.method;
    const body = ['POST', 'PUT'].includes(method) ? await req.json().catch(() => ({})) : {};
    const db = await loadDb();

    if (seg[0] === 'state' && method === 'GET')
      return json({ today: today(), template: db.template, members: db.members, sent: db.sent, sms: process.env.SMS_PROVIDER === 'log' ? 'test' : (process.env.UBILL_KEY ? 'live' : 'off') });

    if (seg[0] === 'export' && method === 'GET') return json(db);

    if (seg[0] === 'import' && method === 'POST') { // ბექაპიდან/ტელეფონიდან მონაცემების ჩატვირთვა
      if (!Array.isArray(body.members)) throw new Error('არასწორი ფაილი');
      const nextId = Math.max(Number(body.nextId) || 1, ...body.members.map(m => Number(m.id) + 1 || 1));
      await saveDb({ members: body.members, sent: body.sent || {}, template: body.template || DEFAULT_TEMPLATE, nextId });
      return json({ ok: true, count: body.members.length });
    }

    if (seg[0] === 'template' && method === 'PUT') { db.template = String(body.template || DEFAULT_TEMPLATE); await saveDb(db); return json({ ok: true }); }

    if (seg[0] === 'run' && method === 'POST') return json(await runReminders()); // შეხსენებების ხელით გაშვება

    if (seg[0] === 'members' && !seg[1] && method === 'POST') {
      const m = clean(body), t = today();
      const n = { id: db.nextId++, active: true, ...m, nextDue: firstDue(m.startDate || t, m.dueDay) };
      if (!m.startDate && n.nextDue < t) n.nextDue = nextMonth(n.nextDue, m.dueDay);
      db.members.push(n); await saveDb(db); return json(n);
    }

    const m = db.members.find(x => x.id === Number(seg[1]));
    if (seg[0] === 'members' && m) {
      if (method === 'PUT') {
        const old = m.dueDay, upd = clean(body, m); Object.assign(m, upd);
        if (upd.dueDay !== old) m.nextDue = firstDue(m.nextDue, upd.dueDay);
        await saveDb(db); return json(m);
      }
      if (method === 'DELETE') { db.members = db.members.filter(x => x !== m); await saveDb(db); return json({ ok: true }); }
      if (seg[2] === 'paid' && method === 'POST') { m.nextDue = nextMonth(m.nextDue, m.dueDay); await saveDb(db); return json(m); }
      if (seg[2] === 'toggle' && method === 'POST') { m.active = !m.active; await saveDb(db); return json(m); }
      if (seg[2] === 'test' && method === 'POST') { await sendSms(normPhone(m.phone), render(db.template, m)); return json({ ok: true }); }
    }
    return json({ error: 'ვერ მოიძებნა' }, 404);
  } catch (e) { return json({ error: e.message }, 400); }
};
export const config = { path: '/api/*' };
