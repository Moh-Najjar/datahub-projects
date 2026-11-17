import { describe, expect, it } from 'vitest';
import type { HierarchyNode } from '@/modules/organization/types/organization';
import { buildTree, descendantIds, expandableIds, flattenTree, parentProblem } from './hierarchy';

const node = (id: string, parentId: string | null, employeeCount: number, en = id, ar = id): HierarchyNode => ({
  id,
  code: id.toUpperCase(),
  name: { en, ar },
  parentId,
  manager: null,
  status: 'active',
  employeeCount,
});

// a ─┬─ b ── d
//    └─ c
// e
const NODES = [node('a', null, 1, 'Alpha', 'ي'), node('b', 'a', 2, 'Bravo', 'ب'), node('c', 'a', 3, 'Charlie', 'أ'), node('d', 'b', 4, 'Delta'), node('e', null, 5, 'Echo', 'ا')];

describe('department hierarchy helpers', () => {
  it('finds all descendants', () => {
    expect([...descendantIds(NODES, 'a')].sort()).toEqual(['b', 'c', 'd']);
    expect([...descendantIds(NODES, 'b')]).toEqual(['d']);
    expect(descendantIds(NODES, 'd').size).toBe(0);
  });

  it('prevents circular parents', () => {
    expect(parentProblem(NODES, 'a', 'a')).toBe('self');
    expect(parentProblem(NODES, 'a', 'b')).toBe('circular');
    expect(parentProblem(NODES, 'a', 'd')).toBe('circular'); // grandchild
    expect(parentProblem(NODES, 'b', 'c')).toBeUndefined(); // sibling is fine
    expect(parentProblem(NODES, 'd', 'e')).toBeUndefined();
    expect(parentProblem(NODES, undefined, 'a')).toBeUndefined(); // new department
    expect(parentProblem(NODES, 'a', null)).toBeUndefined(); // top level
  });

  it('builds a tree with depths, totals including descendants and names sorted per language', () => {
    const tree = buildTree(NODES, 'en');
    expect(tree.map((n) => n.id)).toEqual(['a', 'e']);
    expect(tree[0]!.children.map((n) => n.id)).toEqual(['b', 'c']);
    expect(tree[0]!.totalEmployees).toBe(1 + 2 + 3 + 4);
    expect(tree[0]!.children[0]!.children[0]).toMatchObject({ id: 'd', depth: 2, totalEmployees: 4 });
    // Arabic order follows the Arabic names.
    const arabic = buildTree(NODES, 'ar');
    expect(arabic.map((n) => n.id)).toEqual(['e', 'a']);
    expect(arabic.find((n) => n.id === 'a')!.children.map((n) => n.id)).toEqual(['c', 'b']);
    expect(flattenTree(tree).map((n) => n.id)).toEqual(['a', 'b', 'd', 'c', 'e']);
    expect(expandableIds(tree).sort()).toEqual(['a', 'b']);
  });

  it('is robust to orphans and corrupt cycles in the data', () => {
    const orphan = buildTree([node('x', 'missing', 1)], 'en');
    expect(orphan.map((n) => n.id)).toEqual(['x']);
    const cyclic = [node('p', 'q', 1), node('q', 'p', 1)];
    expect(() => descendantIds(cyclic, 'p')).not.toThrow();
    expect([...descendantIds(cyclic, 'p')]).toEqual(['q']);
  });
});
