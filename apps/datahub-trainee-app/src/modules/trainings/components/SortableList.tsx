import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useT } from '@/i18n/useT';

export interface SortableControls {
  index: number;
  dragging: boolean;
}

interface SortableListProps<T> {
  items: readonly T[];
  getId: (item: T) => string;
  /** Called with the new order of ids when a drag ends or an item is moved with the buttons. */
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, controls: SortableControls) => ReactNode;
  /** Accessible name of the list. */
  label: string;
  /** Turns reordering off (e.g. while saving, or for roles that cannot reorder). */
  disabled?: boolean;
}

/**
 * A list that can be reordered by drag and drop (HTML5, with a drag handle) AND with "move up / move down" buttons
 * for keyboard and assistive-technology users. It owns no data: it reports the new order of ids.
 */
export function SortableList<T>({ items, getId, onReorder, renderItem, label, disabled = false }: SortableListProps<T>) {
  const t = useT();
  const [order, setOrder] = useState<string[]>(() => items.map(getId));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const startOrder = useRef<string[]>([]);

  // Follow the source of truth unless the user is dragging right now. Keyed by the ids (not the array or the `getId`
  // function identity), so an inline `getId` can never cause a render loop. (Adjusting state while rendering, the
  // React-recommended way to derive state from props, instead of an effect.)
  const sourceKey = items.map(getId).join('\u0000');
  const [seenKey, setSeenKey] = useState(sourceKey);
  if (seenKey !== sourceKey && draggingId === null) {
    setSeenKey(sourceKey);
    setOrder(sourceKey ? sourceKey.split('\u0000') : []);
  }

  const byId = new Map(items.map((item) => [getId(item), item]));
  const ordered = order.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id!);
    setOrder(next);
    return next;
  };

  const onDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    startOrder.current = order;
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    const row = (event.currentTarget as HTMLElement).closest('li');
    if (row) event.dataTransfer.setDragImage(row, 16, 16);
  };

  const onDragEnter = (overId: string) => {
    if (!draggingId || draggingId === overId) return;
    const from = order.indexOf(draggingId);
    const to = order.indexOf(overId);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const onDragEnd = () => {
    const changed = order.some((id, i) => id !== startOrder.current[i]);
    setDraggingId(null);
    if (changed) onReorder(order);
  };

  return (
    <Box component="ul" aria-label={label} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
      {ordered.map((item, index) => {
        const id = getId(item);
        const dragging = draggingId === id;
        return (
          <Box
            component="li"
            key={id}
            onDragOver={disabled ? undefined : (event: DragEvent) => event.preventDefault()}
            onDragEnter={disabled ? undefined : () => onDragEnter(id)}
            sx={{ display: 'flex', alignItems: 'stretch', gap: 1, opacity: dragging ? 0.55 : 1, transition: 'opacity .12s' }}
          >
            {!disabled && (
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Tooltip title={t.sortable.dragHandle}>
                  <Box
                    draggable
                    onDragStart={(event: DragEvent<HTMLElement>) => onDragStart(event, id)}
                    onDragEnd={onDragEnd}
                    aria-hidden
                    sx={{ cursor: 'grab', color: 'text.secondary', display: 'grid', placeItems: 'center', p: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, '&:active': { cursor: 'grabbing' } }}
                  >
                    <DragIndicatorIcon />
                  </Box>
                </Tooltip>
                <IconButton size="small" aria-label={t.sortable.moveUp} disabled={index === 0} onClick={() => { const next = move(index, index - 1); if (next) onReorder(next); }}>
                  <ArrowUpwardIcon fontSize="inherit" />
                </IconButton>
                <IconButton size="small" aria-label={t.sortable.moveDown} disabled={index === ordered.length - 1} onClick={() => { const next = move(index, index + 1); if (next) onReorder(next); }}>
                  <ArrowDownwardIcon fontSize="inherit" />
                </IconButton>
              </Stack>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>{renderItem(item, { index, dragging })}</Box>
          </Box>
        );
      })}
    </Box>
  );
}
