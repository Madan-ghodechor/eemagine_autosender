const XLSX = require('xlsx');
const path = require('path');

/**
 * Parse an uploaded Excel or CSV file into JSON.
 *
 * @param {string} filePath  - Absolute path to the uploaded file
 * @param {string} [sheetName] - Sheet name to read (defaults to first sheet)
 * @returns {{
 *   rows: object[],        - Array of row objects keyed by header names
 *   columns: string[],     - Ordered column names
 *   sheets: string[],      - All sheet names in the workbook
 *   activeSheet: string,   - Sheet name that was actually read
 *   rowCount: number,
 * }}
 */
function parseExcel(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,   // parse dates as JS Date objects
    defval: '',        // empty cells become '' instead of undefined
  });

  const sheets = workbook.SheetNames;
  if (!sheets.length) throw new Error('The workbook contains no sheets.');

  const activeSheet = sheetName && sheets.includes(sheetName)
    ? sheetName
    : sheets[0];

  const worksheet = workbook.Sheets[activeSheet];

  // sheet_to_json with header:1 gives [[row], [row], ...]
  // Using default (object mode) gives [{ col: val }, ...]
  const raw = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,        // format numbers/dates as strings for display consistency
  });

  // Derive columns from the first row's keys (preserves order)
  const columns = raw.length ? Object.keys(raw[0]) : [];

  // Sanitise keys: trim whitespace
  const rows = raw.map((row) => {
    const clean = {};
    for (const key of columns) {
      clean[key.trim()] = row[key] ?? '';
    }
    return clean;
  });

  const cleanColumns = columns.map((c) => c.trim());

  return { rows, columns: cleanColumns, sheets, activeSheet, rowCount: rows.length };
}

/**
 * Convert a flat object array to an XLSX Buffer (for download/export).
 * @param {object[]} rows
 * @returns {Buffer}
 */
function toExcelBuffer(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { parseExcel, toExcelBuffer };
