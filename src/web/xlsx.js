// Minimal .xlsx writer for the web app (no dependency): one sheet, a bold frozen header row, column widths, and
// typed cells — numbers stay numbers (sum/sort in Excel), dates are real Excel dates, text is text.
// An .xlsx file is a zip of a few XML files; they are stored uncompressed, which every spreadsheet app reads.
//
//   downloadXlsx('investors.xlsx', 'Investors', [{ label: 'Name', width: 28 }, { label: 'Value', type: 'money' }], rows)
//   column type: 'text' (default) | 'number' | 'money' (₹ #,##,##0.00) | 'date' (a Date, ISO string or yyyy-mm-dd)

const enc = new TextEncoder();
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files) {   // files: [{ name, data: Uint8Array }] → Uint8Array (stored, no compression)
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(8, 0, true);
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true); local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, size, true); cen.setUint32(24, size, true); cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + size;
  }
  const cenSize = central.reduce((t, p) => t + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((t, p) => t + p.length, 0)); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
// Excel date serial (days since 1899-12-30), for a Date or a yyyy-mm-dd / ISO string; null when not a date
function serial(v) {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v + 'T00:00:00Z' : v);
  if (isNaN(+d)) return null;
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}
const STYLE = { text: 0, header: 1, money: 2, date: 3, number: 4 };

export function buildXlsx(sheetName, columns, rows) {
  const xmlRows = [];
  xmlRows.push(`<row r="1">${columns.map((c, i) => `<c r="${colName(i)}1" t="inlineStr" s="${STYLE.header}"><is><t>${esc(c.label)}</t></is></c>`).join('')}</row>`);
  rows.forEach((row, ri) => {
    const r = ri + 2;
    const cells = columns.map((c, i) => {
      const v = row[i], ref = colName(i) + r, type = c.type || 'text';
      if (v == null || v === '') return '';
      if (type === 'number' || type === 'money') { const n = Number(v); return Number.isFinite(n) ? `<c r="${ref}" s="${STYLE[type]}"><v>${n}</v></c>` : ''; }
      if (type === 'date') { const n = serial(v); return n == null ? '' : `<c r="${ref}" s="${STYLE.date}"><v>${n}</v></c>`; }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    xmlRows.push(`<row r="${r}">${cells}</row>`);
  });
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`).join('');
  const last = colName(columns.length - 1) + (rows.length + 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols><sheetData>${xmlRows.join('')}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;₹&quot;#,##,##0.00"/><numFmt numFmtId="165" formatCode="dd mmm yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFECD3"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf numFmtId="3" applyNumberFormat="1"/></cellXfs>
</styleSheet>`;
  const name = esc(String(sheetName || 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name}'!$A$1:$${colName(columns.length - 1)}$${rows.length + 1}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/styles.xml': styles,
  };
  return zip(Object.entries(files).map(([n, t]) => ({ name: n, data: enc.encode(t) })));
}

export function downloadXlsx(filename, sheetName, columns, rows) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([buildXlsx(sheetName, columns, rows)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
