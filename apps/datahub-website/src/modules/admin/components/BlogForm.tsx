import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useBlocker } from 'react-router-dom';
import { BlogApiError, getTaxonomy, type BlogPostInput } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { blogPostSchema, toInput, type BlogPostFormValues } from '@/modules/admin/schemas/blogPostSchema';
import { slugify } from '@/modules/admin/utils/slug';
import { ConfirmDialog } from './ConfirmDialog';
import { CoverField } from './CoverField';
import { RichTextEditor } from './RichTextEditor';

const F = ADMIN_TEXT.fields;
const V = ADMIN_TEXT.validation;
const E = ADMIN_TEXT.editor;

/** Messages for the reasons returned by the blog service. */
const SERVICE_REASONS: Record<string, string> = {
  required: V.required,
  slugFormat: V.slugFormat,
  slugTaken: V.slugTaken,
  slugReserved: V.slugReserved,
  invalidDate: V.dateRequired,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper component="section" variant="outlined" aria-label={title} sx={{ p: { xs: '16px', md: '20px' }, display: 'grid', gap: '16px', alignContent: 'start' }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', pb: '12px', borderBottom: '1px solid', borderColor: 'divider' }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

interface BlogFormProps {
  defaultValues: BlogPostFormValues;
  isNew: boolean;
  /** Saves the post and returns the confirmation to show; throws `BlogApiError`. */
  onSubmit: (input: BlogPostInput) => Promise<string>;
  /** Called once the post is saved (the unsaved-changes guard is off by then). */
  onSaved: (notice: string) => void;
  onCancel: () => void;
}

/** Create / edit form of a blog post. */
export function BlogForm({ defaultValues, isNew, onSubmit, onSaved, onCancel }: BlogFormProps) {
  const [formError, setFormError] = useState<string>();
  const [taxonomy, setTaxonomy] = useState<{ categories: string[]; tags: string[] }>({ categories: [], tags: [] });
  // New posts: the slug follows the title until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(!isNew);
  /** Confirmation of a completed save: leaving is allowed from then on. */
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const { control, register, handleSubmit, formState, setValue, setError, getFieldState } = useForm<BlogPostFormValues>({
    resolver: zodResolver(blogPostSchema),
    defaultValues,
  });
  const slug = useWatch({ control, name: 'slug' });
  const status = useWatch({ control, name: 'status' });

  useEffect(() => {
    let active = true;
    void getTaxonomy().then((t) => active && setTaxonomy(t));
    return () => {
      active = false;
    };
  }, []);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => formState.isDirty && savedNotice === null && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!formState.isDirty || savedNotice !== null) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formState.isDirty, savedNotice]);

  // Navigate away only after the render in which the guard knows the post is saved.
  useEffect(() => {
    if (savedNotice !== null) onSaved(savedNotice);
  }, [savedNotice, onSaved]);

  const submit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      setSavedNotice(await onSubmit(toInput(values)));
    } catch (e) {
      if (e instanceof BlogApiError && e.code === 'validation' && e.field) {
        setError(e.field as keyof BlogPostFormValues, { message: SERVICE_REASONS[e.reason ?? ''] ?? V.generic }, { shouldFocus: true });
      } else setFormError(e instanceof BlogApiError && e.code === 'storage-full' ? V.storageFull : V.generic);
    }
  });

  const err = (name: keyof BlogPostFormValues) => getFieldState(name, formState).error?.message;

  const taxonomyField = (name: 'categories' | 'tags', label: string, options: string[]) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Autocomplete
          multiple
          freeSolo
          autoSelect
          options={options}
          value={field.value}
          onChange={(_, next) => field.onChange([...new Set(next.map((x) => String(x).trim()).filter(Boolean))])}
          onBlur={field.onBlur}
          renderValue={(selected, getItemProps) => selected.map((option, index) => <Chip size="small" label={option} {...getItemProps({ index })} key={option} />)}
          renderInput={(params) => <TextField {...params} inputRef={field.ref} label={label} helperText={F.taxonomyHelp} />}
        />
      )}
    />
  );

  return (
    <Box component="form" noValidate onSubmit={submit}>
      {formError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {formError}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, gap: 3, alignItems: 'start' }}>
        <Section title={E.sections.content}>
          <TextField
            label={F.title}
            required
            {...register('title', {
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
                // New posts: the slug follows the title until the slug is edited by hand.
                if (!slugTouched) setValue('slug', slugify(e.target.value), { shouldDirty: true });
              },
            })}
            error={Boolean(err('title'))}
            helperText={err('title')}
          />
          <TextField
            label={F.slug}
            required
            {...register('slug', { onChange: () => setSlugTouched(true) })}
            error={Boolean(err('slug'))}
            helperText={err('slug') ?? F.slugHelp(slug)}
            slotProps={{ htmlInput: { dir: 'ltr', spellCheck: false, autoCapitalize: 'none' } }}
          />
          <TextField label={F.excerpt} required multiline minRows={2} {...register('excerpt')} error={Boolean(err('excerpt'))} helperText={err('excerpt') ?? F.excerptHelp} />
          <Controller
            control={control}
            name="html"
            render={({ field, fieldState }) => (
              <RichTextEditor id="post-content" label={F.content} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />
            )}
          />
        </Section>

        <Box sx={{ display: 'grid', gap: 3, position: { lg: 'sticky' }, top: { lg: 84 } }}>
          <Section title={E.sections.publishing}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <TextField select label={F.status} {...field} helperText={F.statusHelp[status]}>
                  <MenuItem value="published">{ADMIN_TEXT.status.published}</MenuItem>
                  <MenuItem value="draft">{ADMIN_TEXT.status.draft}</MenuItem>
                </TextField>
              )}
            />
            <TextField
              label={F.date}
              type="datetime-local"
              required
              {...register('date')}
              error={Boolean(err('date'))}
              helperText={err('date') ?? F.dateHelp}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label={F.author} {...register('author')} error={Boolean(err('author'))} helperText={err('author')} />
            <Box sx={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Button type="submit" variant="contained" disabled={formState.isSubmitting} sx={{ height: 44, px: 3, fontWeight: 500, flex: '1 1 auto' }}>
                {formState.isSubmitting ? E.saving : isNew ? E.create : E.save}
              </Button>
              <Button onClick={onCancel} disabled={formState.isSubmitting} sx={{ height: 44, px: 2 }}>
                {E.cancel}
              </Button>
            </Box>
          </Section>
          <Section title={E.sections.cover}>
            <Controller control={control} name="cover" render={({ field, fieldState }) => <CoverField value={field.value} onChange={field.onChange} altError={fieldState.error?.message} />} />
          </Section>
          <Section title={E.sections.classification}>
            {taxonomyField('categories', F.categories, taxonomy.categories)}
            {taxonomyField('tags', F.tags, taxonomy.tags)}
          </Section>
        </Box>
      </Box>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={E.unsavedTitle}
        text={E.unsavedText}
        confirmLabel={E.leave}
        cancelLabel={E.stay}
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </Box>
  );
}
