import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { filesApi } from '../api/trainingsApi';
import type { FileItemDto, FileKind } from '../types/content';
import { deliverFile, previewTypeOf } from '../utils/openFile';

/**
 * Opens (shows in a new tab when the browser can display it) or downloads a stored file of the given kind. The tab is
 * opened during the click — browsers block tabs opened after an await — and closed again when the download fails.
 */
export function useFileOpener(kind: FileKind) {
  const t = useT();
  const feedback = useFeedback();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const run = async (file: FileItemDto, show: boolean) => {
    if (pendingId) return;
    const tab = show && previewTypeOf(file) ? window.open('', '_blank') : null;
    setPendingId(file.id);
    try {
      deliverFile(await filesApi.download(kind, file.id), file, tab);
    } catch (error) {
      tab?.close();
      feedback.error(apiErrorMessage(t, error));
    } finally {
      setPendingId(null);
    }
  };

  return {
    /** Show it (PDF, image, text, video) or, for other types, download it. */
    open: (file: FileItemDto) => run(file, true),
    download: (file: FileItemDto) => run(file, false),
    pendingId,
  };
}
