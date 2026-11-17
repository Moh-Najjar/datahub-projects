import { useMemo } from 'react';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentHierarchy } from '@/modules/organization/hooks/useOrganization';
import { buildTree, descendantIds, flattenTree } from '@/modules/organization/utils/hierarchy';

export interface DepartmentOption {
  value: string;
  label: string;
  depth: number;
  active: boolean;
  /** Not selectable (inactive, or would create a cycle). */
  disabled: boolean;
}

interface Options {
  /** The department being edited: it and its descendants cannot become its parent. */
  excludeTreeOf?: string;
  /** The currently saved value stays selectable even if it became inactive. */
  keep?: string | null;
  /** Skip the request (e.g. for roles that may not read the organization structure). */
  enabled?: boolean;
}

/** Departments in hierarchy order (indented by depth) for selects and filters. */
export function useDepartmentOptions({ excludeTreeOf, keep, enabled = true }: Options = {}) {
  const { language } = useLanguage();
  const query = useDepartmentHierarchy(enabled);

  const options = useMemo<DepartmentOption[]>(() => {
    const nodes = query.data ?? [];
    const excluded = excludeTreeOf ? new Set([excludeTreeOf, ...descendantIds(nodes, excludeTreeOf)]) : new Set<string>();
    return flattenTree(buildTree(nodes, language))
      .filter((n) => !excluded.has(n.id))
      .map((n) => ({
        value: n.id,
        label: n.name[language],
        depth: n.depth,
        active: n.status === 'active',
        disabled: n.status !== 'active' && n.id !== keep,
      }));
  }, [query.data, excludeTreeOf, keep, language]);

  return { options, isPending: query.isPending, isError: query.isError };
}
