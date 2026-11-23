import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useBlocker } from 'react-router-dom';
import type { BlogTerm } from '@/core/types/blog';
import { isBlogConflict, isDuplicateSlug, validationErrorsOf } from '@/core/hooks/useAdminBlogs';
import { useBlogCategories, useBlogTags } from '@/core/hooks/useBlogs';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { blogPostSchema, fieldOfApiMessage, type BlogPostFormValues } from '@/modules/admin/schemas/blogPostSchema';
import { adminErrorMessage } from '@/modules/admin/utils/apiErrors';
import { slugify } from '@/modules/admin/utils/slug';
import { ConfirmDialog } from './ConfirmDialog';
import { CoverField } from './CoverField';
import { RichTextEditor } from './RichTextEditor';
import { TaxonomyField } from './TaxonomyField';

const F = ADMIN_TEXT.fields;
const V = ADMIN_TEXT.validation;
const E = ADMIN_TEXT.editor;

/** The version of the post the form was opened with (editing): id, `rowVersion` and status. */
export interface BlogFormBase {
  id: string;
  rowVersion: string;
  status: string;
}

/** Shown on the post list once the post is saved. */
export interface SavedNotice {
  text: string;
  severity: 'success' | 'warning';
}

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
  /** Whether the user may publish / unpublish (`cms.blogs.publish`): otherwise the status cannot be changed. */
  canPublish: boolean;
  /** Editing: the post as loaded. Captured once, so saving always sends the version the user started from. */
  base?: BlogFormBase;
  /** Saves the post (backend) and returns the confirmation to show; throws the API error otherwise. */
  onSubmit: (values: BlogPostFormValues, base: BlogFormBase | undefined) => Promise<SavedNotice>;
  /** Called once the post is saved (the unsaved-changes guard is off by then). */
  onSaved: (notice: SavedNotice) => void;
  onCancel: () => void;
  /** Editing: the post's current categories and tags (names shown before the lists have loaded). */
  terms?: { categories: readonly BlogTerm[]; tags: readonly BlogTerm[] };
  /** Editing: discard the form and load the post's latest version (after a concurrency conflict). */
  onReloadLatest?: () => void;
}

/** Create / edit form of a blog post. */
export function BlogForm({ defaultValues, isNew, canPublish, base, terms, onSubmit, onSaved, onCancel, onReloadLatest }: BlogFormProps) {
  const categories = useBlogCategories();
  const tags = useBlogTags();
  // Never updated by later reads of the post: a newer rowVersion must come from "Load the latest version" (new form).
  const [loadedBase] = useState(base);
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  // New posts: the slug follows the title until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(!isNew);
  /** Confirmation of a completed save: leaving is allowed from then on. */
  const [savedNotice, setSavedNotice] = useState<SavedNotice | null>(null);
  const { control, register, handleSubmit, formState, setValue, setError, getFieldState } = useForm<BlogPostFormValues>({
    resolver: zodResolver(blogPostSchema),
    defaultValues,
  });
  const slug = useWatch({ control, name: 'slug' });
  const status = useWatch({ control, name: 'status' });

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
    setConflict(false);
    try {
      setSavedNotice(await onSubmit(values, loadedBase));
    } catch (e) {
      if (isBlogConflict(e)) return setConflict(true);
      if (isDuplicateSlug(e)) return setError('slug', { message: V.slugTaken }, { shouldFocus: true });
      const fieldErrors = validationErrorsOf(e);
      if (fieldErrors.length > 0) {
        const unmatched: string[] = [];
        let focused = false;
        for (const { description } of fieldErrors) {
          const field = fieldOfApiMessage(description);
          if (field) {
            setError(field, { message: description }, { shouldFocus: !focused });
            focused = true;
          } else unmatched.push(description);
        }
        if (unmatched.length > 0) setFormError(unmatched.join(' '));
        return;
      }
      setFormError(adminErrorMessage(e));
    }
  });

  const err = (name: keyof BlogPostFormValues) => getFieldState(name, formState).error?.message;

  return (
    <Box component="form" noValidate onSubmit={submit}>
      {conflict && (
        <Alert severity="warning" sx={{ mb: 3 }} action={onReloadLatest && <Button color="inherit" onClick={onReloadLatest}>{E.reloadLatest}</Button>}>
          {E.conflict}
        </Alert>
      )}
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
          <TextField label={F.excerpt} multiline minRows={2} {...register('excerpt')} error={Boolean(err('excerpt'))} helperText={err('excerpt') ?? F.excerptHelp} />
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
                <TextField select label={F.status} {...field} disabled={!canPublish} helperText={canPublish ? F.statusHelp[status] : V.noPublish}>
                  <MenuItem value="Published">{ADMIN_TEXT.status.published}</MenuItem>
                  <MenuItem value="Draft">{ADMIN_TEXT.status.draft}</MenuItem>
                </TextField>
              )}
            />
            <Typography variant="body2" color="text.secondary">
              {E.notAvailable}
            </Typography>
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
            <Controller
              control={control}
              name="featuredImageUrl"
              render={({ field, fieldState }) => <CoverField value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />}
            />
          </Section>
          <Section title={E.sections.classification}>
            {(categories.isError || tags.isError) && <Alert severity="warning">{F.taxonomyLoadError}</Alert>}
            <Controller
              control={control}
              name="categoryIds"
              render={({ field, fieldState }) => (
                <TaxonomyField label={F.categories} helperText={F.taxonomyHelp} options={categories.data ?? []} known={terms?.categories} loading={categories.isPending} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="tagIds"
              render={({ field, fieldState }) => (
                <TaxonomyField label={F.tags} helperText={F.taxonomyHelp} options={tags.data ?? []} known={terms?.tags} loading={tags.isPending} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
              )}
            />
          </Section>
          <Section title={E.sections.seo}>
            <TextField size="small" label={F.metaTitle} {...register('metaTitle')} error={Boolean(err('metaTitle'))} helperText={err('metaTitle') ?? F.metaTitleHelp} />
            <TextField
              size="small"
              label={F.metaDescription}
              multiline
              minRows={2}
              {...register('metaDescription')}
              error={Boolean(err('metaDescription'))}
              helperText={err('metaDescription') ?? F.metaDescriptionHelp}
            />
            <TextField
              size="small"
              label={F.canonicalUrl}
              {...register('canonicalUrl')}
              error={Boolean(err('canonicalUrl'))}
              helperText={err('canonicalUrl') ?? F.canonicalUrlHelp}
              slotProps={{ htmlInput: { dir: 'ltr', spellCheck: false, inputMode: 'url' } }}
            />
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
