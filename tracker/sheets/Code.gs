/**
 * დანამატების აღრიცხვა: Google Sheet + ტელეფონის ვებ-გვერდი (− 4 +)
 *
 * ფაილები Apps Script-ში: Code.gs (ეს ფაილი) და Index.html (ახალი ფაილი: + → HTML → სახელად Index)
 * 1) შეცვალე PIN ქვემოთ  2) გაუშვი setup  3) Deploy → New deployment → Web app
 *    (Execute as: Me, Who has access: Anyone) → ბმული გახსენი ტელეფონზე
 */
const PIN = '1234';            // ⚠ შეცვალე! ტრენერი გვერდზე პირველად შეიყვანს
const SHEET_NAME = 'Supplements';
const FIRST_ROW = 2;
const ROWS = 60;
const COL = { PHOTO: 1, NAME: 2, COST: 3, PRICE: 4, TOTAL: 5, SOLD: 6, LEFT: 7, REV: 8, PROFIT: 9, URL: 10 };

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
    .addItem('ახალი თვე (გაყიდულების განულება)', 'resetSold')
    .addItem('ფურცლის თავიდან შექმნა', 'setup')
    .addToUi();
}

function resetSold() {
  const sheet = sheet_();
  sheet.getRange(FIRST_ROW, COL.SOLD, ROWS, 1).clearContent();
}

// ---------- ვებ-გვერდი ----------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('დანამატები').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SSID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  return ss.getSheetByName(SHEET_NAME);
}
function auth_(pin) { if (String(pin) !== String(PIN)) throw new Error('არასწორი PIN'); }

function getData(pin) {
  auth_(pin);
  const rows = sheet_().getRange(FIRST_ROW, 1, ROWS, 10).getValues();
  const products = [];
  let revenue = 0, profit = 0;
  rows.forEach((r, i) => {
    if (r[COL.NAME - 1] === '') return;
    products.push({ row: i + FIRST_ROW, name: r[COL.NAME - 1], price: r[COL.PRICE - 1], total: Number(r[COL.TOTAL - 1]) || 0,
      sold: Number(r[COL.SOLD - 1]) || 0, photo: r[COL.URL - 1] });
    revenue += Number(r[COL.REV - 1]) || 0; profit += Number(r[COL.PROFIT - 1]) || 0;
  });
  return { products, revenue, profit };
}

/** delta: +1 / −1. გაყიდული არ გასცდება 0-სა და მარაგს */
function changeSold(pin, row, delta) {
  auth_(pin);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_();
    if (row < FIRST_ROW || row >= FIRST_ROW + ROWS) throw new Error('არასწორი რიგი');
    const total = Number(sh.getRange(row, COL.TOTAL).getValue()) || 0;
    let sold = (Number(sh.getRange(row, COL.SOLD).getValue()) || 0) + Number(delta);
    sold = Math.max(0, total ? Math.min(sold, total) : sold);
    sh.getRange(row, COL.SOLD).setValue(sold);
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
    sh.getRange(FIRST_ROW + i, COL.NAME, 1, 4).setValues([[name, Number(p.cost) || '', Number(p.price) || '', Number(p.total) || '']]);
    return FIRST_ROW + i;
  } finally { lock.releaseLock(); }
}

/** ფოტო (data URL) ინახება Drive-ში საქაღალდეში "Supplement photos" */
function uploadPhoto(pin, row, dataUrl) {
  auth_(pin);
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl); if (!m) throw new Error('არასწორი ფოტო');
  const it = DriveApp.getFoldersByName('Supplement photos');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Supplement photos');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'p' + row + '_' + Date.now() + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w500';
  sheet_().getRange(row, COL.URL).setValue(url);
  return url;
}

// ---------- ფურცლის შექმნა ----------
function setup() {
  const ss = SpreadsheetApp.getActive();
  PropertiesService.getScriptProperties().setProperty('SSID', ss.getId());
  const old = ss.getSheetByName(SHEET_NAME);
  if (old) {
    const ui = SpreadsheetApp.getUi();
    if (ui.alert('ფურცელი უკვე არსებობს. წავშალო და თავიდან შევქმნა? (ფოტოებიც და გაყიდულებიც წაიშლება)', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    old.setName('old_' + Date.now());
  }
  const sheet = ss.insertSheet(SHEET_NAME);
  if (old) ss.deleteSheet(old);
  const last = FIRST_ROW + ROWS - 1;

  sheet.getRange(1, 1, 1, 10).setValues([['ფოტო', 'დასახელება', 'თვითღირებულება ₾', 'ფასი მიღებაზე ₾', 'სულ მიღება', 'გაყიდული', 'დარჩენილი', 'შემოსავალი ₾', 'მოგება ₾', 'ფოტოს ბმული']])
    .setBackground('#111').setFontColor('#fff').setFontWeight('bold').setVerticalAlignment('middle').setWrap(true);
  sheet.setFrozenRows(1);
  SEED.forEach((p, i) => sheet.getRange(FIRST_ROW + i, COL.NAME, 1, 4).setValues([[p[0], p[1], p[2] || '', p[3]]]));

  const f = { photo: [], left: [], rev: [], profit: [] };
  for (let r = FIRST_ROW; r <= last; r++) {
    f.photo.push([`=IF($J${r}="","",IMAGE($J${r}))`]);
    f.left.push([`=IF($B${r}="","",N($E${r})-N($F${r}))`]);
    f.rev.push([`=IF($B${r}="","",N($F${r})*N($D${r}))`]);
    f.profit.push([`=IF($B${r}="","",$H${r}-N($C${r}))`]);
  }
  sheet.getRange(FIRST_ROW, COL.PHOTO, ROWS, 1).setFormulas(f.photo);
  sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1).setFormulas(f.left);
  sheet.getRange(FIRST_ROW, COL.REV, ROWS, 1).setFormulas(f.rev);
  sheet.getRange(FIRST_ROW, COL.PROFIT, ROWS, 1).setFormulas(f.profit);

  sheet.getRange(FIRST_ROW, 1, ROWS, 10).setVerticalAlignment('middle');
  sheet.getRange(FIRST_ROW, COL.NAME, ROWS, 1).setFontWeight('bold').setWrap(true);
  sheet.getRange(FIRST_ROW, COL.SOLD, ROWS, 1).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#fef2f2');
  sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1).setFontSize(14).setHorizontalAlignment('center');
  sheet.setRowHeights(FIRST_ROW, ROWS, 80);
  sheet.setColumnWidth(COL.PHOTO, 90); sheet.setColumnWidth(COL.NAME, 160);
  [COL.COST, COL.PRICE, COL.TOTAL, COL.SOLD, COL.LEFT, COL.REV, COL.PROFIT].forEach(c => sheet.setColumnWidth(c, 95));
  sheet.setColumnWidth(COL.URL, 120);
  sheet.getRange(FIRST_ROW, 1, ROWS, 10).setBorder(null, null, true, null, null, null, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);

  const lr = sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(ISNUMBER($G${FIRST_ROW}),$G${FIRST_ROW}<=0)`).setBackground('#fecaca').setFontColor('#b91c1c').setRanges([lr]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(ISNUMBER($G${FIRST_ROW}),$G${FIRST_ROW}<=5)`).setBackground('#fed7aa').setRanges([lr]).build(),
  ]);
  sheet.getRange('L1:M3').setValues([
    ['ჯამი შემოსავალი', `=SUM(H${FIRST_ROW}:H${last})`], ['ჯამი მოგება', `=SUM(I${FIRST_ROW}:I${last})`], ['გაყიდული მიღება', `=SUM(F${FIRST_ROW}:F${last})`]]);
  sheet.getRange('L1:L3').setFontWeight('bold'); sheet.setColumnWidth(12, 130);

  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('მზადაა! ახლა Deploy → New deployment → Web app (Execute as: Me, Access: Anyone) და ბმული გახსენი ტელეფონზე.');
}
