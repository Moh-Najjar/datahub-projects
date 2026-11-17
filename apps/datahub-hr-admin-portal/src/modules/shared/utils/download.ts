/** Saves text as a file in the browser (CSV exports). Nothing is uploaded or stored. */
export function downloadText(fileName: string, content: string, type = 'text/csv;charset=utf-8') {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
