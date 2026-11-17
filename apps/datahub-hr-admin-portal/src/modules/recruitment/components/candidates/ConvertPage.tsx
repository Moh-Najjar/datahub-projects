import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { EmployeeForm, type EmployeeInput } from '@/modules/employees';
import { QueryBoundary } from '@/modules/shared/Panel';
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { useCandidate, useConversionDraft, useConvertCandidate } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Candidate, ConversionDraft } from '@/modules/recruitment/types/recruitment';
import { personName } from '@/modules/recruitment/utils/format';

/**
 * `/recruitment/candidates/:candidateId/convert` — hired candidate → Employee Management record (once). Uses Employee
 * Management's own form, pre-filled from the candidate and the accepted offer; HR completes the missing details
 * (date of birth, emergency contact…). The API creates the employee with Employee Management's rules and links it.
 */
export function ConvertPage() {
  const { t } = useTranslation('recruitment');
  const { candidateId = '' } = useParams();
  const { canConvert } = useRecruitmentAccess();
  const candidate = useCandidate(candidateId);
  const draft = useConversionDraft(candidateId, canConvert && Boolean(candidate.data?.can.convert));
  if (!canConvert) return <Alert severity="warning">{t('conversion.noPermission')}</Alert>;
  return (
    <QueryBoundary query={candidate} notFoundText={t('candidates.notFound')} forbiddenText={t('details.forbidden')}>
      {candidate.data &&
        (candidate.data.can.convert ? (
          <QueryBoundary query={draft} notFoundText={t('candidates.notFound')} forbiddenText={t('details.forbidden')}>
            {draft.data && <ConvertForm candidate={candidate.data} draft={draft.data} />}
          </QueryBoundary>
        ) : (
          <Alert severity="info">{candidate.data.employeeId ? t('conversion.converted') : t('conversion.notReady')}</Alert>
        ))}
    </QueryBoundary>
  );
}

function ConvertForm({ candidate, draft }: { candidate: Candidate; draft: ConversionDraft }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const navigate = useNavigate();
  const convert = useConvertCandidate();
  const name = personName(candidate.name, language);
  useBreadcrumbs([
    { label: t('tabs.candidates'), to: recruitmentPaths.candidates },
    { label: name, to: recruitmentPaths.candidate(candidate.id) },
    { label: t('conversion.title') },
  ]);
  const prefill = useMemo<Partial<EmployeeInput>>(
    () => ({
      employeeNumber: draft.employeeNumber,
      name: draft.name,
      workEmail: draft.workEmail,
      personalEmail: draft.personalEmail,
      phone: draft.phone,
      hireDate: draft.hireDate,
      contractStartDate: draft.hireDate,
      employmentType: draft.employmentType,
      departmentId: draft.departmentId,
      positionId: draft.positionId,
      locationId: draft.locationId,
      managerId: draft.managerId,
    }),
    [draft],
  );
  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h2">
        {t('conversion.heading', { name })}
      </Typography>
      <Alert severity="info">{t('conversion.hint')}</Alert>
      <EmployeeForm
        external={{
          prefill,
          pending: convert.isPending,
          submitLabel: t('conversion.submit'),
          cancelTo: recruitmentPaths.candidate(candidate.id),
          // mutateAsync: the success refresh makes this form obsolete (the candidate is converted), and per-call
          // mutate callbacks are skipped once a component unmounts — the promise always settles.
          submit: (input, onError) =>
            void convert
              .mutateAsync({ candidateId: candidate.id, input })
              .then((c) => navigate(recruitmentPaths.candidate(c.id), { state: { notice: t('conversion.done', { name, number: input.employeeNumber }) } }))
              .catch(onError),
        }}
      />
    </Stack>
  );
}
