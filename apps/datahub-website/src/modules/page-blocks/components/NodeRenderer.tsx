import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { BlogGrid } from '@/modules/blog';
import type { ColumnNode, ColumnWidths, Node, RowNode } from '@/modules/page-blocks/types/blocks';
import { mergeSx, rsx } from '@/modules/page-blocks/utils/responsive';
import { ButtonsBlock, HeadingBlock, HtmlBlock, ImageBlock, SeparatorBlock, SpacerBlock, TextBlock } from '@/modules/page-blocks/components/widgets/Basic';
import { BoxBlock } from '@/modules/page-blocks/components/widgets/Boxes';
import { AccordionBlock, ClientsBlock, CounterBlock, GalleryBlock, GradationBlock, GridBlock, ListBlock, SliderBlock, TabsBlock } from '@/modules/page-blocks/components/widgets/Collections';
import { ContactFormBlock, MapBlock, VideoBlock } from '@/modules/page-blocks/components/widgets/Embeds';

/** 12-column widths → CSS widths per MUI breakpoint (WPBakery sm/md/lg = 768/992/1200). */
function columnSx(width: ColumnWidths, offset?: ColumnWidths) {
  const pct = (n: number) => `${(n / 12) * 100}%`;
  const order = ['xs', 'md', 'lg', 'xl'] as const;
  const flexBasis: Record<string, string> = {};
  const marginLeft: Record<string, string> = {};
  let w: number | undefined = 12;
  let o: number | undefined = 0;
  for (const bp of order) {
    w = width[bp] ?? w;
    o = offset?.[bp] ?? o;
    flexBasis[bp] = pct(w ?? 12);
    marginLeft[bp] = pct(o ?? 0);
  }
  return { flex: '0 0 auto', width: flexBasis, maxWidth: flexBasis, ml: marginLeft };
}

function Column({ column, align }: { column: ColumnNode; align?: RowNode['align'] }) {
  return (
    <Box sx={mergeSx(columnSx(column.width, column.offset), { minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: align === 'middle' ? 'center' : align === 'bottom' ? 'flex-end' : 'flex-start' })}>
      <Box sx={mergeSx({ position: 'relative', height: align === 'stretch' ? '100%' : undefined }, rsx(column.style))}>
        {column.children.map((child, i) => (
          <NodeRenderer key={i} node={child} />
        ))}
      </Box>
    </Box>
  );
}

function Separator({ sep }: { sep: RowNode['separators'][number] }) {
  return (
    <Box
      component="svg"
      aria-hidden
      focusable="false"
      viewBox={sep.viewBox}
      preserveAspectRatio="none"
      sx={mergeSx(
        {
          position: 'absolute',
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 1,
          fill: sep.color,
          pointerEvents: 'none',
          [sep.position]: 0,
          transform: [sep.position === 'top' && 'rotate(180deg)', sep.flip && 'scaleX(-1)'].filter(Boolean).join(' ') || undefined,
        },
        rsx(sep.height),
      )}
    >
      {sep.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </Box>
  );
}

/** A WPBakery row: background, overlay, separators and a 12-column flex grid. */
export function Row({ row, nested = false }: { row: RowNode; nested?: boolean }) {
  const columns = (
    <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', mx: '-15px', alignItems: row.align === 'stretch' ? 'stretch' : undefined }}>
      {row.columns.map((col, i) => (
        <Column key={i} column={col} align={row.align} />
      ))}
    </Box>
  );
  return (
    <Box
      component={nested ? 'div' : 'section'}
      id={row.anchor}
      sx={mergeSx(
        { position: 'relative' },
        rsx(row.style),
        { backgroundAttachment: { xs: 'scroll', lg: row.style.xl.backgroundAttachment ?? 'scroll' } },
        row.halfBg && { '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: 0, width: { xs: '100%', lg: '48%' }, bgcolor: 'brand.bgPanel' } },
      )}
    >
      {row.overlay && <Box aria-hidden sx={mergeSx({ position: 'absolute', inset: 0 }, rsx(row.overlay))} />}
      {nested || row.stretchContent ? columns : <Container sx={{ position: 'relative', zIndex: 2 }}>{columns}</Container>}
      {row.separators.map((sep, i) => (
        <Separator key={i} sep={sep} />
      ))}
    </Box>
  );
}

/** Renders any node of a page document. */
export function NodeRenderer({ node }: { node: Node }) {
  switch (node.kind) {
    case 'row':
      return <Row row={node} nested />;
    case 'spacer':
      return <SpacerBlock block={node} />;
    case 'heading':
      return <HeadingBlock block={node} />;
    case 'text':
      return <TextBlock block={node} />;
    case 'buttons':
      return <ButtonsBlock block={node} />;
    case 'image':
      return <ImageBlock block={node} />;
    case 'box':
      return <BoxBlock block={node} />;
    case 'list':
      return <ListBlock block={node} />;
    case 'accordion':
      return <AccordionBlock block={node} />;
    case 'tabs':
      return <TabsBlock block={node} />;
    case 'counter':
      return <CounterBlock block={node} />;
    case 'grid':
      return <GridBlock block={node} />;
    case 'slider':
      return <SliderBlock block={node} />;
    case 'gallery':
      return <GalleryBlock block={node} />;
    case 'clients':
      return <ClientsBlock block={node} />;
    case 'video':
      return <VideoBlock block={node} />;
    case 'gradation':
      return <GradationBlock block={node} />;
    case 'separator':
      return <SeparatorBlock block={node} />;
    case 'contactForm':
      return <ContactFormBlock block={node} />;
    case 'map':
      return <MapBlock block={node} />;
    case 'html':
      return <HtmlBlock block={node} />;
    case 'blogGrid':
      return <BlogGrid />;
  }
}
