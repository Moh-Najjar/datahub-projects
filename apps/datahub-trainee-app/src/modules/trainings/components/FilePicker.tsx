import { useId, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { formatFileSize } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { fill } from '@/i18n';
import { useT } from '@/i18n/useT';
import { FILE_ACCEPT, fileProblem } from '../utils/files';

interface FilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  label: string;
  multiple?: boolean;
  /** A server-side problem (translated) to show under the picker. */
  error?: string;
  required?: boolean;
}

/**
 * Chooses files for upload. Each file is checked against the original rules (not empty, ≤ 100 MB, allowed extension)
 * right away; invalid ones are listed with the reason and block saving through the parent's `onChange` contract.
 * The simulated backend keeps only name, type and size.
 */
export function FilePicker({ files, onChange, label, multiple = true, error, required }: FilePickerProps) {
  const t = useT();
  const { locale } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  const problemText = (file: File): string | null => {
    const problem = fileProblem({ fileName: file.name, fileSizeBytes: file.size });
    return problem ? t.apiReasons[problem] : null;
  };
  const hasInvalid = files.some((f) => problemText(f));

  return (
    <Box>
      <input
        ref={input}
        id={id}
        type="file"
        hidden
        multiple={multiple}
        accept={FILE_ACCEPT}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
          event.target.value = '';
        }}
      />
      <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => input.current?.click()} aria-describedby={`${id}-hint`}>
        {label}
        {required ? ' *' : ''}
      </Button>
      <Typography id={`${id}-hint`} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {t.files.hint}
      </Typography>
      {files.length > 0 && (
        <Stack spacing={0.75} sx={{ mt: 1.5 }} component="ul" aria-label={label} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {files.map((file, index) => {
            const problem = problemText(file);
            return (
              <Box component="li" key={`${file.name}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={problem ? 'error' : 'default'}
                  label={`${file.name} · ${formatFileSize(file.size, locale)}`}
                  onDelete={() => onChange(files.filter((_, i) => i !== index))}
                  deleteIcon={undefined}
                  aria-label={fill(t.files.remove, { name: file.name })}
                />
                {problem && (
                  <Typography variant="caption" color="error">
                    {problem}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
      {(error || hasInvalid) && (
        <Typography variant="caption" color="error" role="alert" sx={{ display: 'block', mt: 0.75 }}>
          {error ?? t.files.fixInvalid}
        </Typography>
      )}
    </Box>
  );
}
