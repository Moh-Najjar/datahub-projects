import { useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { arabicInput, latinInput } from '@/modules/shared/formFields';
import { useValidationText } from '@/modules/settings/hooks/useValidationText';
import { CURRENCIES, CURRENCY_DISPLAYS, DATE_FORMATS, LANGUAGES, TIME_FORMATS, TIMEZONES, type GeneralSettings, type LocalizationSettings } from '@/modules/settings/types/settings';
import { FactList } from '../common/Facts';
import { SectionEditor } from '../common/SectionEditor';

/** Text field bound to a (nested) form path, with the translated schema/API reason. */
function useField<V extends FieldValues>(form: UseFormReturn<V>, disabled: boolean) {
  const message = useValidationText();
  return (name: Path<V>, label: string, extra: { helper?: string; arabic?: boolean; latin?: boolean; required?: boolean } = {}) => {
    const { ref, ...rest } = form.register(name);
    const error = form.getFieldState(name, form.formState).error?.message;
    return (
      <TextField
        {...rest}
        inputRef={ref}
        label={label}
        disabled={disabled}
        required={extra.required}
        error={Boolean(error)}
        helperText={message(error) ?? extra.helper}
        fullWidth
        slotProps={extra.arabic ? arabicInput : extra.latin ? latinInput : undefined}
      />
    );
  };
}

const grid = { display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } } as const;
const sectionTitle = (text: string) => (
  <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
    {text}
  </Typography>
);

function GeneralFields({ form, disabled }: { form: UseFormReturn<GeneralSettings & FieldValues>; disabled: boolean }) {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const field = useField(form, disabled);
  const file = useRef<HTMLInputElement>(null);
  const message = useValidationText();
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(FORMAT_LOCALE[language], { month: 'long' }).format(new Date(2026, i, 1)));
  return (
    <>
      {sectionTitle(t('general.identity'))}
      <Box sx={grid}>
        {field('companyName.en', t('general.companyNameEn'), { required: true, latin: true })}
        {field('companyName.ar', t('general.companyNameAr'), { required: true, arabic: true })}
      </Box>
      <Controller
        control={form.control}
        name="logo"
        render={({ field: logo, fieldState }) => (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('general.logo')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
              <ImageOutlined color="action" aria-hidden />
              <Typography variant="body2" dir={logo.value ? 'ltr' : undefined}>
                {logo.value ? `${logo.value.name} (${formatNumber(Math.ceil(logo.value.sizeBytes / 1024), language)} KB)` : t('general.noLogo')}
              </Typography>
              <input
                ref={file}
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // SIMULATED: only the name and size are kept; the file is never read or uploaded.
                  if (f) logo.onChange({ name: f.name, sizeBytes: f.size });
                  e.target.value = '';
                }}
              />
              <Button size="small" variant="outlined" disabled={disabled} onClick={() => file.current?.click()}>
                {t('general.chooseLogo')}
              </Button>
              {logo.value && (
                <Button size="small" color="inherit" disabled={disabled} onClick={() => logo.onChange(null)}>
                  {t('general.removeLogo')}
                </Button>
              )}
            </Box>
            <Typography variant="caption" color={fieldState.error ? 'error' : 'text.secondary'} sx={{ display: 'block', mt: 0.5 }}>
              {message(fieldState.error?.message ?? (fieldState.error as { name?: { message?: string } } | undefined)?.name?.message) ?? t('general.logoHint')}
            </Typography>
          </Box>
        )}
      />
      {sectionTitle(t('general.contact'))}
      <Box sx={grid}>
        {field('contactEmail', t('general.contactEmail'), { required: true, latin: true })}
        {field('contactPhone', t('general.contactPhone'), { required: true, latin: true })}
        {field('address.en', t('general.addressEn'), { required: true, latin: true })}
        {field('address.ar', t('general.addressAr'), { required: true, arabic: true })}
        {field('website', t('general.website'), { latin: true })}
      </Box>
      {sectionTitle(t('general.finance'))}
      <Box sx={grid}>
        <Controller
          control={form.control}
          name="defaultCurrency"
          render={({ field: f }) => (
            <TextField select {...f} label={t('general.defaultCurrency')} helperText={t('general.currencyHint')} disabled={disabled} fullWidth>
              {CURRENCIES.map((c) => (
                <MenuItem key={c} value={c} dir="ltr">
                  {c}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          control={form.control}
          name="fiscalYearStartMonth"
          render={({ field: f }) => (
            <TextField select {...f} onChange={(e) => f.onChange(Number(e.target.value))} label={t('general.fiscalYearStart')} disabled={disabled} fullWidth>
              {months.map((m, i) => (
                <MenuItem key={m} value={i + 1}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Box>
    </>
  );
}

export function GeneralSection({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation('settings');
  return (
    <SectionEditor section="general" title={t('categories.general.title')} subtitle={t('categories.general.description')} readOnly={readOnly}>
      {(form, disabled) => <GeneralFields form={form} disabled={disabled} />}
    </SectionEditor>
  );
}

/* Localisation ------------------------------------------------------------------------------------------------------ */

function LocalizationFields({ form, disabled }: { form: UseFormReturn<LocalizationSettings & FieldValues>; disabled: boolean }) {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const v = form.watch();
  const weekday = (d: number) => new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: 'long' }).format(new Date(2026, 10, 15 + d));
  const select = <K extends keyof LocalizationSettings>(name: K, label: string, options: ReadonlyArray<{ value: LocalizationSettings[K]; label: string }>, numeric = false) => (
    <Controller
      control={form.control}
      name={name as Path<LocalizationSettings & FieldValues>}
      render={({ field: f }) => (
        <TextField select {...f} onChange={(e) => f.onChange(numeric ? Number(e.target.value) : e.target.value)} label={label} disabled={disabled} fullWidth>
          {options.map((o) => (
            <MenuItem key={String(o.value)} value={o.value as string | number}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
  // A fixed sample instant (31 Dec 2026, 17:30) in the chosen time zone and formats.
  const sample = new Date(Date.UTC(2026, 11, 31, 14, 30));
  const time = new Intl.DateTimeFormat(v.defaultLanguage === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { hour: 'numeric', minute: '2-digit', hourCycle: v.timeFormat === '24h' ? 'h23' : 'h12', timeZone: v.timezone }).format(sample);
  return (
    <>
      {sectionTitle(t('localization.languages'))}
      <Typography variant="body2" color="text.secondary">
        {t('localization.languagesValue')}
      </Typography>
      <Box sx={grid}>{select('defaultLanguage', t('localization.defaultLanguage'), LANGUAGES.map((l) => ({ value: l, label: t(`localization.languageNames.${l}`) })))}</Box>
      {sectionTitle(t('localization.formats'))}
      <Box sx={grid}>
        {select('dateFormat', t('localization.dateFormat'), DATE_FORMATS.map((f) => ({ value: f, label: t(`localization.dateFormats.${f}`) })))}
        {select('timeFormat', t('localization.timeFormat'), TIME_FORMATS.map((f) => ({ value: f, label: t(`localization.timeFormats.${f}`) })))}
        {select('currencyDisplay', t('localization.currencyDisplay'), CURRENCY_DISPLAYS.map((f) => ({ value: f, label: t(`localization.currencyDisplays.${f}`) })))}
        {select('weekStart', t('localization.weekStart'), ([6, 0, 1] as const).map((d) => ({ value: d, label: weekday(d) })), true)}
        {select('timezone', t('localization.timezone'), TIMEZONES.map((z) => ({ value: z, label: z })))}
      </Box>
      <FactList
        items={[
          { label: t('localization.numberFormat'), value: t('localization.numberFormatValue') },
          { label: t('localization.preview'), value: <bdi dir="ltr">{`${t(`localization.dateFormats.${v.dateFormat ?? 'dd/mm/yyyy'}`)} · ${time} · ${v.currencyDisplay === 'symbol' ? 'JD' : 'JOD'} 1,250.000`}</bdi> },
        ]}
      />
      <Typography variant="body2" color="text.secondary">
        {t('localization.previewNote')}
      </Typography>
    </>
  );
}

export function LocalizationSection({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation('settings');
  return (
    <SectionEditor section="localization" title={t('categories.localization.title')} subtitle={t('categories.localization.description')} readOnly={readOnly}>
      {(form, disabled) => <LocalizationFields form={form} disabled={disabled} />}
    </SectionEditor>
  );
}
