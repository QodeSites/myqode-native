// Saving an HTML page as a PDF, shared by the partner screens (statement, invoice) and the client reports.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { storeGet, storeSet, storeDel } from '../api/session';
import { withPdfFonts } from '../pdfFonts';
import { track } from '../api/track';

import { userMessage } from '../errors';
// Statement / invoice PDF: render → give it a readable name → share sheet (save to Files / Drive, send by mail…).
// If rendering or sharing fails, fall back to the phone's print screen, which always offers "Save as PDF".
// Throws only when both fail, so the screen can say so instead of doing nothing.
// Saves an HTML page as a named PDF.
//   Android: written straight into a folder the partner picks once (Downloads, say) — remembered, so later saves
//            are silent and the app never hands over to another app. Returns { savedTo: 'Download' }.
//   iOS:     the share sheet ("Save to Files" is a pop-up over the app, so it returns by itself).
//   { share: true } opens the share sheet on either platform (to send the PDF on).
//   · One PDF job at a time (a module-wide lock): a second tap while one runs is ignored, not re-rendered.
//   · The same page is rendered once: an unchanged statement or invoice reuses the file already made.
//   · Only a failure to CREATE the PDF falls back to the system print dialog; a share-sheet problem does not.
const PDF_DIR_KEY = 'myqode.partner.pdfDir';
let pdfJob = null;
const pdfMade = new Map();   // html → file uri (this session)
const folderName = dirUri => { const tail = decodeURIComponent(String(dirUri)).split(/[:/]/).filter(Boolean).pop(); return tail || 'your folder'; };
async function makePdf(html, safe, landscape = false) {
  let out = pdfMade.get(html);
  if (out && Platform.OS !== 'web') {
    const info = await FileSystem.getInfoAsync(out).catch(() => null);
    if (!info || !info.exists) out = null;
  }
  if (out) return out;
  // A4 on both platforms. iOS ignores the page's own @page size and margins (it prints US Letter, edge to edge),
  // so it is given the same margins here: the statement's 22 / 24 / 18 mm, in points.
  // iOS lays the page out one CSS pixel per point (a 535 px wide A4 body) where Android and browsers use 96 dpi (about
  // 718 px), so a report sized in points comes out a third larger on iOS and its figures run off the page. Zooming
  // the report by 0.75 gives iOS the same layout width, and the same PDF, as Android.
  if (Platform.OS === 'ios' && html.includes('data-report')) html = html.replace('</head>', '<style>html{zoom:0.75}</style></head>');
  const { uri } = await Print.printToFileAsync({
    html, width: landscape ? 842 : 595, height: landscape ? 595 : 842,
    ...(Platform.OS === 'ios' ? { margins: landscape ? { top: 30, right: 30, bottom: 34, left: 30 } : (html.includes('data-report') ? { top: 30, right: 30, bottom: 34, left: 30 } : { top: 62, right: 68, bottom: 51, left: 68 }) } : null),
  });
  out = uri;
  if (Platform.OS !== 'web') {
    const named = FileSystem.cacheDirectory + safe + '.pdf';
    await FileSystem.deleteAsync(named, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: named });
    out = named;
  }
  pdfMade.set(html, out);
  return out;
}
async function saveToFolder(file, safe) {
  const SAF = FileSystem.StorageAccessFramework;
  const write = async dir => {
    const target = await SAF.createFileAsync(dir, safe, 'application/pdf');
    const b64 = await FileSystem.readAsStringAsync(file, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 });
    return { savedTo: folderName(dir) };
  };
  const known = await storeGet(PDF_DIR_KEY);
  if (known) {
    try { return await write(known); } catch { await storeDel(PDF_DIR_KEY); }   // folder gone or access revoked: ask again
  }
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return { cancelled: true };
  await storeSet(PDF_DIR_KEY, perm.directoryUri);
  return write(perm.directoryUri);
}
// Web: there is no PDF engine in the browser build (expo-print's web printAsync prints the whole app window), so
// the report's own HTML is printed from a hidden frame. The browser's print dialog offers "Save as PDF", and the
// file name is the report title.
function printHtmlWeb(html, title) {
  return new Promise((resolve, reject) => {
    try {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
      document.body.appendChild(frame);
      const esc = String(title).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
      const doc = frame.contentWindow.document;
      doc.open();
      doc.write(/<head>/i.test(html) ? html.replace(/<head>/i, '<head><title>' + esc + '</title>') : '<title>' + esc + '</title>' + html);
      doc.close();
      const go = () => {
        const prev = document.title;
        document.title = title;   // Chrome and Safari name the saved PDF after the top page's title
        const done = () => { document.title = prev; setTimeout(() => frame.remove(), 500); resolve({}); };
        frame.contentWindow.addEventListener('afterprint', done, { once: true });
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(done, 60000);   // browsers that never fire afterprint
      };
      // Let web fonts and images in the report load before the dialog opens.
      const fonts = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
      Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => setTimeout(go, 150));
    } catch (e) { reject(e); }
  });
}

export async function savePdf(html, fileName, { share = false, landscape = false, source } = {}) {
  if (pdfJob) return pdfJob;
  // Analytics: which document (the file name without its account code, dates or numbers) and from where.
  const kind = String(fileName || '').split(/\s+(?=Q[A-Z]{2}\d|All accounts|\d|FY\b)/)[0].trim() || 'document';
  track('event', 'pdf_download', { kind, source: source || (/^(Fee statement|Invoice)/.test(kind) ? 'distributor' : 'reports') });
  html = withPdfFonts(html);   // Playfair travels inside the HTML: the print engine can't see the app's fonts
  if (Platform.OS === 'web') {
    const safe = String(fileName || 'document').replace(/[^\w .()-]/g, '-').replace(/\s+/g, ' ').trim() || 'document';
    pdfJob = printHtmlWeb(html, safe).finally(() => { pdfJob = null; });
    return pdfJob;
  }
  pdfJob = (async () => {
    const safe = String(fileName || 'document').replace(/[^\w .()-]/g, '-').replace(/\s+/g, ' ').trim() || 'document';
    let out;
    try { out = await makePdf(html, safe, landscape); }
    catch (first) {
      try { await Print.printAsync({ html }); return {}; }
      catch (second) { throw new Error('We couldn’t create the PDF on this phone. ' + ((second && second.message) || (first && first.message) || '')); }
    }
    if (Platform.OS === 'android' && !share) {
      try { return await saveToFolder(out, safe); }
      catch { /* no folder access on this phone: fall through to the share sheet */ }
    }
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) { await Print.printAsync({ uri: out }); return {}; }
    try { await Sharing.shareAsync(out, { mimeType: 'application/pdf', dialogTitle: safe, UTI: 'com.adobe.pdf' }); }
    catch (e) {
      if (/progress|already|another/i.test(String(e && e.message))) return {};   // a sheet still closing — not a failure
      throw new Error('The PDF is ready, but the share sheet could not open. Please try again.');
    }
    return {};
  })().finally(() => { pdfJob = null; });
  return pdfJob;
}
