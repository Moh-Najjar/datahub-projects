import { invalid, notFound } from '@/core/api/mock/access';
import type { DbLink, DbMaterial, MaterialType } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import type { FileInput, FileMaterialInput, LinkItemInput, LinkMaterialInput, MaterialDto, TextMaterialInput } from '../types/content';
import type { ReorderInput } from '../types/training';
import { authorTraining, storeFiles, viewTraining } from './contentAccess';

/*
 * Simulated Training-content backend — the rules of the original TrainingMaterialService:
 *  - three kinds of material: Text, Link (one or more links) and File (one or more files, each ≤ 100 MB with an allowed
 *    extension); each has a title ≤ 200 characters;
 *  - a learner sees the content only of trainings they are enrolled in; only SuperAdmin / the DepartmentAdmin of the
 *    training's department can add, edit, delete and reorder content;
 *  - new content goes last; reordering stores each material's position.
 * Files are SIMULATED: metadata only (no bytes), so nothing can be downloaded.
 */

function toDto(material: DbMaterial): MaterialDto {
  return {
    id: material.id,
    trainingId: material.trainingId,
    type: material.type,
    title: material.title,
    sortOrder: material.sortOrder,
    textContent: material.textContent,
    files: material.files,
    links: material.links,
    uploadedByUserName: db().users.find((u) => u.id === material.uploadedByUserId)?.fullName ?? null,
    createdAt: material.createdAt,
  };
}

function cleanTitle(title: string): string {
  const value = title.trim();
  if (!value) invalid('title', 'field.required');
  if (value.length > 200) invalid('title', 'field.tooLong');
  return value;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toLinks(links: readonly LinkItemInput[]): DbLink[] {
  if (links.length === 0) invalid('links', 'link.required');
  return links.map((link) => {
    const url = link.url.trim();
    if (!url) invalid('links', 'field.required');
    if (url.length > 2048 || !isAbsoluteUrl(url)) invalid('links', 'link.invalid');
    const title = link.title?.trim() || null;
    if (title && title.length > 200) invalid('links', 'field.tooLong');
    return { id: newId('lnk'), title, url };
  });
}

function nextOrder(trainingId: string): number {
  const orders = db().materials.filter((m) => m.trainingId === trainingId).map((m) => m.sortOrder);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

/** The material and its training, when the caller may author it (and the material has the expected type). */
function authorMaterial(materialId: string, type?: MaterialType): DbMaterial {
  const material = db().materials.find((m) => m.id === materialId) ?? notFound('material.notFound');
  authorTraining(material.trainingId);
  if (type && material.type !== type) invalid('type', 'material.wrongType');
  return material;
}

function add(trainingId: string, type: MaterialType, title: string, parts: Pick<DbMaterial, 'textContent' | 'files' | 'links'>): MaterialDto {
  const { actor } = authorTraining(trainingId);
  const material: DbMaterial = { id: newId('mat'), trainingId, type, title, sortOrder: nextOrder(trainingId), uploadedByUserId: actor.userId, createdAt: new Date().toISOString(), ...parts };
  db().materials.push(material);
  commit();
  return toDto(material);
}

export const materialsMock = {
  list(trainingId: string): MaterialDto[] {
    viewTraining(trainingId);
    return db()
      .materials.filter((m) => m.trainingId === trainingId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toDto);
  },

  addText(trainingId: string, input: TextMaterialInput): MaterialDto {
    authorTraining(trainingId);
    const title = cleanTitle(input.title);
    if (!input.content.trim()) invalid('content', 'field.required');
    return add(trainingId, 'text', title, { textContent: input.content, files: [], links: [] });
  },

  addLinks(trainingId: string, input: LinkMaterialInput): MaterialDto {
    authorTraining(trainingId);
    const title = cleanTitle(input.title);
    return add(trainingId, 'link', title, { textContent: null, files: [], links: toLinks(input.links) });
  },

  addFiles(trainingId: string, input: FileMaterialInput): MaterialDto {
    authorTraining(trainingId);
    const title = cleanTitle(input.title);
    if (input.files.length === 0) invalid('files', 'file.required');
    return add(trainingId, 'file', title, { textContent: null, files: storeFiles(input.files), links: [] });
  },

  updateText(materialId: string, input: TextMaterialInput): MaterialDto {
    const material = authorMaterial(materialId, 'text');
    const title = cleanTitle(input.title);
    if (!input.content.trim()) invalid('content', 'field.required');
    material.title = title;
    material.textContent = input.content;
    commit();
    return toDto(material);
  },

  updateLinks(materialId: string, input: LinkMaterialInput): MaterialDto {
    const material = authorMaterial(materialId, 'link');
    const title = cleanTitle(input.title);
    material.title = title;
    material.links = toLinks(input.links);
    commit();
    return toDto(material);
  },

  renameFiles(materialId: string, input: { title: string }): MaterialDto {
    const material = authorMaterial(materialId, 'file');
    material.title = cleanTitle(input.title);
    commit();
    return toDto(material);
  },

  addFileItems(materialId: string, files: readonly FileInput[]): MaterialDto {
    const material = authorMaterial(materialId, 'file');
    if (files.length === 0) invalid('files', 'file.required');
    material.files.push(...storeFiles(files));
    commit();
    return toDto(material);
  },

  updateFileItem(materialId: string, fileId: string, input: { title: string | null }): MaterialDto {
    const material = authorMaterial(materialId, 'file');
    const file = material.files.find((f) => f.id === fileId) ?? notFound('file.notFound');
    const title = input.title?.trim() || null;
    if (title && title.length > 200) invalid('title', 'field.tooLong');
    file.title = title;
    commit();
    return toDto(material);
  },

  deleteFileItem(materialId: string, fileId: string): void {
    const material = authorMaterial(materialId, 'file');
    if (!material.files.some((f) => f.id === fileId)) notFound('file.notFound');
    material.files = material.files.filter((f) => f.id !== fileId);
    commit();
  },

  remove(materialId: string): void {
    const material = authorMaterial(materialId);
    const database = db();
    database.materials = database.materials.filter((m) => m.id !== material.id);
    commit();
  },

  reorder(trainingId: string, input: ReorderInput): void {
    authorTraining(trainingId);
    const materials = db().materials.filter((m) => m.trainingId === trainingId);
    const byId = new Map(materials.map((m) => [m.id, m]));
    input.orderedIds.forEach((id) => byId.get(id) ?? notFound('material.notFound'));
    input.orderedIds.forEach((id, index) => {
      byId.get(id)!.sortOrder = index;
    });
    commit();
  },
};
