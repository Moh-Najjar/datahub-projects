import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverFile, previewTypeOf } from './openFile';

afterEach(() => vi.restoreAllMocks());

describe('showing a stored file', () => {
  it('knows what the browser can display: by type, else by extension', () => {
    expect(previewTypeOf({ fileName: 'a.pdf', contentType: 'application/pdf' })).toBe('application/pdf');
    expect(previewTypeOf({ fileName: 'scan.PNG', contentType: 'application/octet-stream' })).toBe('image/png');
    expect(previewTypeOf({ fileName: 'manual.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBeNull();
    expect(previewTypeOf({ fileName: 'data.zip', contentType: null })).toBeNull();
  });

  it('shows a file in the tab opened during the click, re-typed so the browser displays it', () => {
    let shown: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      shown = blob as Blob;
      return 'blob:shown';
    });
    const tab = { location: { href: '' } } as unknown as Window;
    deliverFile(
      { kind: 'blob', blob: new Blob(['%PDF'], { type: 'application/octet-stream' }), contentType: 'application/octet-stream' },
      { fileName: 'guide.pdf', contentType: 'application/octet-stream' },
      tab,
    );
    expect(tab.location.href).toBe('blob:shown');
    expect(shown!.type).toBe('application/pdf');
  });

  it('saves other files under their original name, and follows a link the API returned', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');
    const clicks: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download });
    });
    deliverFile({ kind: 'blob', blob: new Blob(['x']), contentType: null }, { fileName: 'ASEZA_User_Manual.docx', contentType: 'application/msword' }, null);
    expect(clicks[0]).toEqual({ href: 'blob:file', download: 'ASEZA_User_Manual.docx' });

    const tab = { location: { href: '' } } as unknown as Window;
    deliverFile({ kind: 'url', url: 'https://files.example.test/a.pdf?sig=1' }, { fileName: 'a.pdf', contentType: 'application/pdf' }, tab);
    expect(tab.location.href).toBe('https://files.example.test/a.pdf?sig=1');
  });
});
