import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import type { Breakpoint } from '@mui/material/styles';
import type { SortDirection } from '@/core/api/types';
import { formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { EmptyState, ErrorState } from './states';

export interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Server sort key; the column header becomes a sort control. */
  sortKey?: string;
  /** Hide this column below a breakpoint (the row stays complete in the detail view). */
  hideBelow?: Breakpoint;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[] | undefined;
  getRowId: (row: T) => string;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Empty state when there are no rows at all (`emptyFiltered` when filters/search are active). */
  empty: { title: string; description?: string; action?: ReactNode; icon?: ReactNode };
  emptyFiltered?: { title: string; description?: string; action?: ReactNode };
  hasActiveFilters?: boolean;
  /** Server paging; omit for a plain, un-paged table. */
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void };
  sort?: { sortBy: string | undefined; direction: SortDirection; onSort: (sortKey: string) => void };
  onRowClick?: (row: T) => void;
  /** Accessible name of the table. */
  label: string;
  /** Skeleton rows while loading (default 6). */
  skeletonRows?: number;
}

/**
 * Modern data table: server-side sort and pagination, skeleton loading, error with retry, empty and "no matches"
 * states, columns that hide on small screens. Rows scroll horizontally on very narrow screens.
 */
export function DataTable<T>({ columns, rows, getRowId, isLoading, error, onRetry, empty, emptyFiltered, hasActiveFilters, pagination, sort, onRowClick, label, skeletonRows = 6 }: DataTableProps<T>) {
  const t = useT();
  const { locale } = useLocale();
  const hide = (column: Column<T>) => (column.hideBelow ? { display: { xs: 'none', [column.hideBelow]: 'table-cell' } } : undefined);

  let body: ReactNode;
  if (error && !rows?.length) {
    body = null;
  } else if (isLoading && !rows) {
    body = Array.from({ length: skeletonRows }, (_, r) => (
      <TableRow key={r}>
        {columns.map((column) => (
          <TableCell key={column.id} sx={hide(column)}>
            <Skeleton variant="text" width={r % 2 ? '70%' : '90%'} />
          </TableCell>
        ))}
      </TableRow>
    ));
  } else {
    body = rows?.map((row) => (
      <TableRow key={getRowId(row)} hover={!!onRowClick} onClick={onRowClick ? () => onRowClick(row) : undefined} sx={{ cursor: onRowClick ? 'pointer' : undefined }}>
        {columns.map((column) => (
          <TableCell key={column.id} align={column.align} sx={hide(column)}>
            {column.render(row)}
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  const showError = !!error && !rows?.length;
  const showEmpty = !showError && !isLoading && rows?.length === 0;
  const emptyContent: { title: string; description?: string; action?: ReactNode; icon?: ReactNode } = hasActiveFilters && emptyFiltered ? emptyFiltered : empty;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table aria-label={label} aria-busy={isLoading}>
          <TableHead>
            <TableRow>
              {columns.map((column) => {
                const active = sort?.sortBy === column.sortKey;
                return (
                  <TableCell key={column.id} align={column.align} sortDirection={active ? sort?.direction : false} sx={{ width: column.width, ...hide(column) }}>
                    {column.sortKey && sort ? (
                      <TableSortLabel active={active} direction={active ? sort.direction : 'asc'} onClick={() => sort.onSort(column.sortKey!)}>
                        {column.header}
                      </TableSortLabel>
                    ) : (
                      column.header
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>{body}</TableBody>
        </Table>
      </TableContainer>
      {showError && <ErrorState error={error} onRetry={onRetry} dense />}
      {showEmpty && (
        <Box>
          <EmptyState dense title={emptyContent.title} description={emptyContent.description} action={emptyContent.action} icon={emptyContent.icon} />
        </Box>
      )}
      {pagination && !showError && (rows?.length ?? 0) > 0 && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={[5, 10, 25, 50]}
          onPageChange={(_, zeroBased) => pagination.onPageChange(zeroBased + 1)}
          onRowsPerPageChange={(event) => pagination.onPageSizeChange(Number(event.target.value))}
          labelRowsPerPage={t.common.rowsPerPage}
          labelDisplayedRows={({ from, to, count }) => `${formatNumber(from, locale)}–${formatNumber(to, locale)} ${t.common.of} ${formatNumber(count, locale)}`}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </Paper>
  );
}
