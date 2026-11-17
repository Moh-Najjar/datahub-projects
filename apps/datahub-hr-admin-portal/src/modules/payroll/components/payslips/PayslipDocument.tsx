import type { CSSProperties, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { Locale } from '@/i18n/languages';
import type { LineItem, Payslip } from '@/modules/payroll/types/payroll';
import { formatAmount, formatDay } from '@/modules/payroll/utils/format';

/*
 * The bilingual payslip template. Inline styles only (no theme): the same markup is shown on screen and rendered to a
 * standalone print document ("Save as PDF"), so the PDF matches what the user saw. The document direction follows the
 * chosen language; every label also carries the other language. Amounts, codes and numbers stay left-to-right.
 */

export interface PayslipTexts {
  en: TFunction<'payroll'>;
  ar: TFunction<'payroll'>;
}

const ink = '#1a2433';
const muted = '#5b6675';
const line = '#d6dce4';
const accent = '#0b5cad';

const ltr: CSSProperties = { direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

export function PayslipDocument({ payslip: p, language, texts }: { payslip: Payslip; language: Locale; texts: PayslipTexts }) {
  const other: Locale = language === 'ar' ? 'en' : 'ar';
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const start = language === 'ar' ? 'right' : 'left';
  const end = language === 'ar' ? 'left' : 'right';
  /** Label in the document language with the other language underneath. */
  const label = (key: Parameters<PayslipTexts['en']>[0]) => (
    <>
      <span>{texts[language](key as never)}</span>
      <span style={{ display: 'block', fontSize: 10, color: muted }} lang={other} dir={other === 'ar' ? 'rtl' : 'ltr'}>
        {texts[other](key as never)}
      </span>
    </>
  );
  const money = (v: number) => <span style={ltr}>{formatAmount(v, p.currency, 'en')}</span>;
  const cell: CSSProperties = { padding: '6px 8px', borderBottom: `1px solid ${line}`, textAlign: start, verticalAlign: 'top' };
  const amountCell: CSSProperties = { ...cell, textAlign: end };
  const info = (key: string, value: ReactNode) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: muted }}>{label(key as never)}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
  const items = (title: string, rows: readonly LineItem[], totalKey: string, total: number) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#eef3f9' }}>
          <th style={{ ...cell, fontWeight: 600 }}>{label(title as never)}</th>
          <th style={{ ...amountCell, fontWeight: 600 }}>
            {label('payslip.amount')}
            <span style={{ ...ltr, display: 'block', fontSize: 10, color: muted }}>{p.currency}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td style={{ ...cell, color: muted }} colSpan={2}>
              —
            </td>
          </tr>
        )}
        {rows.map((i, index) => (
          <tr key={`${i.code}-${index}`}>
            <td style={cell}>
              {i.name[language]}
              <span style={{ display: 'block', fontSize: 10, color: muted }} lang={other}>
                {i.name[other]} · <span style={ltr}>{i.code}</span>
                {i.illustrative ? ` · ${texts[language]('common.illustrative')}` : ''}
              </span>
            </td>
            <td style={amountCell}>{money(i.amount)}</td>
          </tr>
        ))}
        <tr>
          <td style={{ ...cell, fontWeight: 700, borderBottom: `2px solid ${ink}` }}>{label(totalKey as never)}</td>
          <td style={{ ...amountCell, fontWeight: 700, borderBottom: `2px solid ${ink}` }}>{money(total)}</td>
        </tr>
      </tbody>
    </table>
  );
  const day = (d: string) => formatDay(d, 'en', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const date = (d: string) => <span style={ltr}>{day(d)}</span>;

  return (
    <article lang={language} dir={dir} style={{ color: ink, background: '#fff', fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif" : "'Inter Variable', 'Segoe UI', Arial, sans-serif", fontSize: 13, lineHeight: 1.45, padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, borderBottom: `3px solid ${accent}`, paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{p.company[language]}</div>
          <div style={{ fontSize: 12, color: muted }} lang={other}>
            {p.company[other]}
          </div>
        </div>
        <div style={{ textAlign: end }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{texts[language]('payslip.title')}</div>
          <div style={{ fontSize: 12, color: muted }} lang={other}>
            {texts[other]('payslip.title')}
          </div>
          <div style={{ ...ltr, fontFamily: 'monospace', marginTop: 4 }}>{p.number}</div>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 16 }}>
        {info('payslip.employee', p.employee.name[language])}
        {info('payslip.employeeNumber', <span style={ltr}>{p.employee.employeeNumber}</span>)}
        {info('payslip.department', p.employee.department.name[language])}
        {info('payslip.position', p.employee.position.name[language])}
        {/* One left-to-right run, so the range keeps its order inside right-to-left text. */}
        {info('payslip.period', <span style={ltr}>{`${day(p.periodStart)} – ${day(p.periodEnd)}`}</span>)}
        {info('payslip.paymentDate', date(p.paymentDate))}
        {info('payslip.currency', <span style={ltr}>{p.currency}</span>)}
        {info('payslip.run', <span style={ltr}>{p.runNumber}</span>)}
      </section>

      {items('payslip.earnings', p.earnings, 'payslip.gross', p.gross)}
      {items('payslip.deductions', p.deductionItems, 'payslip.totalDeductions', p.deductions)}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 16, fontSize: 12 }}>
        {(
          [
            ['payslip.basic', p.basic],
            ['payslip.allowances', p.allowances],
            ['payslip.overtime', p.overtime],
            ['payslip.gross', p.gross],
            ['payslip.totalDeductions', p.deductions],
          ] as const
        ).map(([key, v]) => (
          <div key={key} style={{ border: `1px solid ${line}`, borderRadius: 6, padding: '6px 10px' }}>
            <div style={{ color: muted, fontSize: 11 }}>{label(key)}</div>
            <div style={{ fontWeight: 600 }}>{money(v)}</div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 16, padding: '12px 16px', background: '#e8f3ec', border: '1px solid #9cc9ab', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700 }}>{label('payslip.net')}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          <span style={ltr}>
            {p.currency} {formatAmount(p.net, p.currency, 'en')}
          </span>
        </div>
      </section>

      <footer style={{ marginTop: 20, fontSize: 10, color: muted, borderTop: `1px solid ${line}`, paddingTop: 8 }}>
        <div>{texts[language]('payslip.footer')}</div>
        <div lang={other} dir={other === 'ar' ? 'rtl' : 'ltr'}>
          {texts[other]('payslip.footer')}
        </div>
      </footer>
    </article>
  );
}
