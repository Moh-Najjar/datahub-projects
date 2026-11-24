export interface CertificateDto {
  enrollmentId: string;
  /** Unique, stable reference printed on the certificate (`DH-CERT-<enrollment>-<yyyymmdd>`). */
  reference: string;
  traineeName: string;
  trainingId: string;
  trainingTitle: string;
  departmentName: string | null;
  trainerName: string | null;
  durationHours: number | null;
  /** ISO date-time the enrollment was completed. */
  completedAt: string;
}

export interface CertificateFilters {
  trainingId: string;
}
