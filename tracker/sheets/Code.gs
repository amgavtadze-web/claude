/**
 * დანამატების აღრიცხვა Google Sheets-ში
 * გამოყენება: Extensions → Apps Script → ჩააკოპირე ეს კოდი → Save → ზემოთ აირჩიე setup → Run
 *
 * სვეტები: A ფოტო | B დასახელება | C თვითღირებულება ₾ | D ფასი ერთ მიღებაზე ₾ |
 *          E სულ მიღება | F გაყიდული | G ➕ გაყიდვა (არჩევა) | H დარჩენილი | I შემოსავალი | J მოგება
 */
const SHEET_NAME = 'Supplements';
const FIRST_ROW = 2;
const ROWS = 60;            // რამდენ პროდუქტზეა მომზადებული ფურცელი
const COL = { PHOTO: 1, NAME: 2, COST: 3, PRICE: 4, TOTAL: 5, SOLD: 6, ADD: 7, LEFT: 8, REV: 9, PROFIT: 10 };

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

/** ავტომატურად მუშაობს ყოველ ცვლილებაზე (ტელეფონზეც) */
function onEdit(e) {
  if (!e || !e.range) return; // ხელით გაშვებისას ცვლილება არ არსებობს
  const r = e.range, sheet = r.getSheet();
  if (sheet.getName() !== SHEET_NAME || r.getRow() < FIRST_ROW) return;
  if (r.getNumRows() !== 1 || r.getNumColumns() !== 1 || r.getColumn() !== COL.ADD) return;
  const n = Math.floor(Number(String(e.value).replace(/^\+/, '')));
  const row = r.getRow();
  if (n > 0 && sheet.getRange(row, COL.NAME).getValue() !== '') {
    const total = Number(sheet.getRange(row, COL.TOTAL).getValue()) || 0;
    const soldCell = sheet.getRange(row, COL.SOLD);
    const sold = Number(soldCell.getValue()) || 0;
    const next = total ? Math.min(sold + n, total) : sold + n;
    soldCell.setValue(next);
    if (total && sold + n > total) e.source.toast('მარაგი ამოიწურა', sheet.getRange(row, COL.NAME).getValue());
  }
  r.clearContent(); // არჩევანი ისევ ცარიელდება, მზადაა შემდეგი გაყიდვისთვის
}

function resetSold() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (sheet) sheet.getRange(FIRST_ROW, COL.SOLD, ROWS, 1).clearContent();
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

  sheet.getRange(1, 1, 1, 10).setValues([['ფოტო', 'დასახელება', 'თვითღირებულება ₾', 'ფასი მიღებაზე ₾', 'სულ მიღება', 'გაყიდული', '➕ გაყიდვა', 'დარჩენილი', 'შემოსავალი ₾', 'მოგება ₾']])
    .setBackground('#111').setFontColor('#fff').setFontWeight('bold').setVerticalAlignment('middle').setWrap(true);
  sheet.setFrozenRows(1);

  SEED.forEach((p, i) => sheet.getRange(FIRST_ROW + i, COL.NAME, 1, 4).setValues([[p[0], p[1], p[2] || '', p[3]]]));

  // გაყიდვის არჩევა: ჩამოსაშლელი 1,2,3,4,5,10 (სხვა რიცხვის ხელით ჩაწერაც შეიძლება)
  const dv = SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3', '4', '5', '10'], true).setAllowInvalid(true).build();
  sheet.getRange(FIRST_ROW, COL.ADD, ROWS, 1).setDataValidation(dv);

  const left = [], rev = [], profit = [];
  for (let r = FIRST_ROW; r <= last; r++) {
    left.push([`=IF($B${r}="","",N($E${r})-N($F${r}))`]);
    rev.push([`=IF($B${r}="","",N($F${r})*N($D${r}))`]);
    profit.push([`=IF($B${r}="","",$I${r}-N($C${r}))`]);
  }
  sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1).setFormulas(left);
  sheet.getRange(FIRST_ROW, COL.REV, ROWS, 1).setFormulas(rev);
  sheet.getRange(FIRST_ROW, COL.PROFIT, ROWS, 1).setFormulas(profit);

  // ფორმატირება
  sheet.getRange(FIRST_ROW, 1, ROWS, 10).setVerticalAlignment('middle');
  sheet.getRange(FIRST_ROW, COL.NAME, ROWS, 1).setFontWeight('bold').setWrap(true);
  sheet.getRange(FIRST_ROW, COL.SOLD, ROWS, 1).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#fef2f2');
  sheet.getRange(FIRST_ROW, COL.ADD, ROWS, 1).setHorizontalAlignment('center').setFontSize(14).setBackground('#ecfdf5');
  sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1).setFontSize(14).setHorizontalAlignment('center');
  sheet.setRowHeights(FIRST_ROW, ROWS, 80);
  sheet.setColumnWidth(COL.PHOTO, 90);
  sheet.setColumnWidth(COL.NAME, 160);
  [COL.COST, COL.PRICE, COL.TOTAL, COL.SOLD, COL.LEFT].forEach(c => sheet.setColumnWidth(c, 90));
  sheet.setColumnWidth(COL.ADD, 100);
  sheet.setColumnWidths(COL.REV, 2, 100);
  sheet.getRange(FIRST_ROW, 1, ROWS, 10).setBorder(null, null, true, null, null, null, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);

  // დარჩენილი: 0 → წითელი, ≤5 → ნარინჯისფერი
  const leftRange = sheet.getRange(FIRST_ROW, COL.LEFT, ROWS, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(ISNUMBER($H${FIRST_ROW}),$H${FIRST_ROW}<=0)`).setBackground('#fecaca').setFontColor('#b91c1c').setRanges([leftRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(ISNUMBER($H${FIRST_ROW}),$H${FIRST_ROW}<=5)`).setBackground('#fed7aa').setRanges([leftRange]).build(),
  ]);

  // ჯამები
  sheet.getRange('L1:M3').setValues([
    ['ჯამი შემოსავალი', `=SUM(I${FIRST_ROW}:I${last})`],
    ['ჯამი მოგება', `=SUM(J${FIRST_ROW}:J${last})`],
    ['გაყიდული მიღება', `=SUM(F${FIRST_ROW}:F${last})`],
  ]);
  sheet.getRange('L1:L3').setFontWeight('bold');
  sheet.setColumnWidth(12, 130);

  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('მზადაა! ფოტოს დასამატებლად: უჯრა A2 → Insert → Image → Image in cell.');
}
