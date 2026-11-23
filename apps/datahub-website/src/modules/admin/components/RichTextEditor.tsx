import { useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CodeIcon from '@mui/icons-material/Code';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RedoIcon from '@mui/icons-material/Redo';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { articleSx } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { isImageUrl, measureImage, prepareUpload, ImagePrepareError } from '@/modules/admin/utils/image';

const T = ADMIN_TEXT.rte;
const HEADINGS = [2, 3, 4] as const;
const SAFE_LINK = /^(https?:\/\/\S+|mailto:\S+|tel:\S+|\/(?!\/)\S*|#\S*)$/i;

interface RichTextEditorProps {
  id: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  error?: boolean;
  helperText?: ReactNode;
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title={label}>
      <span>
        <ToggleButton
          value={label}
          size="small"
          selected={Boolean(active)}
          disabled={disabled}
          onChange={onClick}
          aria-label={label}
          aria-pressed={active === undefined ? undefined : active}
          sx={{ border: 0, borderRadius: '4px', p: '6px', color: 'brand.heading' }}
        >
          {children}
        </ToggleButton>
      </span>
    </Tooltip>
  );
}

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = editor.getAttributes('link') as { href?: string; target?: string };
  const [href, setHref] = useState(current.href ?? '');
  const [newTab, setNewTab] = useState(current.target === '_blank');
  const [invalid, setInvalid] = useState(false);
  const apply = () => {
    const url = href.trim();
    if (!SAFE_LINK.test(url)) return setInvalid(true);
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: newTab ? '_blank' : null, rel: newTab ? 'noopener noreferrer' : null }).run();
    onClose();
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color: 'brand.heading' }}>{T.linkTitle}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1 }}>
        <TextField
          autoFocus
          margin="dense"
          label={T.linkUrl}
          value={href}
          onChange={(e) => {
            setHref(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), apply())}
          error={invalid}
          helperText={invalid ? T.linkInvalid : T.linkUrlHelp}
          slotProps={{ htmlInput: { dir: 'ltr' } }}
        />
        <FormControlLabel control={<Checkbox checked={newTab} onChange={(e) => setNewTab(e.target.checked)} />} label={T.linkNewTab} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ height: 40, px: 2 }}>
          {T.cancel}
        </Button>
        <Button variant="contained" onClick={apply} sx={{ height: 40, px: 2.5 }}>
          {T.apply}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ImageDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const C = ADMIN_TEXT.image;
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const insert = (image: { src: string; width: number; height: number }) => {
    editor.chain().focus().setImage({ src: image.src, alt: alt.trim(), width: image.width, height: image.height }).run();
    onClose();
  };
  const fromUrl = async () => {
    if (!isImageUrl(src)) return setError(C.invalidUrl);
    setBusy(true);
    try {
      insert(await measureImage(src.trim()));
    } catch {
      setError(C.loadFailed);
    } finally {
      setBusy(false);
    }
  };
  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(undefined);
    try {
      insert(await prepareUpload(f));
    } catch (e) {
      setError(e instanceof ImagePrepareError ? C[e.reason] : C.loadFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: 'brand.heading' }}>{T.imageTitle}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <TextField margin="dense" label={T.imageAlt} value={alt} onChange={(e) => setAlt(e.target.value)} />
        <Box>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void fromFile(e.target.files?.[0])} />
          <Button variant="outlined" onClick={() => file.current?.click()} disabled={busy} sx={{ height: 40, px: 2 }}>
            {busy ? C.processing : C.upload}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            label={C.urlLabel}
            value={src}
            onChange={(e) => {
              setSrc(e.target.value);
              setError(undefined);
            }}
            helperText={C.urlHelp}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <Button variant="contained" onClick={() => void fromUrl()} disabled={busy || !src.trim()} sx={{ height: 56, px: 2, flexShrink: 0 }}>
            {T.insert}
          </Button>
        </Box>
        {error && <FormHelperText error>{error}</FormHelperText>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={{ height: 40, px: 2 }}>
          {T.cancel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Toolbar({ editor, htmlMode, onToggleHtml }: { editor: Editor; htmlMode: boolean; onToggleHtml: () => void }) {
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: HEADINGS.find((level) => e.isActive('heading', { level })) ?? (e.isActive('paragraph') ? 0 : -1),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const off = htmlMode;
  return (
    <Box role="toolbar" aria-label={T.toolbar} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px', p: '6px', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default', borderTopLeftRadius: '10px', borderTopRightRadius: '10px' }}>
      <Select
        size="small"
        value={s.block}
        disabled={off}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) chain().setParagraph().run();
          else if (level > 0) chain().setHeading({ level: level as 2 | 3 | 4 }).run();
        }}
        inputProps={{ 'aria-label': T.blockType }}
        sx={{ minWidth: 136, mr: '6px', height: 34, fontSize: 14, bgcolor: 'common.white' }}
      >
        <MenuItem value={-1} sx={{ display: 'none' }}>
          —
        </MenuItem>
        <MenuItem value={0}>{T.paragraph}</MenuItem>
        {HEADINGS.map((level) => (
          <MenuItem key={level} value={level}>
            {T.heading(level)}
          </MenuItem>
        ))}
      </Select>
      <ToolButton label={T.bold} active={s.bold} disabled={off} onClick={() => chain().toggleBold().run()}>
        <FormatBoldIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.italic} active={s.italic} disabled={off} onClick={() => chain().toggleItalic().run()}>
        <FormatItalicIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.underline} active={s.underline} disabled={off} onClick={() => chain().toggleUnderline().run()}>
        <FormatUnderlinedIcon fontSize="small" />
      </ToolButton>
      <Divider orientation="vertical" flexItem sx={{ mx: '4px' }} />
      <ToolButton label={T.bulletList} active={s.bulletList} disabled={off} onClick={() => chain().toggleBulletList().run()}>
        <FormatListBulletedIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.orderedList} active={s.orderedList} disabled={off} onClick={() => chain().toggleOrderedList().run()}>
        <FormatListNumberedIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.blockquote} active={s.blockquote} disabled={off} onClick={() => chain().toggleBlockquote().run()}>
        <FormatQuoteIcon fontSize="small" />
      </ToolButton>
      <Divider orientation="vertical" flexItem sx={{ mx: '4px' }} />
      <ToolButton label={T.link} active={s.link} disabled={off} onClick={() => setDialog('link')}>
        <InsertLinkIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.unlink} disabled={off || !s.link} onClick={() => chain().extendMarkRange('link').unsetLink().run()}>
        <LinkOffIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.image} disabled={off} onClick={() => setDialog('image')}>
        <ImageOutlinedIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.table} disabled={off || s.table} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableChartOutlinedIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.rule} disabled={off} onClick={() => chain().setHorizontalRule().run()}>
        <HorizontalRuleIcon fontSize="small" />
      </ToolButton>
      {s.table && !off && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', mx: '4px' }}>
          {(
            [
              [T.addRow, () => chain().addRowAfter().run()],
              [T.addColumn, () => chain().addColumnAfter().run()],
              [T.deleteRow, () => chain().deleteRow().run()],
              [T.deleteColumn, () => chain().deleteColumn().run()],
              [T.deleteTable, () => chain().deleteTable().run()],
            ] as const
          ).map(([label, run]) => (
            <Button key={label} size="small" onClick={run} sx={{ height: 30, px: 1, fontSize: 12 }}>
              {label}
            </Button>
          ))}
        </Box>
      )}
      <Divider orientation="vertical" flexItem sx={{ mx: '4px' }} />
      <ToolButton label={T.undo} disabled={off || !s.canUndo} onClick={() => chain().undo().run()}>
        <UndoIcon fontSize="small" />
      </ToolButton>
      <ToolButton label={T.redo} disabled={off || !s.canRedo} onClick={() => chain().redo().run()}>
        <RedoIcon fontSize="small" />
      </ToolButton>
      <Box sx={{ ml: 'auto' }}>
        <Button size="small" startIcon={<CodeIcon />} onClick={onToggleHtml} aria-pressed={htmlMode} sx={{ height: 32, px: 1.5 }}>
          {htmlMode ? T.visual : T.html}
        </Button>
      </Box>
      {dialog === 'link' && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
      {dialog === 'image' && <ImageDialog editor={editor} onClose={() => setDialog(null)} />}
    </Box>
  );
}

/**
 * Article editor (headings, paragraphs, lists, quotes, links, images, tables). The editing area uses the article
 * page's own typography, so what you see is how the post looks on the website. "Edit HTML" shows the source.
 */
export function RichTextEditor({ id, label, value, onChange, onBlur, error, helperText }: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4, 5, 6] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value,
    immediatelyRender: true,
    editorProps: { attributes: { id, 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', ...(error ? { 'aria-invalid': 'true' } : {}) } },
    // Always the editor's own HTML (an empty heading is still content being written); the form's schema decides
    // what counts as an empty article.
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    onBlur: () => onBlur?.(),
  });

  // Keep the visual editor in sync when the value is replaced from outside (e.g. after editing the HTML source).
  const lastValue = useRef(value);
  useEffect(() => {
    if (htmlMode || value === lastValue.current) return;
    lastValue.current = value;
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, htmlMode, editor]);

  return (
    <Box>
      <Typography component="label" htmlFor={id} sx={{ display: 'block', mb: '6px', fontWeight: 500, color: error ? 'error.main' : 'brand.heading' }}>
        {label} *
      </Typography>
      <Box sx={{ border: '1px solid', borderColor: error ? 'error.main' : 'divider', borderRadius: '10px', bgcolor: 'background.paper', '&:focus-within': { borderColor: error ? 'error.main' : 'primary.main', boxShadow: (theme) => `0 0 0 1px ${error ? theme.palette.error.main : theme.palette.primary.main}` } }}>
        <Toolbar
          editor={editor}
          htmlMode={htmlMode}
          onToggleHtml={() => {
            if (htmlMode) editor.commands.setContent(value, { emitUpdate: false });
            lastValue.current = value;
            setHtmlMode((m) => !m);
          }}
        />
        {htmlMode ? (
          <Box sx={{ p: '12px', color: 'text.primary' }}>
            <TextField
              fullWidth
              multiline
              minRows={18}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              helperText={T.htmlHelp}
              slotProps={{ htmlInput: { 'aria-label': `${label} (HTML)`, dir: 'ltr', spellCheck: false, style: { fontFamily: 'Consolas, Menlo, monospace', fontSize: 13, lineHeight: 1.6 } } }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              color: 'text.primary',
              '& .ProseMirror': { minHeight: 420, p: { xs: '16px', md: '24px 32px' }, outline: 'none', ...articleSx },
              '& .ProseMirror > :first-of-type': { mt: 0 },
              '& .ProseMirror img.ProseMirror-selectednode': { outline: '3px solid', outlineColor: 'info.main' },
              '& .ProseMirror .selectedCell': { bgcolor: 'rgba(8,106,216,.08)' },
              '& .ProseMirror .tableWrapper': { overflowX: 'auto' },
              '& .ProseMirror p.is-editor-empty:first-of-type::before': { content: 'attr(data-placeholder)', color: 'text.disabled', float: 'left', height: 0, pointerEvents: 'none' },
            }}
          >
            <EditorContent editor={editor} />
          </Box>
        )}
      </Box>
      {helperText && (
        <FormHelperText error={error} sx={{ mx: '14px' }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
}
