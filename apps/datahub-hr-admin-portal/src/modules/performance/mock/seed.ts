import type { GoalCategory, RatingLevel, ActivityType } from '@/modules/performance/types/performance';

/*
 * FICTIONAL performance configuration for the simulated backend. The rating scale, competencies and templates are
 * configurable EXAMPLES — not a company performance policy. Read only by the performance mock.
 */

export const DEFAULT_SCALE: readonly RatingLevel[] = [
  { value: 1, label: { en: 'Needs improvement', ar: 'يحتاج إلى تحسين' }, description: { en: 'Results are below what the role requires.', ar: 'النتائج أقل مما يتطلبه الدور.' } },
  { value: 2, label: { en: 'Partially meets expectations', ar: 'يلبي التوقعات جزئيًا' }, description: { en: 'Some objectives met; others need work.', ar: 'تحقق بعض الأهداف ويحتاج بعضها إلى عمل.' } },
  { value: 3, label: { en: 'Meets expectations', ar: 'يلبي التوقعات' }, description: { en: 'Solid, reliable results across the objectives.', ar: 'نتائج ثابتة وموثوقة في جميع الأهداف.' } },
  { value: 4, label: { en: 'Exceeds expectations', ar: 'يتجاوز التوقعات' }, description: { en: 'Results regularly go beyond the objectives.', ar: 'تتجاوز النتائج الأهداف بانتظام.' } },
  { value: 5, label: { en: 'Outstanding', ar: 'متميز' }, description: { en: 'Exceptional results and impact beyond the role.', ar: 'نتائج استثنائية وأثر يتجاوز الدور.' } },
];

export const COMPETENCY_SEED: ReadonlyArray<{ id: string; code: string; name: { en: string; ar: string }; description: string; criteria: string }> = [
  { id: 'cmp-01', code: 'COMM', name: { en: 'Communication', ar: 'التواصل' }, description: 'Shares information clearly and listens actively.', criteria: '3 = clear and timely; 5 = shapes understanding across teams.' },
  { id: 'cmp-02', code: 'TEAM', name: { en: 'Teamwork', ar: 'العمل الجماعي' }, description: 'Works well with others towards shared goals.', criteria: '3 = reliable team member; 5 = lifts the whole team.' },
  { id: 'cmp-03', code: 'PROB', name: { en: 'Problem solving', ar: 'حل المشكلات' }, description: 'Analyses problems and finds practical solutions.', criteria: '3 = solves routine problems; 5 = solves novel, complex problems.' },
  { id: 'cmp-04', code: 'TECH', name: { en: 'Technical knowledge', ar: 'المعرفة الفنية' }, description: 'Has and applies the knowledge the role needs.', criteria: '3 = fully proficient; 5 = recognised expert.' },
  { id: 'cmp-05', code: 'LEAD', name: { en: 'Leadership', ar: 'القيادة' }, description: 'Sets direction and develops others.', criteria: '3 = leads own work; 5 = leads people and change.' },
  { id: 'cmp-06', code: 'ACCT', name: { en: 'Accountability', ar: 'المسؤولية' }, description: 'Owns commitments and results.', criteria: '3 = delivers commitments; 5 = owns outcomes beyond own scope.' },
  { id: 'cmp-07', code: 'ADAPT', name: { en: 'Adaptability', ar: 'القدرة على التكيف' }, description: 'Adjusts well to change and new priorities.', criteria: '3 = adapts to change; 5 = drives positive change.' },
  { id: 'cmp-08', code: 'TIME', name: { en: 'Time management', ar: 'إدارة الوقت' }, description: 'Plans and prioritises work to meet deadlines.', criteria: '3 = meets deadlines; 5 = plans ahead for the team.' },
];

export const TEMPLATE_SEED: ReadonlyArray<{ id: string; name: { en: string; ar: string }; competencyIds: string[] }> = [
  { id: 'tpl-01', name: { en: 'Standard review', ar: 'المراجعة القياسية' }, competencyIds: ['cmp-01', 'cmp-02', 'cmp-03', 'cmp-04', 'cmp-06', 'cmp-08'] },
  { id: 'tpl-02', name: { en: 'Leadership review', ar: 'مراجعة القيادة' }, competencyIds: ['cmp-01', 'cmp-02', 'cmp-05', 'cmp-06', 'cmp-07'] },
];

/** Example goals per category: [title, measurable target]. */
export const GOAL_POOL: Readonly<Record<GoalCategory, ReadonlyArray<readonly [string, string]>>> = {
  business: [
    ['Improve customer satisfaction', 'Raise the satisfaction score from 82% to 88%'],
    ['Reduce operating costs', 'Cut monthly supplier costs by 5%'],
    ['Grow key accounts', 'Close 3 renewals with key accounts'],
    ['Shorten response times', 'Answer 90% of requests within 4 hours'],
  ],
  technical: [
    ['Automate the release checklist', 'Automate 80% of manual release steps'],
    ['Improve test coverage', 'Reach 75% automated test coverage on the core service'],
    ['Document the main processes', 'Publish 6 process guides'],
    ['Modernise reporting', 'Move 4 monthly reports to the new dashboard'],
  ],
  leadership: [
    ['Coach a new team member', 'Hold monthly coaching sessions with a new hire'],
    ['Lead a cross-team initiative', 'Deliver one initiative with two other teams'],
  ],
  'personal-development': [
    ['Complete a professional course', 'Finish one certified course'],
    ['Improve presentation skills', 'Present at 2 internal sessions'],
  ],
};

export const ACTIVITY_POOL: ReadonlyArray<readonly [ActivityType, string]> = [
  ['training', 'Project management fundamentals (course)'],
  ['training', 'Advanced spreadsheet skills (workshop)'],
  ['mentoring', 'Monthly mentoring with a senior colleague'],
  ['certification', 'Professional certification in the field'],
  ['technical', 'Hands-on technical deep-dive'],
  ['leadership', 'First-time manager programme'],
];

export const OBJECTIVE_POOL: readonly string[] = [
  'Strengthen stakeholder communication',
  'Build deeper technical expertise',
  'Prepare for a team lead role',
  'Improve planning and prioritisation',
  'Broaden business knowledge',
];
