/**
 * @datahub/shared-types — TypeScript types genuinely shared by DataHub applications.
 * Types only: no runtime code, no dependencies.
 *
 * Add a type here only when two or more applications use it; app-specific types stay in the app.
 */
export type { Direction, Locale, Localized } from './common/locale';
export type {
  WorkspaceHandoffIssuer,
  WorkspaceHandoffPayload,
  WorkspaceSessionRequest,
  WorkspaceSessionStatus,
} from './workspace/handoff';
