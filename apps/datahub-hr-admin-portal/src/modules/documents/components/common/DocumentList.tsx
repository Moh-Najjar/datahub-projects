import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { documentPaths } from '@/modules/documents/paths';
import type { DocumentSummary } from '@/modules/documents/types/documents';
import { formatDay } from '@/modules/documents/utils/format';
import { Code, DocumentStatusChip, ExpiryChip } from './Chips';

/** Compact, non-paginated documents table (employee, candidate and payroll panels). */
export function DocumentList({ label, documents, showOwner = false, emptyText }: { label: string; documents: readonly DocumentSummary[]; showOwner?: boolean; emptyText: string }) {
  const { t } = useTranslation('documents');
  const { language } = useLanguage();
  if (documents.length === 0) return <Typography color="text.secondary">{emptyText}</Typography>;
  const day = (d: string | null) => (d ? formatDay(d, language) : '—');
  return (
    <TableContainer sx={{ position: 'relative' }}>
      <Table size="small" aria-label={label} sx={{ '& .MuiTableCell-root': { px: { xs: 1, sm: 2 } } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('fields.document')}</TableCell>
            {showOwner && <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('fields.owner')}</TableCell>}
            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.category')}</TableCell>
            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', lg: 'table-cell' } }}>{t('fields.issueDate')}</TableCell>
            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('fields.expiryDate')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('fields.status')}</TableCell>
            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.expiry')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.map((d) => (
            <TableRow key={d.id} hover>
              <TableCell>
                <Link component={RouterLink} to={documentPaths.document(d.id)} underline="hover" sx={{ fontWeight: 500 }}>
                  {d.name}
                </Link>
                <Typography variant="caption" color="text.secondary" component="div">
                  <Code>{d.reference}</Code>
                  {d.source.module === 'leave' && d.source.reference ? (
                    <>
                      {' · '}
                      {t('source.leave', { reference: d.source.reference })}
                    </>
                  ) : null}
                  {d.owner.type === 'candidate' && !showOwner ? ` · ${t('source.recruitment')}` : null}
                </Typography>
              </TableCell>
              {showOwner && <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{d.owner.name[language]}</TableCell>}
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{d.category.name[language]}</TableCell>
              <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{day(d.issueDate)}</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{day(d.expiryDate)}</TableCell>
              <TableCell>
                <DocumentStatusChip status={d.status} />
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                <ExpiryChip status={d.expiryStatus} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
