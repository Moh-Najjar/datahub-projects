import { useId, useRef, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import EastIcon from '@mui/icons-material/East';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useInView } from 'framer-motion';
import { AutoCarousel } from '@/shared/components/ui/AutoCarousel';
import { Reveal } from '@/shared/components/ui/Reveal';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import { useCountUp } from '@/shared/hooks/useCountUp';
import type { Block, Node, Responsive } from '@/types/blocks';
import { mergeSx, rsx } from '../responsive';
import { NodeRenderer } from '../NodeRenderer';

type BlockOf<K extends Block['kind']> = Extract<Block, { kind: K }>;

/** Number of grid columns per breakpoint from a captured `gridTemplateColumns` count. */
const gridColumns = (r: Responsive) => {
  const s = rsx({ xl: { c: r.xl.gridTemplateColumns ?? '1' }, md: r.md && { c: r.md.gridTemplateColumns ?? r.xl.gridTemplateColumns ?? '1' }, xs: r.xs && { c: r.xs.gridTemplateColumns ?? '1' } }).c;
  const toTpl = (n: unknown) => `repeat(${Number(n) || 1}, minmax(0, 1fr))`;
  if (s && typeof s === 'object') return Object.fromEntries(Object.entries(s).map(([bp, n]) => [bp, toTpl(n)]));
  return toTpl(s);
};

/* ------------------------------------------------------------------- lists */

export function ListBlock({ block }: { block: BlockOf<'list'> }) {
  const numbered = block.variant.startsWith('auto-numbered');
  const big = block.variant === 'check-02';
  const columns = block.columns && Number(block.columns.xl.gridTemplateColumns ?? 1) > 1 ? block.columns : undefined;
  return (
    <Box
      component="ul"
      sx={mergeSx(
        rsx(block.style),
        columns && { display: 'grid', gridTemplateColumns: gridColumns(columns), columnGap: columns.xl.columnGap ?? '30px', rowGap: columns.xl.rowGap ?? '0px' },
      )}
    >
      {block.items.map((item, i) => {
        const marker = numbered ? (
          <Box sx={mergeSx({ minWidth: 45, mr: '10px', color: 'brand.footerLink', fontSize: 24, fontWeight: 800, lineHeight: 1.2 }, rsx(block.parts.marker))}>
            {item.number ?? String(i + 1).padStart(2, '0')}
          </Box>
        ) : (
          <CheckIcon aria-hidden sx={{ position: 'absolute', left: 0, top: big ? 2 : 5, fontSize: big ? 26 : 16, color: 'brand.dark' }} />
        );
        const title = item.title && (
          <Box
            component="span"
            sx={mergeSx(
              { display: 'block' },
              rsx(block.parts.title),
              numbered && { position: 'relative', borderTop: '2px solid #ededed', pt: '20px', mt: '14px', pr: '30px' },
            )}
          >
            {item.title}
            {numbered && item.href && <EastIcon aria-hidden sx={{ position: 'absolute', right: 0, top: 24, fontSize: 20, color: 'brand.heading' }} />}
          </Box>
        );
        const body = (
          <>
            {marker}
            <Box sx={{ flex: 1 }}>
              {title}
              {item.text && <Box sx={rsx(block.parts.text)}>{item.text}</Box>}
            </Box>
          </>
        );
        return (
          <Reveal as="li" key={`${item.title}-${i}`}>
            <Box sx={mergeSx({ position: 'relative', display: 'flex', pl: numbered ? 0 : big ? '40px' : '32px' }, rsx(block.parts.item))}>
              {item.href ? (
                <Box component={SmartLink} href={item.href} sx={{ display: 'flex', flex: 1, color: 'inherit', '&:hover': { color: 'info.main' } }}>
                  {body}
                </Box>
              ) : (
                body
              )}
            </Box>
          </Reveal>
        );
      })}
    </Box>
  );
}

/* --------------------------------------------------------------- accordion */

export function AccordionBlock({ block }: { block: BlockOf<'accordion'> }) {
  const [open, setOpen] = useState<number | false>(0);
  return (
    <Box sx={rsx(block.style)}>
      {block.items.map((item, i) => (
        <Accordion
          key={item.title}
          disableGutters
          expanded={open === i}
          onChange={(_, expanded) => setOpen(expanded ? i : false)}
          sx={{
            '&::before': { display: 'none' },
            mt: i ? '20px' : 0,
            borderRadius: '5px !important',
            overflow: 'hidden',
            boxShadow: 'none',
            transition: 'box-shadow .3s',
            '&.Mui-expanded, &:hover': { boxShadow: '0 18px 40px rgba(51,51,51,.1)' },
          }}
        >
          <AccordionSummary
            expandIcon={<KeyboardArrowDownIcon />}
            sx={{
              minHeight: 0,
              px: '30px',
              py: '18px',
              border: '1px solid #ededed',
              borderRadius: '5px',
              color: 'brand.heading',
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.23,
              transition: 'all .3s',
              '& .MuiAccordionSummary-content': { m: 0 },
              '&.Mui-expanded': { borderRadius: '5px 5px 0 0' },
              '&.Mui-expanded, &:hover': { color: 'common.white', bgcolor: 'brand.dark', borderColor: 'transparent', '& .MuiSvgIcon-root': { color: 'common.white' } },
            }}
          >
            {item.title}
          </AccordionSummary>
          <AccordionDetails sx={{ p: '23px 30px 29px', '& p + p': { mt: '1em' }, '& ul': { listStyle: 'disc', pl: '20px' } }}>
            <Box dangerouslySetInnerHTML={{ __html: item.html }} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

/* -------------------------------------------------------------------- tabs */

export function TabsBlock({ block }: { block: BlockOf<'tabs'> }) {
  const [active, setActive] = useState(0);
  const uid = useId();
  const current = block.tabs[active];
  return (
    <Box>
      <Tabs
        value={active}
        onChange={(_, v: number) => setActive(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        slotProps={{ indicator: { sx: { display: 'none' } }, list: { sx: { gap: '30px' } } }}
      >
        {block.tabs.map((t, i) => (
          <Tab
            key={t.title}
            label={t.title}
            id={`${uid}-t${i}`}
            aria-controls={`${uid}-p${i}`}
            sx={{
              minHeight: 60,
              p: '21px 30px 19px',
              border: '1px solid #ededed',
              borderRadius: '5px',
              color: 'text.primary',
              fontSize: 13,
              fontWeight: 500,
              textTransform: 'uppercase',
              '&.Mui-selected': { color: 'common.white', borderColor: 'brand.dark', backgroundImage: (th: Theme) => th.palette.brand.gradient },
            }}
          />
        ))}
      </Tabs>
      {current && (
        <Box role="tabpanel" id={`${uid}-p${active}`} aria-labelledby={`${uid}-t${active}`} sx={{ pt: '40px' }}>
          {current.children.map((n: Node, i: number) => (
            <NodeRenderer key={i} node={n} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ------------------------------------------------------ grids and sliders */

export function GridBlock({ block }: { block: BlockOf<'grid'> }) {
  return (
    <Box
      sx={mergeSx(
        { display: 'grid', gridTemplateColumns: gridColumns(block.columns) },
        rsx({ xl: { columnGap: block.gap.xl.columnGap ?? '30px', rowGap: block.gap.xl.rowGap ?? '30px' } }),
      )}
    >
      {block.children.map((child, i) => (
        <NodeRenderer key={i} node={child} />
      ))}
    </Box>
  );
}

export function SliderBlock({ block }: { block: BlockOf<'slider'> }) {
  return (
    <AutoCarousel
      label="Slider"
      items={block.children}
      getKey={(_, i) => String(i)}
      perView={block.perView}
      delay={block.autoplay || 5000}
      speed={500}
      align="stretch"
      renderItem={(child) => <NodeRenderer node={child} />}
    />
  );
}

export function GalleryBlock({ block }: { block: BlockOf<'gallery'> }) {
  return (
    <Box
      component="ul"
      sx={{ display: 'grid', gridTemplateColumns: gridColumns(block.columns), gap: block.gap.xl.columnGap ?? '30px', alignItems: 'center', justifyItems: 'center' }}
    >
      {block.images.map((img) => (
        <Reveal as="li" key={img.src}>
          <Box component="img" src={img.src} alt={img.alt} width={img.width || undefined} height={img.height || undefined} loading="lazy" decoding="async" sx={{ maxWidth: '100%', height: 'auto' }} />
        </Reveal>
      ))}
    </Box>
  );
}

export function ClientsBlock({ block }: { block: BlockOf<'clients'> }) {
  return (
    <AutoCarousel
      label="Clients"
      items={block.images}
      getKey={(img) => img.src}
      perView={block.perView}
      delay={block.autoplay || 1000}
      renderItem={(img) => (
        <Box
          component="img"
          src={img.src}
          alt={img.alt}
          width={img.width || undefined}
          height={img.height || undefined}
          loading="lazy"
          decoding="async"
          sx={{ display: 'block', width: 'auto', maxWidth: '100%', maxHeight: 155, height: 'auto', mx: 'auto', transition: 'transform .3s', '&:hover': { transform: 'scale(1.1)' } }}
        />
      )}
    />
  );
}

/* ------------------------------------------------------------ data widgets */

export function CounterBlock({ block }: { block: BlockOf<'counter'> }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const value = useCountUp(block.value, inView);
  return (
    <Box ref={ref} sx={{ textAlign: 'center' }}>
      <Box aria-label={`${block.prefix}${block.value}${block.suffix}`} sx={mergeSx({ display: 'flex', justifyContent: 'center', direction: 'ltr' }, rsx(block.parts.number))}>
        <span aria-hidden="true">
          {block.prefix}
          {value}
          {block.suffix}
        </span>
      </Box>
      <Box component="h5" sx={mergeSx({ m: 0 }, rsx(block.parts.label))}>
        {block.label}
      </Box>
    </Box>
  );
}

/** "tm-gradation": numbered process steps joined by a line (horizontal on desktop). */
export function GradationBlock({ block }: { block: BlockOf<'gradation'> }) {
  return (
    <Box component="ol" sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: { xs: '30px', lg: 0 } }}>
      {block.items.map((item, i) => (
        <Reveal as="li" key={item.heading} delay={i * 0.1} style={{ flex: 1 }}>
          <Box sx={{ position: 'relative', display: { xs: 'flex', lg: 'block' }, gap: '20px', px: { lg: '15px' } }}>
            {i < block.items.length - 1 && (
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  zIndex: 0,
                  bgcolor: '#ededed',
                  ...{ top: { xs: 48, lg: 24 }, left: { xs: 24, lg: 15 }, width: { xs: '1px', lg: '100%' }, height: { xs: 'calc(100% - 18px)', lg: '1px' } },
                }}
              />
            )}
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                flexShrink: 0,
                width: 48,
                height: 48,
                mb: { lg: '56px' },
                border: '2px solid #e8e8e8',
                borderRadius: '50%',
                bgcolor: 'common.white',
                color: 'brand.dark',
                fontSize: 18,
                lineHeight: '44px',
                textAlign: 'center',
                transition: 'all .3s',
                'li:hover &': { color: 'common.white', bgcolor: 'brand.dark', borderColor: 'brand.dark' },
              }}
            >
              {/* The original renders plain step numbers ("1", not "01"). */}
              {i + 1}
            </Box>
            <Box>
              <Box component="h6" sx={mergeSx({ m: 0, fontSize: 18, fontWeight: 500, lineHeight: 1.23, color: 'brand.heading' }, rsx(block.parts.heading))}>
                {item.heading}
              </Box>
              <Box sx={mergeSx({ mt: '14px' }, rsx(block.parts.text))}>{item.text}</Box>
            </Box>
          </Box>
        </Reveal>
      ))}
    </Box>
  );
}
