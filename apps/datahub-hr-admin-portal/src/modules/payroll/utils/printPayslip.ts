/**
 * Opens the browser's print dialog for a standalone document (the payslip), from a hidden frame. The user chooses
 * "Save as PDF" there; the document title (the payslip number) becomes the suggested file name. The browser lays out
 * Arabic text and right-to-left pages itself, so the PDF is correct in both directions. Nothing is uploaded or stored.
 * Returns false when printing is unavailable (e.g. tests, very old browsers).
 */
export function printDocument(title: string, bodyHtml: string, language: 'en' | 'ar'): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = title;
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', inset: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win || typeof win.print !== 'function') {
    frame.remove();
    return false;
  }
  const escaped = title.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  doc.open();
  doc.write(
    `<!doctype html><html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escaped}</title>` +
      '<style>@page{size:A4;margin:12mm}html,body{margin:0;background:#fff}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}article{max-width:none!important;padding:0!important}</style>' +
      `</head><body>${bodyHtml}</body></html>`,
  );
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', cleanup, { once: true });
  try {
    win.focus();
    win.print();
  } catch {
    frame.remove();
    return false;
  }
  // Some browsers never fire `afterprint`; remove the frame later anyway.
  setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  return true;
}
