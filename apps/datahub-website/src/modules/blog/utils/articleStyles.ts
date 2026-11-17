/** Typography for the article body (WordPress content styles of the original theme). */
export const articleSx = {
  '& p': { mb: '1.5em' },
  '& h2': { mt: '40px', mb: '18px', fontSize: { xs: 30, md: 42 }, lineHeight: 1.42, color: 'brand.heading' },
  '& h3': { mt: '32px', mb: '18px', fontSize: { xs: 24, md: 32 }, lineHeight: 1.42, color: 'brand.heading' },
  '& h4, & h5, & h6': { mt: '24px', mb: '14px', color: 'brand.heading' },
  '& ul': { listStyle: 'disc', pl: '20px', mb: '1.5em' },
  '& ol': { listStyle: 'decimal', pl: '20px', mb: '1.5em' },
  '& li': { mb: '8px' },
  '& strong, & b': { color: 'brand.heading' },
  '& a': { color: 'info.main', textDecoration: 'underline' },
  '& blockquote': { m: '30px 0', pl: '20px', borderLeft: '4px solid', borderColor: 'info.main', fontSize: 18, color: 'brand.heading' },
  '& img': { maxWidth: '100%', height: 'auto', borderRadius: '5px' },
  '& table': { width: '100%', mb: '1.5em', borderCollapse: 'collapse' },
  '& th, & td': { p: '10px', border: '1px solid #ededed', textAlign: 'left' },
  '& hr': { my: '30px', border: 0, borderTop: '1px solid #ededed' },
} as const;
