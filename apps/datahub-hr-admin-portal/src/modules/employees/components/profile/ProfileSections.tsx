import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { countryName, orgPaths } from '@/modules/organization';
import { DetailList, Panel } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';
import { employeePaths } from '@/modules/employees/paths';
import type { Employee } from '@/modules/employees/types/employee';
import { EmployeeAvatar } from '@/modules/employees/components/EmployeeAvatar';

/** Left-to-right value (codes, e-mails, phone numbers) inside RTL text. */
const Ltr = ({ children }: { children: string }) => (
  <Box component="span" dir="ltr" sx={{ unicodeBidi: 'isolate' }}>
    {children}
  </Box>
);

function useFormat() {
  const { t } = useTranslation('employees');
  const { language } = useLanguage();
  return {
    t,
    language,
    date: (iso: string | null, empty = t('profile.notApplicable')) => (iso ? formatDate(iso, language) : empty),
    text: (value: string) => value || t('profile.notProvided'),
    ltr: (value: string) => (value ? <Ltr>{value}</Ltr> : t('profile.notProvided')),
  };
}

/** Shown instead of personal details when the API withheld them (no `employees:read:personal`). */
function Restricted() {
  const { t } = useTranslation('employees');
  return (
    <Alert severity="info" icon={false} sx={{ mt: 2 }} data-restricted>
      {t('profile.restricted')}
    </Alert>
  );
}

export function PersonalSection({ employee: e }: { employee: Employee }) {
  const { t, language, date } = useFormat();
  const p = e.personal;
  return (
    <Panel title={t('form.sections.personal')}>
      <DetailList
        items={[
          { label: t('fields.employeeNumber'), value: <Ltr>{e.employeeNumber}</Ltr> },
          { label: t('fields.firstNameEn'), value: <span lang="en">{e.name.first.en}</span> },
          { label: t('fields.lastNameEn'), value: <span lang="en">{e.name.last.en}</span> },
          { label: t('fields.firstNameAr'), value: <span lang="ar" dir="rtl">{e.name.first.ar}</span> },
          { label: t('fields.lastNameAr'), value: <span lang="ar" dir="rtl">{e.name.last.ar}</span> },
          ...(p
            ? [
                { label: t('fields.dateOfBirth'), value: date(p.dateOfBirth) },
                { label: t('fields.gender'), value: t(`genders.${p.gender}`) },
                { label: t('fields.nationality'), value: countryName(p.nationality, language) },
                { label: t('fields.maritalStatus'), value: t(`marital.${p.maritalStatus}`) },
              ]
            : []),
          {
            label: t('fields.photo'),
            value: (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <EmployeeAvatar id={e.id} name={e.name} size={40} />
                <Typography variant="body2" color="text.secondary">
                  {t('profile.photoPlaceholder')}
                </Typography>
              </Box>
            ),
          },
        ]}
      />
      {!p && <Restricted />}
    </Panel>
  );
}

export function ContactSection({ employee: e }: { employee: Employee }) {
  const { t, language, text, ltr } = useFormat();
  const p = e.personal;
  return (
    <Panel title={t('form.sections.contact')}>
      <DetailList
        items={[
          { label: t('fields.workEmail'), value: ltr(e.workEmail) },
          ...(p
            ? [
                { label: t('fields.personalEmail'), value: ltr(p.personalEmail) },
                { label: t('fields.phone'), value: ltr(p.phone) },
                { label: t('fields.alternativePhone'), value: ltr(p.alternativePhone) },
                { label: t('fields.address'), value: text(p.address) },
                { label: t('fields.city'), value: text(p.city) },
                { label: t('fields.country'), value: countryName(p.country, language) },
              ]
            : []),
        ]}
      />
      {!p && <Restricted />}
    </Panel>
  );
}

export function EmploymentSection({ employee: e }: { employee: Employee }) {
  const { t, language, date } = useFormat();
  return (
    <Panel title={t('form.sections.employment')}>
      <DetailList
        items={[
          { label: t('fields.hireDate'), value: date(e.hireDate) },
          { label: t('fields.employmentType'), value: t(`types.${e.employmentType}`) },
          { label: t('fields.status'), value: <StatusChip status={e.status} /> },
          { label: t('fields.contractStartDate'), value: date(e.contractStartDate) },
          { label: t('fields.contractEndDate'), value: date(e.contractEndDate) },
          { label: t('fields.workLocation'), value: e.location.name[language] },
          { label: t('fields.probationEndDate'), value: date(e.probationEndDate) },
        ]}
      />
    </Panel>
  );
}

export function OrganizationSection({ employee: e }: { employee: Employee }) {
  const { t, language } = useFormat();
  const departmentLink = (ref: { id: string; name: { en: string; ar: string } }) => (
    <Link component={RouterLink} to={orgPaths.department(ref.id)}>
      {ref.name[language]}
    </Link>
  );
  return (
    <Panel title={t('form.sections.organization')}>
      <DetailList
        items={[
          { label: t('fields.department'), value: departmentLink(e.department) },
          { label: t('fields.position'), value: e.position.name[language] },
          {
            label: t('fields.manager'),
            value: e.manager ? (
              <Link component={RouterLink} to={employeePaths.profile(e.manager.id)}>
                {e.manager.name[language]}
              </Link>
            ) : (
              t('profile.noManager')
            ),
          },
          { label: t('fields.location'), value: e.location.name[language] },
          { label: t('fields.reportingDepartment'), value: e.reportingDepartment ? departmentLink(e.reportingDepartment) : t('profile.notApplicable') },
        ]}
      />
    </Panel>
  );
}

export function EmergencySection({ employee: e }: { employee: Employee }) {
  const { t, text, ltr } = useFormat();
  const contact = e.personal?.emergencyContact;
  return (
    <Panel title={t('profile.tabs.emergency')}>
      {contact ? (
        <DetailList
          items={[
            { label: t('fields.emergencyName'), value: text(contact.name) },
            { label: t('fields.emergencyRelationship'), value: t(`relationships.${contact.relationship}`) },
            { label: t('fields.emergencyPhone'), value: ltr(contact.phone) },
            { label: t('fields.emergencyAlternativePhone'), value: ltr(contact.alternativePhone) },
          ]}
        />
      ) : (
        <Restricted />
      )}
    </Panel>
  );
}
