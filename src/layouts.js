/** Source coordinates are one-based. UI order never determines a write address. */
export const CATEGORIES = ['utilities', 'entertainment', 'debt', 'transportation'];
export const LABELS = { utilities: 'Utilities', entertainment: 'Entertainment', debt: 'Debt', transportation: 'Transportation', personal: 'Personal Zone' };
export const colName = n => { let s = ''; for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
export const address = (row, col) => `${colName(col)}${row}`;
export const quoteSheet = title => `'${title.replaceAll("'", "''")}'`;
export const cell = (sheet, row, col) => sheet.values[row - 1]?.[col - 1] ?? '';
export const norm = v => String(v ?? '').trim().toLowerCase();
export function amount(v, label, optional = false) {
  if (v === '' || v == null || v === '-') { if (optional) return null; throw new Error(`${label} is missing.`); }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || typeof v === 'boolean') throw new Error(`${label} must be a nonnegative amount.`);
  return n;
}
export function dueDay(value) {
  if (value === '' || value == null || /^(n\/?a|-)$/i.test(String(value).trim())) return null;
  const match = String(value).trim().match(/^(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (!match || +match[1] < 1 || +match[1] > 31) throw new Error(`Unrecognized due day: ${value}. Use a day from 1–31.`);
  return +match[1];
}
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export function periodFromTitle(title) {
  const m = title.trim().match(/^([a-z]+)\s*['’‘\uFFFD]?\s*(\d{2}|\d{4})$/i);
  if (!m) return null;
  const month = MONTHS.findIndex(x => x === m[1].toLowerCase() || x.slice(0, 3) === m[1].toLowerCase());
  const year = +m[2] < 100 ? 2000 + +m[2] : +m[2];
  if (month < 0 || year < 2026 || (year === 2026 && month < 4)) return null;
  return { year, month, key: `${year}-${String(month + 1).padStart(2,'0')}`, label: `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}` };
}
export function listPeriods(sheets) {
  return sheets.map(s => ({ ...s, period: periodFromTitle(s.title) })).filter(s => s.period).sort((a,b) => b.period.key.localeCompare(a.period.key));
}
function findRow(s, col, label, start = 1) {
  for (let r = start; r <= s.values.length; r++) if (norm(cell(s,r,col)) === norm(label)) return r;
  throw new Error(`Unsupported layout: cannot find ${label} in column ${colName(col)}.`);
}
function requireHeader(s, row, col, pattern, label) {
  if (!pattern.test(norm(cell(s,row,col)))) throw new Error(`Unsupported layout: expected ${label} at ${address(row,col)}.`);
}
function checkAnchor(s, row, col) {
  for (const m of s.merges || []) if (row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol && (row !== m.startRow || col !== m.startCol)) throw new Error(`Unsupported merge at ${address(row,col)}.`);
}
function section(s, category, cols, title, personId = null) {
  const heading = findRow(s, cols.name, title);
  const header = category === 'personal' ? heading + 4 : heading + 1;
  requireHeader(s, header, cols.name, /^(bill|name)$/, 'bill name');
  requireHeader(s, header, cols.cost, /^(monthly cost|cost)$/, 'cost');
  requireHeader(s, header, cols.paid, /^(paid|true|false)$/, 'paid');
  requireHeader(s, header, cols.date, /^(date|due date)$/, 'date');
  if (cols.balance) requireHeader(s, header, cols.balance, /^(balance|debt)$/, 'balance');
  const start = header + 1;
  let end, totalRow;
  if (category !== 'personal') { totalRow = findRow(s, cols.name, 'Total', start); end = totalRow - 1; }
  else {
    end = start - 1;
    for (let r = start; r <= s.values.length; r++) {
      if (typeof cell(s,r,cols.paid) !== 'boolean' && !(s.checkboxes || []).includes(address(r,cols.paid))) break;
      end = r;
    }
    if (end < start) throw new Error('Unsupported Personal Zone: no checkbox rows found.');
    // Populated cells after a gap must not silently disappear from the personal sum.
    for (let r = end + 1; r <= s.values.length; r++) if (cell(s,r,cols.name) !== '' || cell(s,r,cols.cost) !== '') throw new Error(`Unsupported Personal Zone: data below its checkbox block at row ${r}.`);
  }
  const out = { id: personId || category, category, personId, cols, start, end, header, heading, totalRow, bills: [] };
  for (let r = start; r <= end; r++) {
    for (const c of Object.values(cols)) checkAnchor(s,r,c);
    const name = String(cell(s,r,cols.name)).trim();
    if (!name) {
      if (['cost','balance','date'].some(k => cols[k] && cell(s,r,cols[k]) !== '')) throw new Error(`Bill name missing at ${address(r,cols.name)}.`);
      continue;
    }
    const refs = Object.fromEntries(Object.entries(cols).map(([k,c]) => [k,address(r,c)]));
    const paid = cell(s,r,cols.paid);
    if (typeof paid !== 'boolean') throw new Error(`Paid checkbox missing at ${refs.paid}.`);
    out.bills.push({ id: `${s.id}:${out.id}:${r}`, row: r, sectionId: out.id, category, personId, name, cost: amount(cell(s,r,cols.cost),name), balance: cols.balance ? amount(cell(s,r,cols.balance),`${name} balance`,true) : null, paid, dueDay: dueDay(cell(s,r,cols.date)), refs });
  }
  return out;
}
export function parseBudget(s) {
  const isNew = norm(cell(s,2,19)) === 'personal zone - user 1' && norm(cell(s,2,26)) === 'personal zone - user 2';
  const oldTitle = String(cell(s,2,23));
  const isOld = /zone/i.test(oldTitle) && norm(cell(s,5,18)) === 'transportation';
  if (!isNew && !isOld) throw new Error('Unsupported layout. Use Draft - AI or a supported month from May 2026 onward.');
  const period = periodFromTitle(s.title);
  const preview = s.title === 'Draft - AI';
  if (!preview && !period) throw new Error('This tab is not a supported budget month.');
  const sections = [
    section(s,'utilities',{name:2,cost:3,paid:4,date:5},'Utilities'),
    section(s,'entertainment',{name:7,cost:8,paid:9,date:10},'Entertainment'),
    section(s,'debt',{name:12,cost:13,balance:14,paid:15,date:16},'Debt'),
    section(s,'transportation',isNew ? {name:12,cost:13,balance:14,paid:15,date:16} : {name:18,cost:19,paid:20,date:21},'Transportation'),
    section(s,'personal',isNew ? {name:19,cost:21,balance:22,paid:23,date:24} : {name:23,cost:25,balance:26,paid:27,date:28},isNew ? 'Personal Zone - User 1' : oldTitle,'user1')
  ];
  if (isNew) sections.push(section(s,'personal',{name:26,cost:28,balance:29,paid:30,date:31},'Personal Zone - User 2','user2'));
  const nameCol = isNew ? 7 : 12, contributionCol = isNew ? 9 : 14;
  const monthly = findRow(s,nameCol,'Income - Monthly'), half = findRow(s,nameCol,'Income - Biweekly');
  const people = [0,1].map(i => {
    const row = monthly + 1 + i, halfRow = half + 1 + i;
    const name = String(cell(s,row,nameCol)).trim();
    if (!name || norm(name) === 'total') throw new Error('Both income rows need person names.');
    return { id: `user${i+1}`, name, monthlyIncome: amount(cell(s,row,nameCol+1),`${name} monthly income`), halfIncome: amount(cell(s,halfRow,nameCol),`${name} half-month income`), contribution: amount(cell(s,row,contributionCol),`${name} contribution`), refs: { monthly:address(row,nameCol+1), half:address(halfRow,nameCol), contribution:address(row,contributionCol), cash:address(halfRow,contributionCol) } };
  });
  return { id:s.id, title:s.title, period, preview, layout:isNew ? 'draft-ai' : 'legacy-2026', sections, bills:sections.flatMap(x=>x.bills), people, source:s, income:{monthly,half,nameCol,contributionCol} };
}
