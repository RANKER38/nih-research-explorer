import { NextRequest, NextResponse } from "next/server";
import { isRecord } from "../../../../types/nih";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NIH_PROJECTS_API = "https://api.reporter.nih.gov/v2/projects/search";
const NIH_PUBLICATIONS_API =
  "https://api.reporter.nih.gov/v2/publications/search";
const PUBMED_SEARCH_API =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const RESULT_LIMIT = 500;
const JOURNAL_ARTICLE_LIMIT = 200;
const REQUEST_DELAY_MS = 1050;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type NihProjectRecord = Record<string, unknown>;
type TermCount = {
  keyword: string;
  projects: Set<string>;
};

const ignoredTerms = new Set([
  "active",
  "administration",
  "analysis",
  "approach",
  "based",
  "biological",
  "center",
  "centers",
  "clinical",
  "data",
  "development",
  "disease",
  "effect",
  "effects",
  "evaluation",
  "factors",
  "funded",
  "health",
  "human",
  "humans",
  "impact",
  "improve",
  "improved",
  "including",
  "institute",
  "investigation",
  "mechanism",
  "methods",
  "model",
  "models",
  "national",
  "new",
  "nih",
  "outcomes",
  "program",
  "project",
  "provide",
  "research",
  "researchers",
  "role",
  "study",
  "support",
  "system",
  "systems",
  "testing",
  "work",
  "goals",
  "address",
  "services",
  "grant",
  "grants",
  "establishment",
  "understanding",
  "using",
]);

function displayTerms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string") return [];

  const taggedTerms = Array.from(
    value.matchAll(/<([^<>]+)>/g),
    (match) => match[1].trim(),
  );

  return taggedTerms.length > 0
    ? taggedTerms
    : value.split(/[;,|\r\n]+/).map((term) => term.trim());
}

function normalizeTerm(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlePhrases(value: unknown): string[] {
  if (typeof value !== "string") return [];

  const words = value
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
  const phrases: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    for (const size of [3, 2]) {
      const phrase = words.slice(index, index + size);
      if (
        phrase.length === size &&
        phrase.every((word) => word.length > 2 && !ignoredTerms.has(word))
      ) {
        phrases.push(phrase.join(" "));
      }
    }
  }

  return phrases;
}

function projectIdentity(project: NihProjectRecord, index: number): string {
  return String(
    project.appl_id ??
      project.project_num ??
      project.core_project_num ??
      `project-${index}`,
  );
}

function buildSuggestions(
  projects: NihProjectRecord[],
  query: string,
): Array<{ keyword: string; projectCount: number }> {
  const counts = new Map<string, TermCount>();
  const queryTerms = new Set(
    normalizeTerm(query)
      .split(" ")
      .filter((term) => term.length > 2),
  );

  for (const [index, project] of projects.entries()) {
    const projectId = projectIdentity(project, index);
    const terms = new Map<string, string>();
    const candidates = [
      ...displayTerms(project.terms),
      ...displayTerms(project.pref_terms),
      ...titlePhrases(project.project_title),
    ];

    for (const candidate of candidates) {
      const normalized = normalizeTerm(candidate);
      if (
        normalized.length < 3 ||
        ignoredTerms.has(normalized) ||
        normalized.split(" ").every((word) => queryTerms.has(word))
      ) {
        continue;
      }
      if (!terms.has(normalized)) terms.set(normalized, candidate.trim());
    }

    for (const [normalized, keyword] of terms) {
      const existing = counts.get(normalized);
      if (existing) {
        existing.projects.add(projectId);
      } else {
        counts.set(normalized, {
          keyword,
          projects: new Set([projectId]),
        });
      }
    }
  }

  return Array.from(counts.values())
    .filter((item) => item.projects.size > 0)
    .sort(
      (first, second) =>
        second.projects.size - first.projects.size ||
        first.keyword.localeCompare(second.keyword),
    )
    .slice(0, 20)
    .map((item) => ({
      keyword: item.keyword,
      projectCount: item.projects.size,
    }));
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("NIH or PubMed returned an invalid JSON response.");
  }

  if (!isRecord(data)) {
    throw new Error("NIH or PubMed returned an unexpected response.");
  }

  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : typeof data.message === "string"
          ? data.message
          : `Request failed with HTTP ${response.status}.`;
    throw new Error(detail);
  }

  return data;
}

async function searchProjects(
  criteria: Record<string, unknown>,
): Promise<{ projects: NihProjectRecord[]; total: number }> {
  const response = await fetch(NIH_PROJECTS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      criteria,
      include_fields: [
        "ApplId",
        "ProjectNum",
        "CoreProjectNum",
        "ProjectTitle",
        "Terms",
        "PrefTerms",
      ],
      offset: 0,
      limit: RESULT_LIMIT,
    }),
    cache: "no-store",
  });
  const data = await readJson(response);

  return {
    projects: Array.isArray(data.results)
      ? data.results.filter(isRecord)
      : [],
    total:
      isRecord(data.meta) && typeof data.meta.total === "number"
        ? data.meta.total
        : 0,
  };
}

async function projectsForJournal(
  journal: string,
): Promise<{
  projects: NihProjectRecord[];
  total: number;
  journalArticles: number;
}> {
  const searchUrl = new URL(PUBMED_SEARCH_API);
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set(
    "term",
    `${journal.replace(/[\[\]"]/g, " ").trim()}[Journal]`,
  );
  searchUrl.searchParams.set("retmax", String(JOURNAL_ARTICLE_LIMIT));
  searchUrl.searchParams.set("retmode", "json");

  const searchResponse = await fetch(searchUrl, { cache: "no-store" });
  const searchData = await readJson(searchResponse);
  const searchResult = isRecord(searchData.esearchresult)
    ? searchData.esearchresult
    : {};
  const ids = Array.isArray(searchResult.idlist)
    ? searchResult.idlist.filter(
        (id): id is string | number =>
          typeof id === "string" || typeof id === "number",
      )
    : [];
  const articleCount =
    typeof searchResult.count === "string"
      ? Number(searchResult.count)
      : typeof searchResult.count === "number"
        ? searchResult.count
        : 0;

  if (ids.length === 0) {
    return { projects: [], total: 0, journalArticles: articleCount };
  }

  await sleep(REQUEST_DELAY_MS);
  const publicationResponse = await fetch(NIH_PUBLICATIONS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      criteria: { pmids: ids },
      offset: 0,
      limit: RESULT_LIMIT,
    }),
    cache: "no-store",
  });
  const publicationData = await readJson(publicationResponse);
  const publicationRows = Array.isArray(publicationData.results)
    ? publicationData.results.filter(isRecord)
    : [];
  const coreProjectNumbers = Array.from(
    new Set(
      publicationRows
        .map((row) =>
          String(
            row.coreproject ??
              row.core_project_num ??
              row.core_project_number ??
              "",
          ).trim(),
        )
        .filter(Boolean),
    ),
  );

  if (coreProjectNumbers.length === 0) {
    return { projects: [], total: 0, journalArticles: articleCount };
  }

  await sleep(REQUEST_DELAY_MS);
  const projects = await searchProjects({
    project_nums: coreProjectNumbers,
  });

  return { ...projects, journalArticles: articleCount };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  if (!isRecord(body) || typeof body.query !== "string") {
    return NextResponse.json(
      { success: false, error: "A keyword or journal name is required." },
      { status: 400 },
    );
  }

  const query = body.query.trim();
  const source = body.source;
  if (!query || query.length > 200) {
    return NextResponse.json(
      { success: false, error: "Enter a query between 1 and 200 characters." },
      { status: 400 },
    );
  }
  if (source !== "keyword" && source !== "journal") {
    return NextResponse.json(
      { success: false, error: "Choose keyword or journal suggestions." },
      { status: 400 },
    );
  }

  try {
    const result =
      source === "journal"
        ? await projectsForJournal(query)
        : {
            ...(await searchProjects({
              advanced_text_search: {
                operator: "and",
                search_field: "all",
                search_text: query,
              },
            })),
            journalArticles: null,
          };

    return NextResponse.json({
      success: true,
      source,
      query,
      matchedProjects: result.projects.length,
      totalMatches: result.total,
      journalArticles: result.journalArticles,
      suggestions: buildSuggestions(result.projects, query),
    });
  } catch (error) {
    console.error("NIH keyword suggestion error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate keyword suggestions.",
      },
      { status: 502 },
    );
  }
}
