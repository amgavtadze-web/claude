/**
 * დანამატების აღრიცხვა Google Sheets-ში (Servings Tracker)
 * გამოყენება: Extensions → Apps Script → ჩააკოპირე ეს კოდი → Save → გაუშვი setup()
 *
 * სვეტები: A ფოტო | B დასახელება | C თვითღირებულება ₾ | D ფასი ერთ მიღებაზე ₾ |
 *          E სულ მიღება | F გაყიდული | G +1 | H −1 | I Tracker (წრეები) | J შემოსავალი | K მოგება
 */
const SHEET_NAME = 'Supplements';
const FIRST_ROW = 2;
const ROWS = 60;            // რამდენ პროდუქტზეა მომზადებული ფურცელი
const PER_LINE = 30;        // წრეები ერთ ხაზზე
const COL = { PHOTO: 1, NAME: 2, COST: 3, PRICE: 4, TOTAL: 5, SOLD: 6, PLUS: 7, MINUS: 8, TRACK: 9, REV: 10, PROFIT: 11 };

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

/** წრეების ტექსტი: ● გაყიდული, ○ დარჩენილი, ხაზის გაწყვეტით */
function buildCircles_(sold, total, perLine) {
  let text = '';
  for (let i = 0; i < total; i++) {
    if (i > 0 && i % perLine === 0) text += '\n';
    text += i < sold ? '●' : '○';
  }
  return text;
}

function drawCircles_(sheet, row) {
  const total = Math.max(0, Math.floor(Number(sheet.getRange(row, COL.TOTAL).getValue()) || 0));
  let sold = Math.floor(Number(sheet.getRange(row, COL.SOLD).getValue()) || 0);
  sold = Math.min(Math.max(sold, 0), total);
  sheet.getRange(row, COL.SOLD).setValue(sold);
  const cell = sheet.getRange(row, COL.TRACK);
  if (!total) { cell.clearContent(); return; }
  const text = buildCircles_(sold, total, PER_LINE);
  const grey = SpreadsheetApp.newTextStyle().setForegroundColor('#9aa0a6').build();
  const red = SpreadsheetApp.newTextStyle().setForegroundColor('#dc2626').setBold(true).build();
  const b = SpreadsheetApp.newRichTextValue().setText(text).setTextStyle(0, text.length, grey);
  // ● არის ერთი სიმბოლო; ახალი ხაზები ინდექსებს ცვლის
  const idx = n => n + Math.floor((n - 1) / PER_LINE) * (n > 0 ? 1 : 0);
  if (sold > 0) b.setTextStyle(0, idx(sold), red);
  cell.setRichTextValue(b.build());
}

/** ავტომატურად მუშაობს ყოველ ცვლილებაზე (ტელეფონზეც) */
function onEdit(e) {
  const r = e.range, sheet = r.getSheet();
  if (sheet.getName() !== SHEET_NAME || r.getRow() < FIRST_ROW || r.getNumRows() > 1 || r.getNumColumns() > 1) return;
  const row = r.getRow(), c = r.getColumn();
  if ((c === COL.PLUS || c === COL.MINUS) && String(e.value).toUpperCase() === 'TRUE') {
    if (sheet.getRange(row, COL.NAME).getValue() !== '') {
      const sold = Number(sheet.getRange(row, COL.SOLD).getValue()) || 0;
      sheet.getRange(row, COL.SOLD).setValue(sold + (c === COL.PLUS ? 1 : -1));
      drawCircles_(sheet, row);
    }
    r.setValue(false); // ჩექბოქსი თავიდან ჩაქრება, მზადაა შემდეგი +1-ისთვის
  } else if (c === COL.TOTAL || c === COL.SOLD) {
    drawCircles_(sheet, row);
  }
}

function resetSold() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  sheet.getRange(FIRST_ROW, COL.SOLD, ROWS, 1).clearContent();
  for (let r = FIRST_ROW; r < FIRST_ROW + ROWS; r++) drawCircles_(sheet, r);
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    if (ui.alert('ფურცელი უკვე არსებობს. წავშალო და თავიდან შევქმნა? (ფოტოებიც წაიშლება)', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    ss.deleteSheet(sheet);
  }
  sheet = ss.insertSheet(SHEET_NAME);
  const last = FIRST_ROW + ROWS - 1;

  sheet.getRange(1, 1, 1, 11).setValues([['ფოტო', 'დასახელება', 'თვითღირებულება ₾', 'ფასი მიღებაზე ₾', 'სულ მიღება', 'გაყიდული', '+1', '−1', 'Tracker', 'შემოსავალი ₾', 'მოგება ₾']])
    .setBackground('#111').setFontColor('#fff').setFontWeight('bold').setVerticalAlignment('middle');
  sheet.setFrozenRows(1);

  SEED.forEach((p, i) => {
    sheet.getRange(FIRST_ROW + i, COL.NAME, 1, 4).setValues([[p[0], p[1], p[2] || '', p[3]]]);
  });
  sheet.getRange(FIRST_ROW, COL.PLUS, ROWS, 2).insertCheckboxes();
  const rev = [], profit = [];
  for (let r = FIRST_ROW; r <= last; r++) {
    rev.push([`=IF($B${r}="","",N($F${r})*N($D${r}))`]);
    profit.push([`=IF($B${r}="","",$J${r}-N($C${r}))`]);
  }
  sheet.getRange(FIRST_ROW, COL.REV, ROWS, 1).setFormulas(rev);
  sheet.getRange(FIRST_ROW, COL.PROFIT, ROWS, 1).setFormulas(profit);

  // ფორმატირება
  const body = sheet.getRange(FIRST_ROW, 1, ROWS, 11);
  body.setVerticalAlignment('middle');
  sheet.getRange(FIRST_ROW, COL.TRACK, ROWS, 1).setWrap(true).setFontSize(10).setFontFamily('Arial');
  sheet.getRange(FIRST_ROW, COL.PLUS, ROWS, 2).setHorizontalAlignment('center');
  sheet.getRange(FIRST_ROW, COL.NAME, ROWS, 1).setFontWeight('bold').setWrap(true);
  sheet.setRowHeights(FIRST_ROW, ROWS, 80);
  sheet.setColumnWidth(COL.PHOTO, 90);
  sheet.setColumnWidth(COL.NAME, 150);
  [COL.COST, COL.PRICE, COL.TOTAL, COL.SOLD].forEach(c => sheet.setColumnWidth(c, 85));
  sheet.setColumnWidths(COL.PLUS, 2, 45);
  sheet.setColumnWidth(COL.TRACK, 390);
  sheet.setColumnWidths(COL.REV, 2, 95);
  sheet.getRange(FIRST_ROW, 1, ROWS, 11).setBorder(null, null, true, null, null, null, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);

  // ჯამები
  sheet.getRange('M1:N3').setValues([
    ['ჯამი შემოსავალი', `=SUM(J${FIRST_ROW}:J${last})`],
    ['ჯამი მოგება', `=SUM(K${FIRST_ROW}:K${last})`],
    ['გაყიდული მიღება', `=SUM(F${FIRST_ROW}:F${last})`],
  ]);
  sheet.getRange('M1:M3').setFontWeight('bold');
  sheet.setColumnWidth(13, 130);

  for (let r = FIRST_ROW; r <= last; r++) drawCircles_(sheet, r);
  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('მზადაა! ფოტოს დასამატებლად: უჯრა A2 → Insert → Image → Image in cell.');
}
