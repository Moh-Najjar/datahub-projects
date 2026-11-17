import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import type { CycleStatus, GoalStatus, PlanStatus, RatingLevel, ReviewState } from '@/modules/performance/types/performance';

export function formatDay(date: string, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(new Date(`${date.slice(0, 10)}T00:00`));
}

export function formatTimestamp(iso: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}

/** "4 — Exceeds expectations" (the label comes from the configured scale). */
export function ratingText(value: number | null, scale: readonly RatingLevel[], language: Locale): string {
  if (value === null) return '—';
  const level = scale.find((l) => l.value === value);
  return level ? `${value} — ${level.label[language]}` : String(value);
}

type Tone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' | 'default';
export const CYCLE_TONE: Record<CycleStatus, Tone> = { draft: 'default', active: 'info', 'in-progress': 'primary', completed: 'success', closed: 'default' };
export const GOAL_TONE: Record<GoalStatus, Tone> = { 'not-started': 'default', 'in-progress': 'primary', 'at-risk': 'warning', completed: 'success', cancelled: 'default' };
export const REVIEW_TONE: Record<ReviewState, Tone> = { 'pending-self': 'default', 'pending-manager': 'warning', completed: 'success' };
export const PLAN_TONE: Record<PlanStatus, Tone> = { draft: 'default', active: 'primary', completed: 'success', cancelled: 'default' };
