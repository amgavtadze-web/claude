/**
 * დანამატების აღრიცხვა: Google Sheet + ტელეფონის/კომპიუტერის ვებ-გვერდი (− 4 +)
 * + გაყიდვების ისტორია (Sales), დღის / თვის / სულ ჯამები და თვიური რეპორტები
 *
 * ფაილები Apps Script-ში: Code.gs (ეს ფაილი) და Index.html (HTML ფაილი სახელად Index)
 * პირველად: 1) შეცვალე PIN  2) გაუშვი setup  3) Deploy → Web app (Execute as: Me, Access: Anyone)
 * ძველი ვერსიიდან განახლება (მონაცემები და ფოტოები რჩება): გაუშვი upgrade
 */
const PIN = '1234';            // ⚠ შეცვალე! ტრენერი გვერდზე პირველად შეიყვანს
const SHEET_NAME = 'Supplements';
const SALES = 'Sales';
const REPORT = 'Report';
const FIRST_ROW = 3;           // რიგი 1: ჯამები, რიგი 2: სათაური
const ROWS = 60;
const COL = { PHOTO: 1, NAME: 2, COST: 3, PRICE: 4, TOTAL: 5, SOLD: 6, LEFT: 7,
  TQ: 8, TS: 9, MQ: 10, MS: 11, AQ: 12, AS: 13, URL: 14, ID: 15 };
const NCOL = 15;
const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

// [დასახელება, თვითღირებულება, ფასი მიღებაზე, სულ მიღება]
const SEED = [
  ['OUTRAGE PRE WORKOUT', 115, 5.5, 30], ['THE SHIELD', 100, 3, 100],
  ['KREATINE MONOHYDRATE', 120, 3.8, 80], ['ATOMIC-1', 100, 2.4, 70],
  ['AAKG PLUS', 100, 5, 60], ['AAKG', 100, 2.8, 70], ['CITRULLINE', 100, 3.9, 50],
  ['GLUTA MINE', 100, 2.5, 80], ['BURN SHAPE', 110, 4, 40], ['L-KARNITINE', 115, 5, 31],
  ['IRON CUT', 100, 4, 30], ['XTEND', 210, 5, 90], ['SUPER PUMP AGRESION', 170, 8, 40],
  ['AMINO MAX 8000', 130, 0, 60],
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏋️ Tracker')
    .addItem('📊 რეპორტის ფურცელი', 'openReport')
    .addItem('📁 თვის რეპორტის შენახვა ცალკე ფურცლად', 'saveMonthReportUi')
    .addItem('⏰ ყოველთვიური ავტო-შენახვის ჩართვა', 'installMonthlyTrigger')
    .addSeparator()
    .addItem('განახლება ახალ ვერსიაზე (მონაცემები რჩება)', 'upgrade')
    .addItem('ფურცლის თავიდან შექმნა', 'setup')
    .addToUi();
}

// ---------- ვებ-გვერდი ----------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('დანამატები').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SSID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}
function sheet_() { return ss_().getSheetByName(SHEET_NAME); }
function auth_(pin) { if (String(pin) !== String(PIN)) throw new Error('არასწორი PIN'); }
const pad_ = n => (n < 10 ? '0' : '') + n;

/** დღევანდელი დღე და თვის პირველი რიცხვი Google Sheets-ის თარიღის ნომრებად (ცხრილის დროის სარტყლით) */
function serials_(ss, at) {
  const [y, m, d, hh, mi, se] = Utilities.formatDate(at || new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number);
  const day = Date.UTC(y, m - 1, d) / 86400000 + 25569;
  return { day: day, ts: day + (hh * 3600 + mi * 60 + se) / 86400, month: Date.UTC(y, m - 1, 1) / 86400000 + 25569, y: y, m: m };
}

function getData(pin) {
  auth_(pin);
  const rows = sheet_().getRange(FIRST_ROW, 1, ROWS, NCOL).getValues();
  const n = (r, c) => Number(r[c - 1]) || 0;
  const products = [];
  let today = 0, month = 0, total = 0;
  rows.forEach((r, i) => {
    if (r[COL.NAME - 1] === '') return;
    products.push({ row: i + FIRST_ROW, name: r[COL.NAME - 1], cost: r[COL.COST - 1], price: r[COL.PRICE - 1],
      total: n(r, COL.TOTAL), sold: n(r, COL.SOLD), photo: r[COL.URL - 1],
      tq: n(r, COL.TQ), ts: n(r, COL.TS), mq: n(r, COL.MQ), ms: n(r, COL.MS), aq: n(r, COL.AQ), as: n(r, COL.AS) });
    today += n(r, COL.TS); month += n(r, COL.MS); total += n(r, COL.AS);
  });
  return { products, today, month, total };
}

function nextId_() {
  const p = PropertiesService.getScriptProperties();
  const id = Number(p.getProperty('NEXT_ID')) || 1;
  p.setProperty('NEXT_ID', String(id + 1));
  return id;
}
function idOf_(sh, row) {
  let id = sh.getRange(row, COL.ID).getValue();
  if (id === '') { id = nextId_(); sh.getRange(row, COL.ID).setValue(id); }
  return id;
}
function checkRow_(row) { if (row < FIRST_ROW || row >= FIRST_ROW + ROWS) throw new Error('არასწორი რიგი'); }

/** delta: +1 / −1. გაყიდული არ გასცდება 0-სა და მარაგს. რეალური ცვლილება იწერება Sales ისტორიაში */
function changeSold(pin, row, delta) {
  auth_(pin);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_(), ss = sh.getParent();
    checkRow_(row);
    const total = Number(sh.getRange(row, COL.TOTAL).getValue()) || 0;
    const old = Number(sh.getRange(row, COL.SOLD).getValue()) || 0;
    let sold = old + Number(delta);
    sold = Math.max(0, total ? Math.min(sold, total) : sold);
    const d = sold - old;
    if (d !== 0) {
      sh.getRange(row, COL.SOLD).setValue(sold);
      const price = Number(sh.getRange(row, COL.PRICE).getValue()) || 0;
      const s = serials_(ss);
      ss.getSheetByName(SALES).appendRow([s.ts, s.day, s.month, idOf_(sh, row), sh.getRange(row, COL.NAME).getValue(), d, Math.round(d * price * 100) / 100]);
    }
    return sold;
  } finally { lock.releaseLock(); }
}

function addProduct(pin, p) {
  auth_(pin);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_();
    const names = sh.getRange(FIRST_ROW, COL.NAME, ROWS, 1).getValues();
    const i = names.findIndex(x => x[0] === '');
    if (i < 0) throw new Error('ფურცელი გაივსო');
    const name = String(p.name || '').trim(); if (!name) throw new Error('ჩაწერე დასახელება');
    const row = FIRST_ROW + i;
    sh.getRange(row, COL.NAME, 1, 4).setValues([[name, Number(p.cost) || '', Number(p.price) || '', Number(p.total) || '']]);
    sh.getRange(row, COL.ID).setValue(nextId_());
    return row;
  } finally { lock.releaseLock(); }
}

/** ფოტო (data URL) ინახება Drive-ში საქაღალდეში "Supplement photos" */
function uploadPhoto(pin, row, dataUrl) {
  auth_(pin);
  checkRow_(row);
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl); if (!m) throw new Error('არასწორი ფოტო');
  const it = DriveApp.getFoldersByName('Supplement photos');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Supplement photos');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'p' + row + '_' + Date.now() + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w500';
  sheet_().getRange(row, COL.URL).setValue(url);
  return url;
}

/** პროდუქტის რედაქტირება: ცვლილება პირდაპირ ეწერება Sheet-ში (გაყიდვების ისტორიას არ ეხება) */
function updateProduct(pin, row, p) {
  auth_(pin);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_();
    checkRow_(row);
    const name = String(p.name || '').trim(); if (!name) throw new Error('ჩაწერე დასახელება');
    const total = Number(p.total) || 0;
    const sold = Math.max(0, total ? Math.min(Number(p.sold) || 0, total) : Number(p.sold) || 0);
    sh.getRange(row, COL.NAME, 1, 5).setValues([[name, p.cost === '' ? '' : Number(p.cost), p.price === '' ? '' : Number(p.price), total || '', sold || '']]);
    idOf_(sh, row);
    return true;
  } finally { lock.releaseLock(); }
}

/** პროდუქტის წაშლა (ფორმულები რჩება; გაყიდვების ისტორია Sales-ში ინახება) */
function deleteProduct(pin, row) {
  auth_(pin);
  const sh = sheet_();
  checkRow_(row);
  sh.getRange(row, COL.NAME, 1, 5).clearContent();
  sh.getRange(row, COL.URL).clearContent();
  sh.getRange(row, COL.ID).clearContent();
  return true;
}

/** ერთხელ გაუშვი ედიტორიდან: Drive-ზე წვდომის ნებართვისთვის (ფოტოებისთვის) */
function authorizeDrive() {
  DriveApp.getRootFolder();
  SpreadsheetApp.getUi().alert('Drive-ის ნებართვა მზადაა ✓');
}

// ---------- რეპორტები ----------
function openReport() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(REPORT);
  if (sh) ss.setActiveSheet(sh);
}

function saveMonthReportUi() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), s = serials_(ss);
  const r = ui.prompt('თვის რეპორტი', 'რომელი თვე? ფორმატი: წელი-თვე (მაგ. ' + s.y + '-' + pad_(s.m) + ')', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const ym = r.getResponseText().trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) { ui.alert('არასწორი ფორმატი. მაგალითი: ' + s.y + '-' + pad_(s.m)); return; }
  saveMonthReport_(ss, ym);
  ui.alert('რეპორტი შენახულია ფურცელში "Report ' + ym + '"');
}

/** თვის რეპორტი ცალკე ფურცელში, ფიქსირებული მნიშვნელობებით (Sales ისტორიიდან) */
function saveMonthReport_(ss, ym) {
  const sales = ss.getSheetByName(SALES);
  const rng = sales.getLastRow() > 1 ? sales.getRange(2, 1, sales.getLastRow() - 1, 7) : null;
  const data = rng ? rng.getValues() : [], months = rng ? rng.getDisplayValues().map(r => r[2]) : [];   // თვის სვეტი ტექსტად: "2026-10"
  const agg = {};
  data.forEach((r, i) => {
    if (months[i] !== ym) return;
    const a = agg[r[3]] || (agg[r[3]] = { name: r[4], q: 0, s: 0 });
    a.name = r[4]; a.q += Number(r[5]) || 0; a.s += Number(r[6]) || 0;
  });
  const list = Object.keys(agg).map(k => agg[k]).filter(a => a.q !== 0).sort((a, b) => b.s - a.s);
  const name = 'Report ' + ym;
  const old = ss.getSheetByName(name); if (old) ss.deleteSheet(old);
  const sh = ss.insertSheet(name);
  const [y, m] = ym.split('-').map(Number);
  sh.getRange(1, 1).setValue(MONTHS[m - 1] + ' ' + y).setFontSize(16).setFontWeight('bold');
  sh.getRange(3, 1, 1, 3).setValues([['პროდუქტი', 'რაოდენობა', 'თანხა ₾']]).setBackground('#111').setFontColor('#fff').setFontWeight('bold');
  const q = list.reduce((x, a) => x + a.q, 0), s = Math.round(list.reduce((x, a) => x + a.s, 0) * 100) / 100;
  sh.getRange(4, 1, 1, 3).setValues([['ჯამი', q, s]]).setFontWeight('bold').setBackground('#fef3c7');
  if (list.length) sh.getRange(5, 1, list.length, 3).setValues(list.map(a => [a.name, a.q, Math.round(a.s * 100) / 100]));
  sh.getRange(4, 3, list.length + 1, 1).setNumberFormat('#,##0.00');
  sh.setColumnWidth(1, 240); sh.setColumnWidths(2, 2, 110); sh.setFrozenRows(3);
  return sh;
}

/** ყოველი თვის 1 რიცხვზე ავტომატურად ინახავს წინა თვის რეპორტს */
function autoSaveLastMonth() {
  const ss = ss_(), s = serials_(ss);
  const y = s.m === 1 ? s.y - 1 : s.y, m = s.m === 1 ? 12 : s.m - 1;
  saveMonthReport_(ss, y + '-' + pad_(m));
}
function installMonthlyTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'autoSaveLastMonth').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('autoSaveLastMonth').timeBased().onMonthDay(1).atHour(1).create();
  SpreadsheetApp.getUi().alert('ჩართულია ✓ ყოველი თვის 1 რიცხვზე წინა თვის რეპორტი ცალკე ფურცელში შეინახება.');
}

// ---------- ფურცლების შექმნა ----------
function setup() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(SHEET_NAME)) {
    const ui = SpreadsheetApp.getUi();
    if (ui.alert('ფურცელი უკვე არსებობს. წავშალო და თავიდან შევქმნა? (პროდუქტები, ფოტოები და გაყიდვების ისტორია წაიშლება). მონაცემების შესანარჩუნებლად აირჩიე "განახლება".', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const sales = ss.getSheetByName(SALES); if (sales) sales.clear();
  }
  PropertiesService.getScriptProperties().deleteProperty('NEXT_ID');
  build_(SEED.map(p => ({ name: p[0], cost: p[1], price: p[2] || '', total: p[3], sold: '', url: '' })));
}

/** ძველი ფურცლიდან გადმოაქვს პროდუქტები, ფოტოები და გაყიდულები ახალ სტრუქტურაში */
function upgrade() {
  const ss = SpreadsheetApp.getActive(), ui = SpreadsheetApp.getUi();
  const old = ss.getSheetByName(SHEET_NAME);
  if (!old) { ui.alert('ფურცელი ვერ ვიპოვე. გაუშვი setup.'); return; }
  if (old.getRange(2, 2).getValue() === 'დასახელება') { ui.alert('უკვე ახალ ვერსიაზეა ✓'); return; }
  let urlCol = 0;
  for (let c = 1; c <= 12; c++) if (old.getRange(1, c).getValue() === 'ფოტოს ბმული') urlCol = c;
  const vals = old.getRange(2, 1, 60, Math.max(urlCol, 6)).getValues();
  const rows = vals.filter(r => r[1] !== '').map(r => ({ name: r[1], cost: r[2], price: r[3], total: r[4], sold: r[5], url: urlCol ? r[urlCol - 1] : '' }));
  if (ui.alert('განვაახლო? ' + rows.length + ' პროდუქტი, მათი ფოტოები და გაყიდულები შენარჩუნდება.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty('NEXT_ID');
  build_(rows);
}

function ensureSales_(ss) {
  let sh = ss.getSheetByName(SALES);
  if (!sh) sh = ss.insertSheet(SALES);
  if (sh.getRange(1, 1).getValue() === '') {
    sh.getRange(1, 1, 1, 7).setValues([['დრო', 'დღე', 'თვე', 'პროდუქტის ID', 'პროდუქტი', 'რაოდენობა', 'თანხა ₾']])
      .setBackground('#111').setFontColor('#fff').setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');
    sh.getRange('B:B').setNumberFormat('dd.MM.yyyy');
    sh.getRange('C:C').setNumberFormat('yyyy-MM');
    sh.setColumnWidths(1, 7, 110); sh.setColumnWidth(1, 140); sh.setColumnWidth(5, 220);
  }
  return sh;
}

function build_(rows) {
  const ss = SpreadsheetApp.getActive();
  PropertiesService.getScriptProperties().setProperty('SSID', ss.getId());
  ss.setSpreadsheetTimeZone('Asia/Tbilisi');
  ensureSales_(ss);
  const rep = ss.getSheetByName(REPORT); if (rep) ss.deleteSheet(rep);
  const old = ss.getSheetByName(SHEET_NAME);
  if (old) {   // ძველი ფურცელი არ იშლება: რჩება სარეზერვო ასლად (ნაცრისფერი ტაბი)
    old.setName('Backup ' + Utilities.formatDate(new Date(), 'Asia/Tbilisi', 'yyyy-MM-dd HHmmss'));
    old.setTabColor('#9ca3af');
  }
  const sheet = ss.insertSheet(SHEET_NAME, 0);
  const last = FIRST_ROW + ROWS - 1;
  const L = c => String.fromCharCode(64 + c);

  sheet.getRange(2, 1, 1, NCOL).setValues([['ფოტო', 'დასახელება', 'თვითღირებულება ₾', 'ფასი მიღებაზე ₾', 'სულ მიღება', 'გაყიდული (მარაგში)', 'დარჩენილი',
    'დღეს რაოდ.', 'დღეს ₾', 'თვე რაოდ.', 'თვე ₾', 'სულ რაოდ.', 'სულ ₾', 'ფოტოს ბმული', 'ID']])
    .setBackground('#111').setFontColor('#fff').setFontWeight('bold').setVerticalAlignment('middle').setWrap(true).setHorizontalAlignment('center');
  sheet.getRange(2, COL.TQ, 1, 2).setBackground('#166534');
  sheet.getRange(2, COL.MQ, 1, 2).setBackground('#1e40af');
  sheet.getRange(2, COL.AQ, 1, 2).setBackground('#525252');
  sheet.setRowHeight(2, 44);
  sheet.setFrozenRows(2); sheet.setFrozenColumns(2);

  // პროდუქტები
  let maxId = 0;
  rows.slice(0, ROWS).forEach((p, i) => {
    const r = FIRST_ROW + i;
    sheet.getRange(r, COL.NAME, 1, 5).setValues([[p.name, p.cost, p.price, p.total, p.sold]]);
    sheet.getRange(r, COL.URL).setValue(p.url || '');
    sheet.getRange(r, COL.ID).setValue(i + 1); maxId = i + 1;
  });
  PropertiesService.getScriptProperties().setProperty('NEXT_ID', String(maxId + 1));

  // ფორმულები
  const photoF = [], restF = [];
  for (let r = FIRST_ROW; r <= last; r++) {
    const id = `$${L(COL.ID)}${r}`, S = c => `Sales!$${c}:$${c}`;
    const today = c => `SUMIFS(${S(c)},${S('D')},${id},${S('B')},TODAY())`;
    const month = c => `SUMIFS(${S(c)},${S('D')},${id},${S('C')},DATE(YEAR(TODAY()),MONTH(TODAY()),1))`;
    const all = c => `SUMIFS(${S(c)},${S('D')},${id})`;
    const g = e => `=IF($B${r}="","",${e})`;
    photoF.push([`=IF($${L(COL.URL)}${r}="","",IMAGE($${L(COL.URL)}${r}))`]);
    restF.push([g(`N($E${r})-N($F${r})`), g(today('F')), g(today('G')), g(month('F')), g(month('G')), g(all('F')), g(all('G'))]);
  }
  sheet.getRange(FIRST_ROW, COL.PHOTO, ROWS, 1).setFormulas(photoF);
  sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 7).setFormulas(restF);

  // ჯამების რიგი (რიგი 1)
  sheet.getRange(1, COL.LEFT).setValue('ჯამი:').setHorizontalAlignment('right');
  [COL.TQ, COL.TS, COL.MQ, COL.MS, COL.AQ, COL.AS].forEach(c =>
    sheet.getRange(1, c).setFormula(`=SUM(${L(c)}${FIRST_ROW}:${L(c)}${last})`));
  sheet.getRange(1, COL.LEFT, 1, 7).setFontWeight('bold').setBackground('#fef3c7').setFontSize(13).setHorizontalAlignment('center');
  sheet.setRowHeight(1, 32);

  // ფორმატირება
  sheet.getRange(FIRST_ROW, 1, ROWS, NCOL).setVerticalAlignment('middle');
  sheet.getRange(FIRST_ROW, COL.NAME, ROWS, 1).setFontWeight('bold').setWrap(true);
  sheet.getRange(FIRST_ROW, COL.SOLD, ROWS, 1).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#fef2f2');
  sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1).setFontSize(14).setHorizontalAlignment('center');
  sheet.getRange(FIRST_ROW, COL.TQ, ROWS, 6).setHorizontalAlignment('center').setFontSize(13);
  sheet.getRange(FIRST_ROW, COL.TQ, ROWS, 2).setBackground('#f0fdf4');
  sheet.getRange(FIRST_ROW, COL.MQ, ROWS, 2).setBackground('#eff6ff');
  sheet.getRange(FIRST_ROW, COL.AQ, ROWS, 2).setBackground('#f5f5f5');
  [COL.TS, COL.MS, COL.AS].forEach(c => sheet.getRange(1, c, ROWS + 2, 1).setNumberFormat('#,##0.##'));
  sheet.setRowHeights(FIRST_ROW, ROWS, 80);
  sheet.setColumnWidth(COL.PHOTO, 90); sheet.setColumnWidth(COL.NAME, 170);
  for (let c = COL.COST; c <= COL.AS; c++) sheet.setColumnWidth(c, 92);
  sheet.setColumnWidth(COL.URL, 120);
  sheet.hideColumns(COL.ID);
  sheet.getRange(FIRST_ROW, 1, ROWS, NCOL).setBorder(null, null, true, null, null, null, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);

  const lr = sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(ISNUMBER($G${FIRST_ROW}),$G${FIRST_ROW}<=0)`).setBackground('#fecaca').setFontColor('#b91c1c').setRanges([lr]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(ISNUMBER($G${FIRST_ROW}),$G${FIRST_ROW}<=5)`).setBackground('#fed7aa').setRanges([lr]).build(),
  ]);

  buildReport_(ss);
  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('მზადაა ✓\nპირველად ბმულის მისაღებად: Deploy → Manage deployments → ✏️ → New version → Deploy.');
}

/** Report ფურცელი: აირჩიე წელი და თვე, ქვემოთ ჩანს ამ თვის გაყიდვები პროდუქტების მიხედვით; მარჯვნივ ყველა თვის შედარება */
function buildReport_(ss) {
  const sh = ss.insertSheet(REPORT);
  const s = serials_(ss), last = FIRST_ROW + ROWS - 1;
  sh.getRange('A1:D1').setValues([['წელი', s.y, 'თვე', MONTHS[s.m - 1]]]).setFontWeight('bold').setFontSize(13);
  sh.getRange('B1').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['2026', '2027', '2028', '2029', '2030', '2031', '2032'], true).setAllowInvalid(true).build());
  sh.getRange('D1').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(MONTHS, true).build());
  sh.getRange('B1').setBackground('#fef9c3'); sh.getRange('D1').setBackground('#fef9c3');
  sh.getRange('H1').setFormula('=DATE(B1,MATCH(D1,{"' + MONTHS.join('","') + '"},0),1)').setNumberFormat('yyyy-MM').setFontColor('#9ca3af');
  sh.getRange('G1').setValue('პერიოდი:').setFontColor('#9ca3af').setHorizontalAlignment('right');

  sh.getRange('A3:C3').setValues([['პროდუქტი', 'რაოდენობა', 'თანხა ₾']]).setBackground('#111').setFontColor('#fff').setFontWeight('bold');
  sh.getRange('A4:C4').setValues([['ჯამი', '=SUM(B5:B' + (4 + ROWS) + ')', '=SUM(C5:C' + (4 + ROWS) + ')']]).setFontWeight('bold').setBackground('#fef3c7');
  const f = [];
  for (let i = 0; i < ROWS; i++) {
    const p = FIRST_ROW + i, r = 5 + i;
    const sum = c => `SUMIFS(Sales!$${c}:$${c},Sales!$D:$D,Supplements!$O${p},Sales!$C:$C,$H$1)`;
    f.push([`=IF(Supplements!$B${p}="","",Supplements!$B${p})`, `=IF($A${r}="","",${sum('F')})`, `=IF($A${r}="","",${sum('G')})`]);
  }
  sh.getRange(5, 1, ROWS, 3).setFormulas(f);
  sh.getRange(4, 3, ROWS + 1, 1).setNumberFormat('#,##0.##');
  sh.getRange(4, 2, ROWS + 1, 2).setHorizontalAlignment('center');

  sh.getRange('F2').setValue('ყველა თვე').setFontWeight('bold').setFontSize(13);
  sh.getRange('F3').setFormula(`=IFERROR(QUERY(Sales!A2:G,"select C, sum(F), sum(G) where C is not null group by C order by C desc label C 'თვე', sum(F) 'რაოდენობა', sum(G) 'თანხა ₾' format C 'yyyy-mm'",0),"გაყიდვები ჯერ არ არის")`);
  sh.setColumnWidth(1, 240); sh.setColumnWidths(2, 2, 110); sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 30); sh.setColumnWidths(6, 3, 110);
  sh.setFrozenRows(3);
  return sh;
}
