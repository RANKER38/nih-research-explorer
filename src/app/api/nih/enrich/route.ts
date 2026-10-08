import { NextRequest, NextResponse } from "next/server";
import {
  isNihProject,
  isRecord,
  type NihProject,
} from "../../../../types/nih";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORTER_PUBLICATION_API =
  "https://api.reporter.nih.gov/v2/publications/search";
const PUBMED_EFETCH_API =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const REPORTER_BATCH_SIZE = 500;
const PUBMED_BATCH_SIZE = 100;
const REQUEST_DELAY_MS = 1050;
const PUBMED_DELAY_MS = 350;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PublicationLink = {
  coreProjectNumber: string;
  pmid: string;
};

type PubmedPublication = {
  pmid: string;
  title: string;
  date: string;
  authors: Array<{
    firstName: string;
    lastName: string;
    fullName: string;
    affiliations: string[];
  }>;
};

function xmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const value = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
        ? String.fromCodePoint(value)
        : entity;
    })
    .trim();
}

function cleanXmlText(value: string): string {
  return xmlDecode(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? cleanXmlText(match[1]) : "";
}

function parseDate(articleXml: string): string {
  const year = tagValue(articleXml, "Year");
  const month = tagValue(articleXml, "Month");
  const day = tagValue(articleXml, "Day");

  if (year && month && day) return `${year}-${month}-${day}`;
  if (year && month) return `${year}-${month}`;
  if (year) return year;

  const medline = articleXml.match(
    /<PubDate>([\s\S]*?)<\/PubDate>/i,
  )?.[1];
  return medline ? cleanXmlText(medline) : "";
}

function parseAuthors(articleXml: string): PubmedPublication["authors"] {
  const authorList = articleXml.match(
    /<AuthorList[^>]*>([\s\S]*?)<\/AuthorList>/i,
  )?.[1];

  if (!authorList) return [];

  const authors = Array.from(
    authorList.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/gi),
  );

  return authors.map((match) => {
    const xml = match[1];
    const firstName = tagValue(xml, "ForeName") || tagValue(xml, "FirstName");
    const lastName = tagValue(xml, "LastName");
    const collective = tagValue(xml, "CollectiveName");

    const affiliations = Array.from(
      xml.matchAll(/<Affiliation>([\s\S]*?)<\/Affiliation>/gi),
    ).map((m) => cleanXmlText(m[1]));

    const fullName = collective || [firstName, lastName].filter(Boolean).join(" ");

    return {
      firstName,
      lastName,
      fullName,
      affiliations,
    };
  });
}

function parsePubmedXml(xml: string): PubmedPublication[] {
  const articles = Array.from(
    xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi),
  );

  return articles.map((match) => {
    const article = match[1];
    const pmid = tagValue(article, "PMID");
    const title = tagValue(article, "ArticleTitle");

    return {
      pmid,
      title,
      date: parseDate(article),
      authors: parseAuthors(article),
    };
  });
}

function extractEmails(text: string): string[] {
  return Array.from(
    text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
    (match) => match[0].toLowerCase(),
  );
}

type PublicEmailAuthor = {
  project: NihProject;
  authorName: string;
  email: string;
  affiliation: string;
  publication: PubmedPublication;
};

function authorsWithPublicEmailsByProject(
  links: PublicationLink[],
  publications: Map<string, PubmedPublication>,
  projects: NihProject[],
): PublicEmailAuthor[] {
  const matches = new Map<string, PublicEmailAuthor>();

  const projectByCore = new Map<string, NihProject>();
  for (const project of projects) {
    const core = String(project.coreProjectNumber || "").trim();
    if (core) projectByCore.set(core, project);
  }

  for (const link of links) {
    const publication = publications.get(link.pmid);
    if (!publication) continue;

    const project = projectByCore.get(link.coreProjectNumber);
    if (!project) continue;

    for (const author of publication.authors) {
      for (const affiliation of author.affiliations) {
        for (const email of extractEmails(affiliation)) {
          const authorName = author.fullName.trim() || "Unknown author";
          const existing = matches.get(email);

          if (!existing || publication.date > existing.publication.date) {
            matches.set(email, {
              project,
              authorName,
              email,
              affiliation,
              publication,
            });
          }
        }
      }
    }
  }

  return Array.from(matches.values());
}


async function reporterPublicationSearch(coreProjectNums: string[]) {
  await sleep(REQUEST_DELAY_MS);

  const firstResponse = await fetch(REPORTER_PUBLICATION_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      criteria: { core_project_nums: coreProjectNums },
      offset: 0,
      limit: REPORTER_BATCH_SIZE,
    }),
    cache: "no-store",
  });

  const firstText = await firstResponse.text();
  let firstData: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(firstText);
    firstData = isRecord(parsed) ? parsed : {};
  } catch {
    firstData = {};
  }

  if (!firstResponse.ok) {
    const detail =
      typeof firstData.detail === "string"
        ? firstData.detail
        : typeof firstData.message === "string"
          ? firstData.message
          : "Invalid response";
    throw new Error(
      `NIH Publication API returned ${firstResponse.status}: ${detail}`,
    );
  }

  const rows: Record<string, unknown>[] = Array.isArray(firstData.results)
    ? firstData.results.filter(isRecord)
    : [];
  const metadata = isRecord(firstData.meta) ? firstData.meta : {};
  const total =
    typeof metadata.total === "number" ? metadata.total : rows.length;
  const searchId =
    typeof metadata.search_id === "string" ? metadata.search_id : null;

  if (!searchId || rows.length >= total) return rows;

  let offset = rows.length;

  while (offset < total && offset <= 9999) {
    await sleep(REQUEST_DELAY_MS);

    const response = await fetch(REPORTER_PUBLICATION_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        search_id: searchId,
        offset,
        limit: Math.min(REPORTER_BATCH_SIZE, total - offset),
      }),
      cache: "no-store",
    });

    const text = await response.text();
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(text);
      data = isRecord(parsed) ? parsed : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
            ? data.message
            : "Invalid response";
      throw new Error(
        `NIH Publication pagination returned ${response.status}: ${detail}`,
      );
    }

    const page = Array.isArray(data.results)
      ? data.results.filter(isRecord)
      : [];
    if (page.length === 0) break;

    rows.push(...page);
    offset += page.length;
  }

  return rows;
}
async function pubmedFetch(pmids: string[]): Promise<PubmedPublication[]> {
  if (pmids.length === 0) return [];

  await sleep(PUBMED_DELAY_MS);

  const url = new URL(PUBMED_EFETCH_API);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("retmode", "xml");
  url.searchParams.set("tool", "nih-research-explorer");

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/xml" },
  });

  const xml = await response.text();
  if (!response.ok) {
    throw new Error(`PubMed returned ${response.status}.`);
  }

  return parsePubmedXml(xml);
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const projects =
    isRecord(requestBody) && Array.isArray(requestBody.projects)
      ? requestBody.projects.filter(isNihProject)
      : [];

  if (projects.length === 0) {
    return NextResponse.json({
      success: true,
      enriched: 0,
      emailCount: 0,
      projects: [],
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        const links: PublicationLink[] = [];

        for (let i = 0; i < projects.length; i += REPORTER_BATCH_SIZE) {
          const batch = projects.slice(i, i + REPORTER_BATCH_SIZE);
          const coreNums = Array.from(
            new Set(
              batch
                .map((project) => String(project.coreProjectNumber || "").trim())
                .filter(Boolean),
            ),
          );

          if (coreNums.length > 0) {
            const rows = await reporterPublicationSearch(coreNums);
            for (const row of rows) {
              const core = String(
                row.core_project_num ??
                  row.core_project_number ??
                  row.coreproject ??
                  "",
              ).trim();
              const pmid = String(row.pmid ?? "").trim();
              if (core && pmid) links.push({ coreProjectNumber: core, pmid });
            }
          }

          const processed = Math.min(i + batch.length, projects.length);
          send({
            type: "progress",
            stage: "linking",
            percentage: Math.round((processed / projects.length) * 40),
            processed,
            total: projects.length,
            status: `Linked publications for ${processed.toLocaleString()} of ${projects.length.toLocaleString()} projects`,
          });
        }

        const uniquePmids = Array.from(new Set(links.map((link) => link.pmid)));
        const publications = new Map<string, PubmedPublication>();

        for (let i = 0; i < uniquePmids.length; i += PUBMED_BATCH_SIZE) {
          const batch = uniquePmids.slice(i, i + PUBMED_BATCH_SIZE);
          const rows = await pubmedFetch(batch);
          rows.forEach((row) => {
            if (row.pmid) publications.set(row.pmid, row);
          });

          const processed = Math.min(i + batch.length, uniquePmids.length);
          send({
            type: "progress",
            stage: "pubmed",
            percentage:
              40 +
              (uniquePmids.length > 0
                ? Math.round((processed / uniquePmids.length) * 50)
                : 50),
            processed,
            total: uniquePmids.length,
            status: `Reading PubMed records ${processed.toLocaleString()} of ${uniquePmids.length.toLocaleString()}`,
          });
        }

        const authorEmailMatches = authorsWithPublicEmailsByProject(
          links,
          publications,
          projects,
        );

        const enrichedProjects = authorEmailMatches.map((match) => ({
          ...match.project,
          authorName: match.authorName,
          authorAffiliation: match.affiliation,
          email: match.email,
          recentPublication: match.publication.title || null,
          publicationDate: match.publication.date || null,
          pmid: match.publication.pmid || null,
          emailSource: "PubMed author affiliation",
        }));

        send({
          type: "complete",
          success: true,
          enriched: enrichedProjects.length,
          emailCount: new Set(enrichedProjects.map((project) => project.email))
            .size,
          linkedPublications: links.length,
          pubmedRecords: publications.size,
          projects: enrichedProjects,
        });

        controller.close();
      } catch (error) {
        console.error("NIH Publication Enrichment Error:", error);
        send({
          type: "error",
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Publication enrichment failed.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
