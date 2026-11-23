import type { Locale } from '@/i18n/languages';
import type { ReportResult } from '@/modules/reports/types/reports';
import { formatNote, formatTime, formatValue, isLtrKind, isNumericKind, label, type ReportsT } from '@/modules/reports/utils/format';

/** At most this many records are printed (the CSV export holds every record). */
export const PRINT_ROWS = 500;

interface Props {
  result: ReportResult;
  title: string;
  description: string;
  filters: Array<{ label: string; value: string }>;
  /** The chart as shown on screen (ECharts SVG), when there is one. */
  chartSvg: string | null;
  t: ReportsT;
  language: Locale;
}

/*
 * The printed report (browser print → "Save as PDF"): rendered to static markup with inline styles, in the page's
 * language and direction. Title, filters, generation time, summary, chart, records (first 500), notes and a
 * confidentiality notice on every copy. Nothing is uploaded or stored.
 */
export function PrintableReport({ result, title, description, filters, chartSvg, t, language }: Props) {
  const rtl = language === 'ar';
  const font = rtl ? "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif" : "Inter, 'Segoe UI', Arial, sans-serif";
  const rows = result.rows.slice(0, PRINT_ROWS);
  const cell = { padding: '4px 6px', borderBottom: '1px solid #d9dee7', textAlign: (rtl ? 'right' : 'left') as 'right' | 'left', verticalAlign: 'top' as const };
  const muted = { color: '#4a5566' };
  return (
    <article dir={rtl ? 'rtl' : 'ltr'} lang={language} style={{ fontFamily: font, color: '#141b26', fontSize: '11px', lineHeight: 1.45 }}>
      <p style={{ margin: '0 0 12px', padding: '6px 10px', border: '1px solid #b86e00', background: '#fff6e5', color: '#5c3700', fontWeight: 600 }}>{t('print.confidential')}</p>
      <header style={{ borderBottom: '2px solid #1456c8', paddingBottom: '8px', marginBottom: '10px' }}>
        <div style={{ ...muted, fontSize: '10px' }}>{t('print.source')}</div>
        <h1 style={{ margin: '2px 0', fontSize: '18px' }}>{title}</h1>
        <div style={muted}>{description}</div>
        <div style={{ ...muted, marginTop: '4px' }}>{t('print.generated', { time: formatTime(result.generatedAt, language) })}</div>
      </header>
      <section style={{ marginBottom: '10px' }}>
        <h2 style={{ fontSize: '12px', margin: '0 0 4px' }}>{t('print.filters')}</h2>
        {filters.length ? (
          <ul style={{ margin: 0, paddingInlineStart: '16px' }}>
            {filters.map((f) => (
              <li key={f.label}>
                {f.label}: <strong>{f.value}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div style={muted}>{t('filters.none')}</div>
        )}
      </section>
      {result.summary.length > 0 && (
        <section style={{ marginBottom: '10px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 4px' }}>{t('print.summary')}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {result.summary.map((s) => (
                <tr key={s.key}>
                  <td style={{ ...cell, width: '50%' }}>{label(t, s.key)}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>
                    <bdi dir={isLtrKind(s.kind) ? 'ltr' : undefined}>{s.value === null ? t('view.unavailable') : `${s.kind === 'money' ? 'JOD ' : ''}${formatValue(t, language, s.kind, s.value)}`}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {chartSvg && <section style={{ marginBottom: '10px', breakInside: 'avoid' }} dir="ltr" dangerouslySetInnerHTML={{ __html: chartSvg }} />}
      {result.columns.length > 0 && (
        <section>
          <h2 style={{ fontSize: '12px', margin: '0 0 4px' }}>
            {t('print.records')} · {t('view.records', { rows: result.rows.length })}
          </h2>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10px' }}>
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c.key} style={{ ...cell, borderBottom: '1px solid #141b26', textAlign: isNumericKind(c.kind) ? (rtl ? 'left' : 'right') : cell.textAlign }}>
                    {label(t, c.key)}
                    {c.kind === 'money' && result.currency ? ` (${result.currency})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {result.columns.map((c) => (
                    <td key={c.key} style={{ ...cell, textAlign: isNumericKind(c.kind) ? (rtl ? 'left' : 'right') : cell.textAlign }}>
                      <bdi dir={isLtrKind(c.kind) ? 'ltr' : undefined}>{formatValue(t, language, c.kind, row[c.key] ?? null, c.enum)}</bdi>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > PRINT_ROWS && <p style={muted}>{t('print.truncated', { shown: PRINT_ROWS, total: result.rows.length })}</p>}
        </section>
      )}
      {(result.limitations.length > 0 || result.basis.length > 0) && (
        <section style={{ marginTop: '10px', ...muted }}>
          {result.limitations.length > 0 && (
            <>
              <h2 style={{ fontSize: '12px', margin: '0 0 4px', color: '#141b26' }}>{t('view.limitations')}</h2>
              <ul style={{ margin: '0 0 6px', paddingInlineStart: '16px' }}>
                {result.limitations.map((n, i) => (
                  <li key={i}>{formatNote(t, language, n)}</li>
                ))}
              </ul>
            </>
          )}
          <h2 style={{ fontSize: '12px', margin: '0 0 4px', color: '#141b26' }}>{t('view.basis')}</h2>
          <ul style={{ margin: 0, paddingInlineStart: '16px' }}>
            {result.basis.map((n, i) => (
              <li key={i}>{formatNote(t, language, n)}</li>
            ))}
          </ul>
        </section>
      )}
      <p style={{ marginTop: '12px', borderTop: '1px solid #d9dee7', paddingTop: '6px', ...muted }}>{t('print.confidential')}</p>
    </article>
  );
}
