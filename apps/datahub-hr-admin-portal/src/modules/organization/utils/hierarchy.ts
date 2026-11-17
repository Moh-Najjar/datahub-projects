import type { Locale } from '@/i18n/languages';
import type { HierarchyNode } from '@/modules/organization/types/organization';

/*
 * Pure helpers for the department hierarchy (used by the mock backend for validation and by the UI for the
 * tree view and the parent selector). Input is the flat list from `getDepartmentHierarchy`.
 */

export interface TreeNode extends HierarchyNode {
  children: TreeNode[];
  depth: number;
  /** Active employees of this unit and all its descendants. */
  totalEmployees: number;
}

type ParentLink = { id: string; parentId: string | null };

/** Ids of every descendant of `id` (children, grandchildren…). Safe even if the data contains a cycle. */
export function descendantIds(nodes: readonly ParentLink[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) if (n.parentId) childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n.id]);
  const result = new Set<string>();
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (result.has(next) || next === id) continue;
    result.add(next);
    stack.push(...(childrenOf.get(next) ?? []));
  }
  return result;
}

/**
 * Why `parentId` cannot be the parent of department `id` (`undefined` = allowed): a department cannot be its
 * own parent, nor a child of one of its own descendants (that would create a cycle).
 */
export function parentProblem(nodes: readonly ParentLink[], id: string | undefined, parentId: string | null): 'self' | 'circular' | undefined {
  if (!id || !parentId) return undefined;
  if (parentId === id) return 'self';
  return descendantIds(nodes, id).has(parentId) ? 'circular' : undefined;
}

/** Builds the tree: roots and children sorted by name in `language`; counts include descendants. */
export function buildTree(nodes: readonly HierarchyNode[], language: Locale): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string | null, HierarchyNode[]>();
  for (const n of nodes) {
    // A parent that is missing from the list makes the node a root rather than dropping it.
    const parent = n.parentId && byId.has(n.parentId) ? n.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), n]);
  }
  const collator = new Intl.Collator(language);
  const visited = new Set<string>();

  const build = (node: HierarchyNode, depth: number): TreeNode => {
    visited.add(node.id);
    const kids = (children.get(node.id) ?? [])
      .filter((c) => !visited.has(c.id))
      .sort((a, b) => collator.compare(a.name[language], b.name[language]))
      .map((c) => build(c, depth + 1));
    return { ...node, children: kids, depth, totalEmployees: node.employeeCount + kids.reduce((sum, k) => sum + k.totalEmployees, 0) };
  };

  return (children.get(null) ?? []).sort((a, b) => collator.compare(a.name[language], b.name[language])).map((n) => build(n, 0));
}

/** Depth-first list of the tree (for selects that show the hierarchy with indentation). */
export function flattenTree(tree: readonly TreeNode[]): TreeNode[] {
  return tree.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** Ids of every node that has children (for "expand all"). */
export function expandableIds(tree: readonly TreeNode[]): string[] {
  return flattenTree(tree)
    .filter((n) => n.children.length > 0)
    .map((n) => n.id);
}
