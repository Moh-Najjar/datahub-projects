import { useState } from 'react';
import EditOutlined from '@mui/icons-material/EditOutlined';
import SyncAltOutlined from '@mui/icons-material/SyncAltOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import type { RowAction } from '@/modules/shared/RowActions';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Offer, OfferStatus } from '@/modules/recruitment/types/recruitment';
import { OfferFormDialog } from './OfferFormDialog';
import { OfferStatusDialog } from './OfferStatusDialog';

type Pending = { kind: 'edit'; offer: Offer } | { kind: 'status'; offer: Offer; status: OfferStatus } | null;

/** Offer actions offered only when the API allows them (`offer.can`, `offer.nextStatuses`). */
export function useOfferActions(notify: (text: string, severity?: 'success' | 'error') => void, options: { includeView?: boolean } = {}) {
  const { t } = useTranslation('recruitment');
  const [pending, setPending] = useState<Pending>(null);
  const close = () => setPending(null);

  const actionsFor = (o: Offer): RowAction[] => [
    ...(options.includeView === false ? [] : [{ label: t('actions.viewDetails'), icon: VisibilityOutlined, to: recruitmentPaths.offer(o.id) }]),
    ...(o.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => setPending({ kind: 'edit', offer: o }) }] : []),
    ...o.nextStatuses.map((s) => ({ label: t(`offerActions.${s}`), icon: SyncAltOutlined, onClick: () => setPending({ kind: 'status', offer: o, status: s }) })),
  ];

  const dialogs = pending && (
    <>
      {pending.kind === 'edit' && (
        <OfferFormDialog
          offer={pending.offer}
          onClose={close}
          onDone={(o) => {
            close();
            notify(t('offers.saved', { number: o.number }));
          }}
        />
      )}
      {pending.kind === 'status' && (
        <OfferStatusDialog
          offer={pending.offer}
          status={pending.status}
          onClose={close}
          onDone={(o) => {
            close();
            notify(t('offers.statusChanged', { number: o.number, status: t(`offerStatus.${o.status}`) }));
          }}
        />
      )}
    </>
  );
  return { actionsFor, dialogs };
}
