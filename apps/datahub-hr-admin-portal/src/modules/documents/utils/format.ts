import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import type { ComplianceStatus, Confidentiality, DocumentStatus, ExpiryStatus } from '@/modules/documents/types/documents';

export function formatDay(date: string, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(new Date(`${date.slice(0, 10)}T00:00`));
}
export function formatTimestamp(iso: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}
export function formatMonth(month: string, language: Locale): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

type Tone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' | 'default';
export const STATUS_TONE: Record<DocumentStatus, Tone> = { 'pending-review': 'info', verified: 'success', rejected: 'error', expired: 'error', archived: 'default', superseded: 'default' };
export const EXPIRY_TONE: Record<ExpiryStatus, Tone> = { valid: 'success', 'expiring-soon': 'warning', expired: 'error', 'no-expiry': 'default' };
export const CONFIDENTIALITY_TONE: Record<Confidentiality, Tone> = { standard: 'default', confidential: 'warning', 'highly-confidential': 'error' };
export const COMPLIANCE_TONE: Record<ComplianceStatus, Tone> = { required: 'info', uploaded: 'warning', 'pending-verification': 'info', verified: 'success', missing: 'error', expired: 'error' };
