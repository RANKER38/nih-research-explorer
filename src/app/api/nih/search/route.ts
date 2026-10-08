import { NextRequest } from "next/server";
import { isRecord, type NihProject } from "../../../../types/nih";

const NIH_API_URL = "https://api.reporter.nih.gov/v2/projects/search";
const PAGE_SIZE = 500;
const MAX_OFFSET = 14999;
const REQUEST_DELAY_MS = 1050;
const MAX_TARGET = 30000;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type SearchRequest = {
  keywords?: string;
  fromYear?: number | null;
  toYear?: number | null;
  countries?: string[];
  limit?: number;
  projectType?: string;
  fundingAgency?: string;
  organization?: string;
};

type Criteria = Record<string, unknown>;
type ProgressCallback = (collected: number, status: string) => void;

type NihPage = {
  results: Record<string, unknown>[];
  total: number;
  searchId: string | null;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number"
    ? value
    : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRealFilterValue(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();

  if (!normalized) return false;

  return ![
    "all",
    "all countries",
    "all project types",
    "all project type",
    "all agencies",
    "all funding agencies",
    "all funding agency",
    "all organizations",
    "all organization",
    "any",
    "none",
  ].includes(normalized);
}

function buildCriteria(body: SearchRequest): Criteria {
  const {
    keywords = "",
    fromYear,
    toYear,
    countries = [],
    projectType = "",
    fundingAgency = "",
    organization = "",
  } = body;

  const criteria: Criteria = {};

  if (
    typeof fromYear === "number" &&
    typeof toYear === "number" &&
    Number.isFinite(fromYear) &&
    Number.isFinite(toYear)
  ) {
    const start = Math.min(fromYear, toYear);
    const end = Math.max(fromYear, toYear);
    criteria.fiscal_years = Array.from(
      { length: end - start + 1 },
      (_, index) => start + index,
    );
  }

  if (keywords.trim()) {
    criteria.advanced_text_search = {
      operator: "and",
      search_field: "all",
      search_text: keywords.trim(),
    };
  }

  if (Array.isArray(countries)) {
    const validCountries = countries
      .filter(isRealFilterValue)
      .map((country) => country.trim().toUpperCase());

    if (validCountries.length > 0) {
      criteria.org_countries = validCountries;
    }
  }

  if (isRealFilterValue(organization)) {
    criteria.org_names = [organization.trim()];
  }

  if (isRealFilterValue(fundingAgency)) {
    const agency = fundingAgency.trim().toUpperCase();
    if (/^[A-Z0-9]{2,10}$/.test(agency)) {
      criteria.agencies = [agency];
    }
  }

  // The current UI uses descriptive labels. Only send an NIH activity
  // code when the selected value is actually an activity code.
  if (isRealFilterValue(projectType)) {
    const activityCode = projectType.trim().toUpperCase();
    if (/^[A-Z]{1,4}[0-9]{1,3}$/.test(activityCode)) {
      criteria.activity_codes = [activityCode];
    }
  }

  return criteria;
}

function buildIncludeFields() {
  return [
    "ApplId",
    "FiscalYear",
    "ProjectNum",
    "CoreProjectNum",
    "ProjectTitle",
    "Organization",
    "PrincipalInvestigators",
    "ActivityCode",
    "AgencyIcAdmin",
    "AwardAmount",
    "ProjectStartDate",
    "ProjectEndDate",
    "ProjectDetailUrl",
    "AwardNoticeDate",
  ];
}

async function callNih(
  payload: Record<string, unknown>,
  waitBeforeRequest: boolean,
): Promise<NihPage> {
  if (waitBeforeRequest) {
    await sleep(REQUEST_DELAY_MS);
  }

  const response = await fetch(NIH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let data: Record<string, unknown>;

  try {
    const parsed: unknown = JSON.parse(text);
    data = isRecord(parsed) ? parsed : { raw: text };
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    console.error(
      "NIH API ERROR:",
      response.status,
      JSON.stringify(data, null, 2),
    );

    throw new Error(
      `NIH API returned ${response.status}: ${
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
            ? data.message
            : "Invalid request"
      }`,
    );
  }

  return {
    results: Array.isArray(data.results)
      ? data.results.filter(isRecord)
      : [],
    total: isRecord(data.meta) ? asNumber(data.meta.total) : 0,
    searchId:
      isRecord(data.meta) && typeof data.meta.search_id === "string"
        ? data.meta.search_id
        : null,
  };
}

async function continueSearchSet(
  first: NihPage,
  wanted: number,
  onProgress?: ProgressCallback,
): Promise<{ projects: Record<string, unknown>[]; total: number; requests: number }> {
  if (wanted <= 0) {
    return { projects: [], total: first.total, requests: 0 };
  }

  const total = first.total;
  const target = Math.min(wanted, total);
  const projects = [...first.results].slice(0, target);
  let requests = 0;

  onProgress?.(
    projects.length,
    `Collected ${projects.length.toLocaleString()} NIH records...`,
  );

  if (projects.length >= target) {
    return { projects, total, requests };
  }

  if (!first.searchId) {
    throw new Error(
      `NIH returned ${first.results.length} records but no search_id for a ${total.toLocaleString()}-record result set.`,
    );
  }

  let offset = projects.length;

  while (offset < target) {
    if (offset > MAX_OFFSET) {
      throw new Error(
        `NIH pagination reached its ${MAX_OFFSET.toLocaleString()} offset limit. The search must be partitioned further.`,
      );
    }

    const remaining = target - offset;

    const page = await callNih(
      {
        search_id: first.searchId,
        offset,
        limit: Math.min(PAGE_SIZE, remaining),
      },
      true,
    );

    requests += 1;

    if (page.results.length === 0) {
      throw new Error(
        `NIH returned an empty page at offset ${offset} while ${remaining.toLocaleString()} records were still requested.`,
      );
    }

    projects.push(...page.results);
    offset += page.results.length;

    onProgress?.(
      Math.min(offset, target),
      `Collected ${Math.min(offset, target).toLocaleString()} NIH records...`,
    );
  }

  return {
    projects: projects.slice(0, target),
    total,
    requests,
  };
}

function uniqueKey(project: Record<string, unknown>): string {
  return [
    project.appl_id ?? "",
    project.project_num ?? "",
    project.fiscal_year ?? "",
    project.subproject_id ?? "",
  ].join("|");
}

function transformProject(project: Record<string, unknown>): NihProject {
  const investigators = Array.isArray(project.principal_investigators)
    ? project.principal_investigators.filter(isRecord)
    : [];

  const contactPI =
    investigators.find((pi) => pi.is_contact_pi === true) ||
    investigators[0] ||
    null;

  const organization = isRecord(project.organization)
    ? project.organization
    : {};
  const agency = isRecord(project.agency_ic_admin)
    ? project.agency_ic_admin
    : {};

  return {
    applicationId: asStringOrNumber(project.appl_id),
    projectId: asStringOrNumber(project.project_num),
    coreProjectNumber: asString(project.core_project_num) || null,
    projectTitle: asString(project.project_title, "Untitled Project"),
    fiscalYear: asStringOrNumber(project.fiscal_year),
    principalInvestigator: asString(contactPI?.full_name, "N/A"),
    principalInvestigators: investigators.map((pi) => ({
      profileId: asStringOrNumber(pi.profile_id),
      firstName: asString(pi.first_name),
      middleName: asString(pi.middle_name),
      lastName: asString(pi.last_name),
      fullName: asString(pi.full_name),
      isContactPI: pi.is_contact_pi === true,
      title: asString(pi.title),
    })),
    organization: asString(organization.org_name, "N/A"),
    city: asString(organization.org_city),
    state: asString(organization.org_state_name) || asString(organization.org_state),
    country: asString(organization.org_country),
    fundingAmount: asNumber(project.award_amount),
    activityCode: asString(project.activity_code),
    fundingAgency:
      asString(agency.name) || asString(agency.abbreviation),
    fundingAgencyCode: asString(agency.code),
    projectStartDate: asString(project.project_start_date) || null,
    projectEndDate: asString(project.project_end_date) || null,
    awardNoticeDate: asString(project.award_notice_date) || null,
    projectDetailUrl: asString(project.project_detail_url) || null,
  };
}

function fiscalYearDateRange(year: number) {
  return {
    from_date: `${year - 1}-10-01`,
    to_date: `${year}-09-30`,
  };
}

async function collectDatePartition(
  criteria: Criteria,
  fromDate: string,
  toDate: string,
  target: number,
  onProgress?: ProgressCallback,
): Promise<{ projects: Record<string, unknown>[]; total: number; requests: number }> {
  if (target <= 0) {
    return { projects: [], total: 0, requests: 0 };
  }

  const partitionCriteria = {
    ...criteria,
    award_notice_date: {
      from_date: fromDate,
      to_date: toDate,
    },
  };

  const first = await callNih(
    {
      criteria: partitionCriteria,
      include_fields: buildIncludeFields(),
      offset: 0,
      limit: PAGE_SIZE,
      sort_field: "project_start_date",
      sort_order: "desc",
    },
    true,
  );

  if (first.total <= MAX_OFFSET + 1) {
    const set = await continueSearchSet(
      first,
      Math.min(target, first.total),
      onProgress,
    );

    return {
      projects: set.projects,
      total: first.total,
      requests: 1 + set.requests,
    };
  }

  // If a date partition is still larger than NIH's offset ceiling,
  // split the date range in half and recurse. This keeps every actual
  // paginated search below the 14,999 offset boundary.
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  const midpoint = new Date(
    Math.floor((from.getTime() + to.getTime()) / 2),
  );

  if (midpoint <= from || midpoint >= to) {
    throw new Error(
      `NIH returned more than ${MAX_OFFSET.toLocaleString()} records for an indivisible date range (${fromDate} to ${toDate}). Try narrowing the search by year, country, organization, or keyword.`,
    );
  }

  const midpointDate = midpoint.toISOString().slice(0, 10);
  const nextDay = new Date(midpoint.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const firstHalf = await collectDatePartition(
    criteria,
    fromDate,
    midpointDate,
    target,
    onProgress,
  );

  const remaining = Math.max(
    0,
    target - firstHalf.projects.length,
  );

  const secondHalf =
    remaining > 0
      ? await collectDatePartition(
          criteria,
          nextDay,
          toDate,
          remaining,
          onProgress,
        )
      : { projects: [], total: 0, requests: 0 };

  return {
    projects: [
      ...firstHalf.projects,
      ...secondHalf.projects,
    ].slice(0, target),
    total: firstHalf.total + secondHalf.total,
    requests:
      1 + firstHalf.requests + secondHalf.requests,
  };
}

async function collectPartitioned(
  baseCriteria: Criteria,
  years: number[],
  target: number,
  onProgress?: ProgressCallback,
): Promise<{ projects: Record<string, unknown>[]; matchingTotal: number; requests: number }> {
  const collected = new Map<string, Record<string, unknown>>();
  let matchingTotal = 0;
  let requests = 0;

  for (const year of years) {
    if (collected.size >= target) break;

    const yearCriteria = {
      ...baseCriteria,
      fiscal_years: [year],
    };

    const first = await callNih(
      {
        criteria: yearCriteria,
        include_fields: buildIncludeFields(),
        offset: 0,
        limit: PAGE_SIZE,
        sort_field: "project_start_date",
        sort_order: "desc",
      },
      requests > 0,
    );

    requests += 1;
    matchingTotal += first.total;

    const remaining = target - collected.size;

    if (first.total <= MAX_OFFSET + 1) {
      const set = await continueSearchSet(
        first,
        Math.min(remaining, first.total),
        onProgress,
      );

      requests += set.requests;

      set.projects.forEach((project) => {
        collected.set(uniqueKey(project), project);
      });

      continue;
    }

    // Fiscal year is too large for direct pagination. Use the federal
    // fiscal year's award-notice date window (Oct 1 through Sep 30),
    // then recursively split any oversized date partition.
    const range = fiscalYearDateRange(year);

    const set = await collectDatePartition(
      yearCriteria,
      range.from_date,
      range.to_date,
      remaining,
      onProgress,
    );

    requests += set.requests;

    set.projects.forEach((project) => {
      collected.set(uniqueKey(project), project);
    });
  }

  return {
    projects: Array.from(collected.values()).slice(0, target),
    matchingTotal,
    requests,
  };
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`${JSON.stringify(payload)}\n`),
        );
      };

      try {
        const body: SearchRequest = await request.json();

        const target = Math.min(
          Math.max(Number(body.limit) || 100, 1),
          MAX_TARGET,
        );

        const baseCriteria = buildCriteria(body);

        const years = Array.isArray(baseCriteria.fiscal_years)
          ? baseCriteria.fiscal_years
          : [2026];

        let rawProjects: Record<string, unknown>[] = [];
        let matchingTotal = 0;
        let requests = 0;

        send({
          type: "progress",
          percentage: 0,
          collected: 0,
          requested: target,
          status: "Starting NIH collection...",
        });

        const reportProgress: ProgressCallback = (collected, status) => {
          const safeCollected = Math.min(
            Math.max(Number(collected) || 0, 0),
            target,
          );

          send({
            type: "progress",
            percentage: Math.min(
              99,
              Math.round((safeCollected / target) * 100),
            ),
            collected: safeCollected,
            requested: target,
            status,
          });
        };

        // First request establishes the NIH search_id and gives us
        // the first 500 records. Those records are retained.
        const first = await callNih(
          {
            criteria: baseCriteria,
            include_fields: buildIncludeFields(),
            offset: 0,
            limit: PAGE_SIZE,
            sort_field: "project_start_date",
            sort_order: "desc",
          },
          false,
        );

        requests += 1;
        matchingTotal = first.total;

        reportProgress(
          Math.min(first.results.length, target),
          `Received first NIH page (${Math.min(first.results.length, target).toLocaleString()} records)...`,
        );

        if (first.total <= MAX_OFFSET + 1) {
          const set = await continueSearchSet(
            first,
            Math.min(target, first.total),
            reportProgress,
          );

          rawProjects = set.projects;
          matchingTotal = first.total;
          requests += set.requests;
        } else {
          send({
            type: "progress",
            percentage: Math.min(
              99,
              Math.round((Math.min(first.results.length, target) / target) * 100),
            ),
            collected: Math.min(first.results.length, target),
            requested: target,
            status: "Large NIH result set detected. Partitioning by fiscal year...",
          });

          const set = await collectPartitioned(
            baseCriteria,
            years,
            target,
            reportProgress,
          );

          rawProjects = set.projects;
          matchingTotal = first.total;
          requests += set.requests;
        }

        const projects = Array.from(
          new Map(
            rawProjects.map((project) => [
              uniqueKey(project),
              transformProject(project),
            ]),
          ).values(),
        ).slice(0, target);

        if (projects.length < target && matchingTotal >= target) {
          console.warn(
            `NIH returned ${projects.length} unique projects for a target of ${target}.`,
          );
        }

        send({
          type: "complete",
          success: true,
          total: matchingTotal,
          requested: target,
          fetched: projects.length,
          requests,
          projects,
        });
      } catch (error) {
        console.error("NIH Search Server Error:", error);

        send({
          type: "error",
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to connect to NIH RePORTER.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
