export type NihInvestigator = {
  profileId: string | number | null;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  isContactPI: boolean;
  title: string;
};

export type NihProject = {
  [key: string]: unknown;
  applicationId: string | number | null;
  projectId: string | number | null;
  coreProjectNumber: string | null;
  projectTitle: string;
  fiscalYear: string | number | null;
  principalInvestigator: string;
  principalInvestigators: NihInvestigator[];
  organization: string;
  city: string;
  state: string;
  country: string;
  fundingAmount: number;
  activityCode: string;
  fundingAgency: string;
  fundingAgencyCode: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
  awardNoticeDate: string | null;
  projectDetailUrl: string | null;
  authorName?: string;
  authorAffiliation?: string;
  email?: string;
  recentPublication?: string | null;
  publicationDate?: string | null;
  pmid?: string | null;
  emailSource?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNihProject(value: unknown): value is NihProject {
  return (
    isRecord(value) &&
    typeof value.projectTitle === "string" &&
    typeof value.principalInvestigator === "string" &&
    typeof value.organization === "string" &&
    typeof value.country === "string"
  );
}
