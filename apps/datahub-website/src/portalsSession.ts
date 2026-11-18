/**
 * Entry of `/workspace-session.html` — the hidden Workspace session check embedded by the HR Admin portal (see
 * `modules/portals/api/sessionBridge.ts`). No React and no UI: it only reports the central session.
 */
import { startSessionBridge } from '@/modules/portals/api/sessionBridge';

startSessionBridge();
