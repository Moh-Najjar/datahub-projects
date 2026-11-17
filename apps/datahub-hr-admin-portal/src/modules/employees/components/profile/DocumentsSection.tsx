import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useEmployeeAccess } from '@/modules/employees/hooks/useEmployeeAccess';
import { useAddEmployeeDocument, useEmployeeDocuments } from '@/modules/employees/hooks/useEmployees';
import { documentFormSchema, type DocumentFormValues } from '@/modules/employees/schemas/employeeSchemas';
import { DOCUMENT_TYPES, SENSITIVE_DOCUMENT_TYPES, type DocumentStatus } from '@/modules/employees/types/employee';
import { errorText, fieldErrorText } from '@/modules/employees/utils/serverErrors';

const STATUS_COLOR: Record<DocumentStatus, 'success' | 'warning' | 'error' | 'info'> = {
  valid: 'success',
  'expiring-soon': 'warning',
  expired: 'error',
  'pending-review': 'info',
};

/** Document metadata. Upload is SIMULATED and labelled as such: no file is sent or stored. */
export function DocumentsSection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canReadDocuments, canUploadDocuments } = useEmployeeAccess();
  const query = useEmployeeDocuments(employeeId, canReadDocuments);
  const feedback = useFeedback();
  const [uploading, setUploading] = useState(false);

  let body;
  if (query.isPending) {
    body = (
      <Box>
        <Box component="span" role="status" sx={visuallyHidden}>
          {tCommon('shell.loading')}
        </Box>
        <Skeleton variant="rounded" height={160} />
      </Box>
    );
  } else if (query.isError) {
    body = (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{tCommon('actions.retry')}</Button>}>
        {tCommon('list.loadError')}
      </Alert>
    );
  } else if (query.data.length === 0) {
    body = <Typography color="text.secondary">{t('documents.empty')}</Typography>;
  } else {
    body = (
      <TableContainer sx={{ position: 'relative' }}>
        <Table size="small" aria-label={t('documents.title')}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('documents.name')}</TableCell>
              <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('documents.type')}</TableCell>
              <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('documents.uploadDate')}</TableCell>
              <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('documents.expiryDate')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('documents.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.data.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {d.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" dir="ltr" component="div">
                    {d.fileName}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t(`documents.types.${d.type}`)}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatDate(d.uploadedAt, language)}</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{d.expiryDate ? formatDate(d.expiryDate, language) : t('documents.noExpiry')}</TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" color={STATUS_COLOR[d.status]} label={t(`documents.statuses.${d.status}`)} data-document-status={d.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <Panel
      title={t('documents.title')}
      actions={
        canUploadDocuments ? (
          <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={() => setUploading(true)}>
            {t('actions.upload')}
          </Button>
        ) : undefined
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('documents.simulated')}
      </Alert>
      {body}
      {uploading && (
        <UploadDocumentDialog
          employeeId={employeeId}
          onClose={() => setUploading(false)}
          onSaved={() => {
            setUploading(false);
            feedback.notify(t('documents.uploaded'));
          }}
        />
      )}
      <Feedback {...feedback} />
    </Panel>
  );
}

const FIELDS = ['name', 'type', 'expiryDate', 'fileName'] as const;

function UploadDocumentDialog({ employeeId, onClose, onSaved }: { employeeId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const add = useAddEmployeeDocument(employeeId);
  const { canReadPersonal } = useEmployeeAccess();
  const types = DOCUMENT_TYPES.filter((type) => canReadPersonal || !SENSITIVE_DOCUMENT_TYPES.includes(type));
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { name: '', type: '' as DocumentFormValues['type'], expiryDate: '', fileName: '', sizeBytes: 0 },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const fileName = useWatch({ control, name: 'fileName' });
  const fileError = translate(formState.errors.fileName?.message);

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    const v = documentFormSchema.parse(values);
    add.mutate(
      { name: v.name, type: v.type, fileName: v.fileName, sizeBytes: v.sizeBytes, expiryDate: v.expiryDate || null },
      {
        onSuccess: onSaved,
        onError: (error) => {
          if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });

  return (
    <FormDialog open title={t('documents.uploadTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.upload')} pending={add.isPending} error={formError}>
      <Alert severity="info">{t('documents.fileHint')}</Alert>
      <Box>
        <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />}>
          {t('documents.chooseFile')}
          {/* Only the name and size are read; the content never leaves the browser. */}
          <input
            hidden
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            aria-label={t('documents.file')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setValue('fileName', file?.name ?? '', { shouldValidate: true });
              setValue('sizeBytes', file?.size ?? 0, { shouldValidate: true });
            }}
          />
        </Button>
        <Typography variant="body2" sx={{ mt: 1 }} dir="ltr" color={fileError ? 'error' : 'text.secondary'}>
          {fileName || t('documents.noFile')}
        </Typography>
        {fileError && (
          <Typography variant="caption" color="error" role="alert">
            {fileError}
          </Typography>
        )}
      </Box>
      <TextField label={t('documents.name')} required {...textFieldProps(register, formState, 'name', translate)} />
      <Controller
        control={control}
        name="type"
        render={({ field, fieldState }) => (
          <TextField select required label={t('documents.type')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} error={Boolean(fieldState.error)} helperText={translate(fieldState.error?.message)}>
            {types.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`documents.types.${type}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <TextField label={t('documents.expiryDate')} type="date" {...textFieldProps(register, formState, 'expiryDate', translate, t('documents.expiryHint'))} slotProps={{ inputLabel: { shrink: true } }} />
    </FormDialog>
  );
}
