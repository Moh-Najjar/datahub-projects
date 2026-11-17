import { useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';

export type ActivationStatus = 'active' | 'inactive';

interface StatusTarget {
  id: string;
  status: ActivationStatus;
}

export interface StatusFlowOptions<T extends StatusTarget> {
  mutation: UseMutationResult<unknown, Error, { id: string; status: ActivationStatus }>;
  name: (row: T) => string;
  confirmTitle: (name: string) => string;
  confirmText: string;
  confirmLabel: string;
  /** Feedback after a successful change. */
  successText: (name: string, status: ActivationStatus) => string;
  /** Message for a failed change (business reason or API error). */
  errorText: (error: unknown) => string;
  notify: (text: string, severity?: 'success' | 'error') => void;
}

/**
 * Activate / deactivate any record: deactivation asks for confirmation (and shows refusals such as "has active
 * subdepartments" inside the dialog); activation applies at once and reports errors as feedback.
 */
export function useStatusFlow<T extends StatusTarget>({ mutation, name, confirmTitle, confirmText, confirmLabel, successText, errorText, notify }: StatusFlowOptions<T>) {
  const [target, setTarget] = useState<T | null>(null);

  const change = (row: T, status: ActivationStatus) =>
    mutation.mutate(
      { id: row.id, status },
      {
        onSuccess: () => {
          setTarget(null);
          notify(successText(name(row), status));
        },
        onError: (error) => {
          if (status === 'active') notify(errorText(error), 'error');
        },
      },
    );

  const request = (row: T) => {
    mutation.reset();
    if (row.status === 'active') setTarget(row);
    else change(row, 'active');
  };

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title={target ? confirmTitle(name(target)) : ''}
      text={confirmText}
      confirmLabel={confirmLabel}
      pending={mutation.isPending}
      error={target && mutation.isError ? errorText(mutation.error) : undefined}
      onConfirm={() => target && change(target, 'inactive')}
      onClose={() => setTarget(null)}
    />
  );

  return { request, dialog };
}
