import { navItem } from '@/core/routes/navigation';

/** URLs inside Recruitment (the base path comes from the navigation map). */
const base = navItem('recruitment').path;
const id = (value: string) => encodeURIComponent(value);

export const recruitmentPaths = {
  overview: base,
  requisitions: `${base}/requisitions`,
  requisition: (requisitionId: string) => `${base}/requisitions/${id(requisitionId)}`,
  candidates: `${base}/candidates`,
  candidate: (candidateId: string, tab?: string) => `${base}/candidates/${id(candidateId)}${tab ? `?tab=${tab}` : ''}`,
  convert: (candidateId: string) => `${base}/candidates/${id(candidateId)}/convert`,
  pipeline: `${base}/pipeline`,
  interviews: `${base}/interviews`,
  interview: (interviewId: string) => `${base}/interviews/${id(interviewId)}`,
  offers: `${base}/offers`,
  offer: (offerId: string) => `${base}/offers/${id(offerId)}`,
};

/** Employee Management profile (link only — through the navigation map). */
export const employeeProfilePath = (employeeId: string) => `${navItem('employees').path}/${id(employeeId)}`;
