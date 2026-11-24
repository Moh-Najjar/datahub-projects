import { DEFAULT_EVALUATION_CATEGORIES } from '@/core/config/evaluationDefaults';
import type {
  DbActivity,
  DbAssignment,
  DbDepartment,
  DbEnrollment,
  DbEvaluation,
  DbMaterial,
  DbSubmission,
  DbTraining,
  DbUser,
  MockDatabase,
  Role,
  TrainingStatus,
} from './dbTypes';

/*
 * Realistic FICTIONAL seed data (no real people; `.test` e-mail addresses). Dates are relative to "now" so assignment
 * deadlines and recent activity always look current. Department names are those of the original Training Portal.
 */

const DAY = 86_400_000;

export const SEED_DEPARTMENTS = {
  dataEngineering: 'dep-0001',
  ai: 'dep-0002',
  software: 'dep-0003',
  powerBi: 'dep-0004',
  businessAnalysis: 'dep-0005',
  infrastructure: 'dep-0006',
  cloud: 'dep-0007',
} as const;

export const SEED_USERS = {
  superAdmin: 'usr-0001',
  adminDataEngineering: 'usr-0002',
  adminAi: 'usr-0003',
  adminSoftware: 'usr-0004',
  yousef: 'usr-0005',
  noor: 'usr-0006',
  lina: 'usr-0007',
  ziad: 'usr-0008',
  hadi: 'usr-0009',
  dana: 'usr-0010',
  tariq: 'usr-0011',
  mariam: 'usr-0012',
  khaled: 'usr-0013',
  sara: 'usr-0014',
  fadi: 'usr-0015',
  alaa: 'usr-0016',
} as const;

export function createSeedData(now: number = Date.now()): MockDatabase {
  const at = (days: number, hour = 9) => {
    const d = new Date(now + days * DAY);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const day = (days: number) => new Date(now + days * DAY).toISOString().slice(0, 10);
  const D = SEED_DEPARTMENTS;
  const U = SEED_USERS;

  const departments: DbDepartment[] = [
    ['Data Engineering', D.dataEngineering],
    ['Artificial Intelligence', D.ai],
    ['Software Development', D.software],
    ['Power BI', D.powerBi],
    ['Business Analysis and BRD', D.businessAnalysis],
    ['Infrastructure', D.infrastructure],
    ['Cloud', D.cloud],
  ].map(([name, id]) => ({ id: id!, name: name!, createdAt: at(-200) }));

  const user = (id: string, fullName: string, role: Role, departmentId: string | null, isActive = true): DbUser => ({
    id,
    fullName,
    email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.test`,
    role,
    isActive,
    departmentId,
    createdAt: at(-120),
  });
  const users: DbUser[] = [
    user(U.superAdmin, 'Layla Haddad', 'SuperAdmin', null),
    user(U.adminDataEngineering, 'Omar Nasser', 'DepartmentAdmin', D.dataEngineering),
    user(U.adminAi, 'Rania Khoury', 'DepartmentAdmin', D.ai),
    user(U.adminSoftware, 'Samer Qasem', 'DepartmentAdmin', D.software),
    user(U.yousef, 'Yousef Darwish', 'Trainee', D.dataEngineering),
    user(U.noor, 'Noor Aldeen', 'Intern', D.dataEngineering),
    user(U.lina, 'Lina Barakat', 'Employee', D.dataEngineering),
    user(U.ziad, 'Ziad Tamimi', 'Trainee', D.dataEngineering),
    user(U.hadi, 'Hadi Mansour', 'Trainee', D.ai),
    user(U.dana, 'Dana Salameh', 'Intern', D.ai),
    user(U.tariq, 'Tariq Awad', 'Trainee', D.software),
    user(U.mariam, 'Mariam Zayed', 'Employee', D.software),
    user(U.khaled, 'Khaled Issa', 'Intern', D.software, false),
    user(U.sara, 'Sara Abbas', 'Trainee', D.powerBi),
    user(U.fadi, 'Fadi Rimawi', 'Employee', D.businessAnalysis),
    user(U.alaa, 'Alaa Hijazi', 'Intern', D.cloud),
  ];

  const training = (
    n: number,
    title: string,
    description: string,
    status: TrainingStatus,
    departmentId: string,
    trainerId: string,
    sortOrder: number,
    dates: [number, number] | null,
    durationHours: number | null,
  ): DbTraining => ({
    id: `trn-${String(n).padStart(4, '0')}`,
    title,
    description,
    status,
    sortOrder,
    departmentId,
    trainerId,
    startDate: dates ? day(dates[0]) : null,
    endDate: dates ? day(dates[1]) : null,
    durationHours,
    createdAt: at(-60 + n),
    updatedAt: null,
  });
  const trainings: DbTraining[] = [
    training(1, 'SQL & Data Modeling Foundations', 'Relational design, normalization, star schemas and the SQL needed to query and shape analytical data.', 'published', D.dataEngineering, U.adminDataEngineering, 0, [-20, 25], 24),
    training(2, 'ETL Pipelines with Python', 'Build, schedule and monitor extract-transform-load jobs with Python, including error handling and data validation.', 'published', D.dataEngineering, U.adminDataEngineering, 1, [-5, 40], 30),
    training(3, 'Data Quality & Governance', 'Profiling, rules, lineage and ownership: keeping data trustworthy across teams.', 'draft', D.dataEngineering, U.adminDataEngineering, 2, null, 12),
    training(4, 'Machine Learning Essentials', 'Supervised learning, evaluation metrics and the full model lifecycle, taught with small datasets.', 'published', D.ai, U.adminAi, 0, [-15, 30], 36),
    training(5, 'Prompt Engineering & AI Ethics', 'Working responsibly with generative AI: prompting patterns, verification and ethical use at work.', 'published', D.ai, U.adminAi, 1, [-40, -2], 10),
    training(6, 'Clean Code in TypeScript', 'Readable, testable TypeScript: naming, small functions, types as documentation and refactoring habits.', 'published', D.software, U.adminSoftware, 0, [-25, 12], 20),
    training(7, 'REST API Design', 'Resource modelling, status codes, versioning and documentation for HTTP APIs.', 'archived', D.software, U.adminSoftware, 1, [-90, -60], 16),
    training(8, 'Power BI Dashboards', 'From data model to a published dashboard: measures, visuals and storytelling for business users.', 'published', D.powerBi, U.superAdmin, 0, [-10, 20], 18),
    training(9, 'Writing Effective BRDs', 'Gathering requirements and turning them into a clear, reviewable Business Requirements Document.', 'published', D.businessAnalysis, U.superAdmin, 0, [3, 35], 14),
    training(10, 'Azure Fundamentals', 'Core cloud concepts, identity, networking and cost basics on Azure.', 'draft', D.cloud, U.superAdmin, 0, null, null),
  ];

  const text = (id: string, trainingId: string, title: string, content: string, sortOrder: number): DbMaterial => ({
    id, trainingId, type: 'text', title, sortOrder, textContent: content, files: [], links: [], uploadedByUserId: U.superAdmin, createdAt: at(-30),
  });
  const materials: DbMaterial[] = [
    text('mat-0001', 'trn-0001', 'Course overview', 'Welcome! This course runs for six weeks.\n\nWeek 1–2: relational thinking and SQL.\nWeek 3–4: dimensional modeling.\nWeek 5–6: a capstone design review.', 0),
    {
      id: 'mat-0002', trainingId: 'trn-0001', type: 'link', title: 'Reading list', sortOrder: 1, textContent: null, files: [],
      links: [
        { id: 'lnk-0001', title: 'SQL style guide', url: 'https://example.test/sql-style-guide' },
        { id: 'lnk-0002', title: 'Star schema primer', url: 'https://example.test/star-schema' },
      ],
      uploadedByUserId: U.adminDataEngineering, createdAt: at(-29),
    },
    {
      id: 'mat-0003', trainingId: 'trn-0001', type: 'file', title: 'Lab files', sortOrder: 2, textContent: null, links: [],
      files: [
        { id: 'fil-0001', title: 'Sample sales dataset', fileName: 'sales-sample.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSizeBytes: 482_113 },
        { id: 'fil-0002', title: null, fileName: 'lab-instructions.pdf', contentType: 'application/pdf', fileSizeBytes: 1_204_880 },
      ],
      uploadedByUserId: U.adminDataEngineering, createdAt: at(-28),
    },
    text('mat-0004', 'trn-0002', 'Before you start', 'Install Python 3.12 and a code editor. Bring your laptop to every session.', 0),
    {
      id: 'mat-0005', trainingId: 'trn-0002', type: 'link', title: 'Docs', sortOrder: 1, textContent: null, files: [],
      links: [{ id: 'lnk-0003', title: 'Python standard library', url: 'https://example.test/python-docs' }],
      uploadedByUserId: U.adminDataEngineering, createdAt: at(-4),
    },
    text('mat-0006', 'trn-0004', 'Syllabus', 'Regression and classification, cross-validation, feature engineering, and a final mini-project.', 0),
    {
      id: 'mat-0007', trainingId: 'trn-0004', type: 'file', title: 'Notebooks', sortOrder: 1, textContent: null, links: [],
      files: [{ id: 'fil-0003', title: 'Week 1 notebook', fileName: 'week1.ipynb', contentType: 'application/json', fileSizeBytes: 96_340 }],
      uploadedByUserId: U.adminAi, createdAt: at(-14),
    },
    text('mat-0008', 'trn-0006', 'Style rules', 'Prefer small functions, explicit types at module boundaries, and tests next to the code they cover.', 0),
    {
      id: 'mat-0009', trainingId: 'trn-0006', type: 'link', title: 'Further reading', sortOrder: 1, textContent: null, files: [],
      links: [{ id: 'lnk-0004', title: 'TypeScript handbook', url: 'https://example.test/ts-handbook' }],
      uploadedByUserId: U.adminSoftware, createdAt: at(-20),
    },
  ];

  const assignments: DbAssignment[] = [
    { id: 'asg-0001', trainingId: 'trn-0001', title: 'Design a star schema', description: 'Model a retail sales mart: one fact table and at least three dimensions. Submit a short rationale.', opensAt: at(-10), closesAt: at(5, 17), createdByUserId: U.adminDataEngineering, createdAt: at(-11), attachments: [{ id: 'fil-0004', title: null, fileName: 'retail-brief.pdf', contentType: 'application/pdf', fileSizeBytes: 220_400 }] },
    { id: 'asg-0002', trainingId: 'trn-0001', title: 'Normalization write-up', description: 'Explain, with an example, how you would move a flat orders table to third normal form.', opensAt: at(3), closesAt: at(12, 17), createdByUserId: U.adminDataEngineering, createdAt: at(-2), attachments: [] },
    { id: 'asg-0003', trainingId: 'trn-0002', title: 'Build a small ETL job', description: 'Load the sample CSV, clean it and write it to a staging table. Include a short README.', opensAt: at(-20), closesAt: at(-3, 17), createdByUserId: U.adminDataEngineering, createdAt: at(-21), attachments: [] },
    { id: 'asg-0004', trainingId: 'trn-0006', title: 'Refactor challenge', description: 'Refactor the provided module for readability without changing behaviour.', opensAt: at(-4), closesAt: at(3, 17), createdByUserId: U.adminSoftware, createdAt: at(-5), attachments: [] },
  ];

  const submissions: DbSubmission[] = [
    { id: 'sub-0001', assignmentId: 'asg-0001', userId: U.noor, textResponse: 'Fact table: sales. Dimensions: date, product, store, customer. I kept the grain at one line per receipt item.', submittedAt: at(-3, 14), updatedAt: null, attachments: [] },
    { id: 'sub-0002', assignmentId: 'asg-0003', userId: U.noor, textResponse: 'Job reads the CSV in chunks and validates the schema before loading.', submittedAt: at(-6, 11), updatedAt: at(-5, 9), attachments: [{ id: 'fil-0005', title: null, fileName: 'etl-job.py', contentType: 'text/x-python', fileSizeBytes: 5_320 }] },
    { id: 'sub-0003', assignmentId: 'asg-0004', userId: U.tariq, textResponse: 'Extracted three helpers and replaced the nested conditionals.', submittedAt: at(-1, 16), updatedAt: null, attachments: [] },
  ];

  let enrollmentNumber = 0;
  const enrollment = (trainingId: string, userId: string, progress: number, assignedDaysAgo: number, assignedByUserId: string): DbEnrollment => {
    enrollmentNumber += 1;
    const status = progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'assigned';
    return {
      id: `enr-${String(enrollmentNumber).padStart(4, '0')}`,
      trainingId,
      userId,
      assignedByUserId,
      status,
      progress,
      assignedAt: at(-assignedDaysAgo),
      completedAt: status === 'completed' ? at(-Math.max(1, assignedDaysAgo - 8), 15) : null,
    };
  };
  const adminDe = U.adminDataEngineering;
  const enrollments: DbEnrollment[] = [
    enrollment('trn-0001', U.yousef, 60, 18, adminDe),
    enrollment('trn-0002', U.yousef, 0, 3, adminDe),
    enrollment('trn-0001', U.noor, 100, 19, adminDe),
    enrollment('trn-0002', U.noor, 35, 4, adminDe),
    enrollment('trn-0001', U.lina, 80, 18, adminDe),
    enrollment('trn-0001', U.ziad, 0, 2, adminDe),
    enrollment('trn-0004', U.hadi, 45, 14, U.adminAi),
    enrollment('trn-0005', U.hadi, 100, 38, U.adminAi),
    enrollment('trn-0004', U.dana, 0, 5, U.adminAi),
    enrollment('trn-0005', U.dana, 20, 30, U.adminAi),
    enrollment('trn-0004', U.yousef, 10, 6, U.superAdmin),
    enrollment('trn-0006', U.tariq, 100, 24, U.adminSoftware),
    enrollment('trn-0006', U.mariam, 70, 24, U.adminSoftware),
    enrollment('trn-0008', U.sara, 50, 9, U.superAdmin),
    enrollment('trn-0008', U.tariq, 0, 4, U.superAdmin),
    enrollment('trn-0009', U.fadi, 0, 1, U.superAdmin),
  ];
  const enrollmentOf = (trainingId: string, userId: string) => enrollments.find((e) => e.trainingId === trainingId && e.userId === userId)!;

  const evaluation = (n: number, userId: string, evaluatedBy: string, enrollmentId: string | null, daysAgo: number, scores: number[]): DbEvaluation => ({
    id: `evl-${String(n).padStart(4, '0')}`,
    userId,
    evaluatedByUserId: evaluatedBy,
    enrollmentId,
    evaluatedAt: at(-daysAgo, 12),
    createdAt: at(-daysAgo, 12),
    updatedAt: null,
    categories: DEFAULT_EVALUATION_CATEGORIES.map((c, i) => ({ id: `evc-${n}-${i + 1}`, categoryName: c.categoryName, criteria: c.criteria, score: scores[i] ?? 5 })),
  });
  const evaluations: DbEvaluation[] = [
    evaluation(1, U.noor, adminDe, enrollmentOf('trn-0001', U.noor).id, 4, [8, 9, 8, 7, 8, 9, 9, 7, 8, 9]),
    evaluation(2, U.yousef, adminDe, null, 25, [6, 7, 6, 7, 7, 8, 7, 5, 6, 7]),
    evaluation(3, U.yousef, adminDe, enrollmentOf('trn-0001', U.yousef).id, 6, [7, 8, 7, 7, 8, 8, 8, 6, 7, 8]),
    evaluation(4, U.hadi, U.adminAi, enrollmentOf('trn-0005', U.hadi).id, 3, [9, 8, 9, 8, 7, 10, 9, 8, 8, 9]),
    evaluation(5, U.tariq, U.adminSoftware, enrollmentOf('trn-0006', U.tariq).id, 2, [8, 8, 7, 8, 8, 7, 9, 6, 7, 8]),
  ];

  const nameOf = (id: string) => users.find((u) => u.id === id)!.fullName;
  const trainingOf = (id: string) => trainings.find((t) => t.id === id)!;
  let activityNumber = 0;
  const activity = (type: DbActivity['type'], daysAgo: number, hour: number, actorId: string, trainingId: string | null, userId: string | null, progress: number | null = null): DbActivity => {
    activityNumber += 1;
    const t = trainingId ? trainingOf(trainingId) : null;
    return {
      id: `act-${String(activityNumber).padStart(4, '0')}`,
      type,
      at: at(-daysAgo, hour),
      actorId,
      actorName: nameOf(actorId),
      trainingId,
      trainingTitle: t?.title ?? null,
      departmentId: t?.departmentId ?? (userId ? users.find((u) => u.id === userId)?.departmentId ?? null : null),
      userId,
      userName: userId ? nameOf(userId) : null,
      progress,
    };
  };
  const activities: DbActivity[] = [
    activity('training-created', 40, 10, U.adminAi, 'trn-0004', null),
    activity('training-published', 39, 11, U.adminAi, 'trn-0004', null),
    activity('trainee-enrolled', 18, 9, adminDe, 'trn-0001', U.yousef),
    activity('trainee-enrolled', 14, 9, U.adminAi, 'trn-0004', U.hadi),
    activity('enrollment-completed', 11, 15, adminDe, 'trn-0001', U.noor, 100),
    activity('progress-updated', 8, 13, adminDe, 'trn-0001', U.lina, 80),
    activity('trainee-enrolled', 4, 10, adminDe, 'trn-0002', U.noor),
    activity('evaluation-submitted', 4, 12, adminDe, 'trn-0001', U.noor),
    activity('progress-updated', 3, 14, U.adminAi, 'trn-0004', U.hadi, 45),
    activity('evaluation-submitted', 3, 12, U.adminAi, 'trn-0005', U.hadi),
    activity('trainee-enrolled', 2, 9, adminDe, 'trn-0001', U.ziad),
    activity('progress-updated', 1, 16, adminDe, 'trn-0001', U.yousef, 60),
  ];

  return { departments, users, trainings, materials, assignments, submissions, enrollments, evaluations, activities, seq: 1000 };
}
