/*
 * Allowlist sanitizer for article HTML written in the admin editor (no dependency: the browser's DOMParser).
 * Keeps the elements the article page styles; unknown elements are unwrapped (their text is kept), dangerous ones
 * are removed with their content, and every attribute not listed is dropped. URLs must be http(s), mailto, tel,
 * site-relative or in-page; images may also be inline PNG/JPEG/WebP/GIF data.
 */

const ALLOWED: Record<string, readonly string[]> = {
  p: [],
  br: [],
  hr: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  code: [],
  pre: [],
  blockquote: [],
  ul: [],
  ol: ['start'],
  li: [],
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'width', 'height', 'title'],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
};

const REMOVE_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'noscript', 'template', 'svg', 'math', 'link', 'meta']);

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const SAFE_IMAGE = /^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp|gif);base64,)/i;

function clean(node: Element) {
  for (const child of [...node.children]) {
    const tag = child.tagName.toLowerCase();
    if (REMOVE_WITH_CONTENT.has(tag)) {
      child.remove();
      continue;
    }
    clean(child);
    const allowed = ALLOWED[tag];
    if (!allowed) {
      child.replaceWith(...child.childNodes); // unwrap, keep the text
      continue;
    }
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const ok =
        allowed.includes(name) &&
        (name !== 'href' || SAFE_LINK.test(value)) &&
        (name !== 'src' || SAFE_IMAGE.test(value)) &&
        (name !== 'target' || value === '_blank');
      if (!ok) child.removeAttribute(attr.name);
    }
    if (tag === 'a' && child.getAttribute('target') === '_blank') child.setAttribute('rel', 'noopener noreferrer');
    if (tag === 'img' && !child.hasAttribute('src')) child.remove();
  }
}

function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

/** Returns safe article HTML. */
export function sanitizeHtml(html: string): string {
  const body = parse(html);
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const c of comments) c.parentNode?.removeChild(c);
  clean(body);
  return body.innerHTML.trim();
}

/** True when the HTML has no visible text and no image. */
export function isEmptyHtml(html: string): boolean {
  const body = parse(html);
  return !body.textContent?.trim() && !body.querySelector('img');
}
