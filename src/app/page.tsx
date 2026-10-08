"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { isNihProject, isRecord, type NihProject } from "../types/nih";

const years = Array.from({ length: 27 }, (_, i) => 2026 - i);

const countries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

const recordLimits = [1000, 5000, 10000, 25000, 30000];

const projectTypes = [
  "All Project Types",
  "Research Project",
  "Clinical Trial",
  "Training",
  "Career Development",
  "Small Business",
  "Fellowship",
];

const fundingAgencies = [
  "All Funding Agencies",
  "NCI",
  "NIAID",
  "NHLBI",
  "NINDS",
  "NIGMS",
  "NICHD",
  "NIDDK",
  "NEI",
  "NIA",
];



export default function Home() {
  const [keywords, setKeywords] = useState("");
  const [fromYear, setFromYear] = useState("2020");
  const [toYear, setToYear] = useState("2026");

  const [results, setResults] = useState<NihProject[]>([]);
  const [totalResults, setTotalResults] = useState(0);  

  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const [limit, setLimit] = useState("30000");

  const [projectType, setProjectType] =
    useState("All Project Types");

  const [fundingAgency, setFundingAgency] =
    useState("All Funding Agencies");

  const [organization, setOrganization] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState("");
  const [collectionProgress, setCollectionProgress] = useState(0);
  const [collectedCount, setCollectedCount] = useState(0);
  const [collectionStatus, setCollectionStatus] = useState("");

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    if (!query) {
      return countries;
    }

    return countries.filter((country) =>
      country.toLowerCase().includes(query),
    );
  }, [countrySearch]);

  const toggleCountry = (country: string) => {
    setSelectedCountries((current) =>
      current.includes(country)
        ? current.filter((item) => item !== country)
        : [...current, country],
    );
  };

  const selectAllCountries = () => {
    setSelectedCountries(countries);
  };

  const clearCountries = () => {
    setSelectedCountries([]);
    setCountrySearch("");
  };

 const handleSearch = async () => {
  if (!keywords.trim()) return;
  if (!fromYear || !toYear || Number(fromYear) > Number(toYear)) return;

  const requestedLimit = Number(limit) || 100;

  setIsSearching(true);
  setSearchCompleted(false);
  setCollectionProgress(0);
  setCollectedCount(0);
  setCollectionStatus("Starting NIH collection...");
  setCollectionMessage(
    `Collecting up to ${requestedLimit.toLocaleString()} NIH records.`,
  );

  try {
    const response = await fetch("/api/nih/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: keywords.trim(),
        fromYear: Number(fromYear),
        toYear: Number(toYear),
        countries: selectedCountries,
        limit: requestedLimit,
        projectType,
        fundingAgency,
        organization,
      }),
    });

    if (!response.ok || !response.body) {
      let message = "Failed to start NIH collection.";
      try {
        const errorData = await response.json();
        message = errorData.error || message;
      } catch {}
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let projectsFromNih: NihProject[] = [];
    let completed = false;

    const processNihLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (parseError) {
        console.warn("Ignoring invalid NIH stream line:", rawLine, parseError);
        return;
      }
      if (!isRecord(parsed)) return;
      const data = parsed;

      if (data.type === "progress") {
        const collected = Number(data.collected) || 0;
        setCollectionProgress(
          Math.max(0, Math.min(99, Number(data.percentage) || 0)),
        );
        setCollectedCount(collected);
        setCollectionStatus(
          typeof data.status === "string"
            ? data.status
            : "Collecting NIH records...",
        );
        setCollectionMessage(
          `${collected.toLocaleString()} / ${requestedLimit.toLocaleString()} NIH records collected.`,
        );
        return;
      }

      if (data.type === "error") {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "NIH collection failed.",
        );
      }

      if (data.type === "complete") {
        completed = true;
        projectsFromNih = Array.isArray(data.projects)
          ? data.projects.filter(isNihProject)
          : [];

        const fetched =
          Number(data.fetched) || projectsFromNih.length;

        setResults(projectsFromNih);
        setTotalResults(fetched);
        setCollectedCount(fetched);
        setCollectionProgress(90);
        setCollectionStatus(
          "NIH collection complete. Finding publications and emails...",
        );
        setCollectionMessage(
          `${fetched.toLocaleString()} NIH records collected. Enriching publications...`,
        );
      }
    };

    while (true) {
      const { value, done } = await reader.read();

      buffer += decoder.decode(
        value || new Uint8Array(),
        { stream: !done },
      );

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        processNihLine(line);
      }

      // A ReadableStream is allowed to finish without a trailing newline.
      // Always process the final buffered NDJSON object before exiting.
      if (done) {
        if (buffer.trim()) {
          processNihLine(buffer);
          buffer = "";
        }
        break;
      }
    }

    if (!completed) {
      throw new Error(
        "NIH collection ended before completion. No complete event was received from /api/nih/search.",
      );
    }

    // Publication + email enrichment is a separate real-data stage.
    // IMPORTANT: Never send all 25,000/30,000 NIH records in one request.
    // Enrich in small batches so Next.js does not reject a large JSON payload.
    if (projectsFromNih.length > 0) {
      const ENRICH_BATCH_SIZE = 250;
      const enrichedAllProjects: NihProject[] = [];
      const seenEmails = new Set<string>();
      let totalLinkedPublications = 0;
      let totalPubmedRecords = 0;
      let enrichmentHadError = false;

      const totalBatches = Math.ceil(
        projectsFromNih.length / ENRICH_BATCH_SIZE,
      );

      for (
        let batchIndex = 0;
        batchIndex < totalBatches;
        batchIndex++
      ) {
        const startIndex = batchIndex * ENRICH_BATCH_SIZE;
        const batch = projectsFromNih.slice(
          startIndex,
          startIndex + ENRICH_BATCH_SIZE,
        );

        setCollectionStatus(
          `Enriching publications batch ${batchIndex + 1} of ${totalBatches}...`,
        );
        setCollectionMessage(
          `Finding publications and emails for ${startIndex.toLocaleString()} - ${Math.min(
            startIndex + batch.length,
            projectsFromNih.length,
          ).toLocaleString()} of ${projectsFromNih.length.toLocaleString()} NIH records.`,
        );

        try {
          const enrichResponse = await fetch("/api/nih/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projects: batch }),
          });

          if (!enrichResponse.ok) {
            let serverMessage =
              `Enrichment request failed with HTTP ${enrichResponse.status}.`;

            try {
              const errorText = await enrichResponse.text();

              if (errorText) {
                try {
                  const errorJson = JSON.parse(errorText);
                  serverMessage =
                    errorJson.error ||
                    errorJson.message ||
                    serverMessage;
                } catch {
                  serverMessage =
                    errorText.slice(0, 500) || serverMessage;
                }
              }
            } catch {
              // Keep the HTTP status message.
            }

            throw new Error(serverMessage);
          }

          if (!enrichResponse.body) {
            throw new Error(
              "The enrichment server returned an empty response.",
            );
          }

          const enrichReader = enrichResponse.body.getReader();
          let enrichBuffer = "";
          let batchCompleted = false;
          let batchProjects: NihProject[] = [];

          const processEnrichmentLine = (rawLine: string) => {
            const line = rawLine.trim();
            if (!line) return;

            let parsed: unknown;

            try {
              parsed = JSON.parse(line);
            } catch (parseError) {
              console.warn(
                "Ignoring invalid enrichment stream line:",
                rawLine,
                parseError,
              );
              return;
            }
            if (!isRecord(parsed)) return;
            const data = parsed;

            if (data.type === "progress") {
              const localPercent = Number(data.percentage) || 0;
              const overallPercent =
                90 +
                Math.round(
                  ((batchIndex + localPercent / 100) / totalBatches) * 10,
                );

              setCollectionProgress(Math.min(99, overallPercent));
              setCollectionStatus(
                (typeof data.status === "string" && data.status) ||
                  `Enriching batch ${batchIndex + 1} of ${totalBatches}...`,
              );
              return;
            }

            if (data.type === "error") {
              console.error(
                "Publication enrichment error:",
                data.error,
              );
              enrichmentHadError = true;
              setCollectionStatus(
                `Publication enrichment issue in batch ${
                  batchIndex + 1
                }. Continuing with NIH data...`,
              );
              return;
            }

            if (data.type === "complete") {
              batchCompleted = true;
              batchProjects = Array.isArray(data.projects)
                ? data.projects.filter(isNihProject)
                : [];
              totalLinkedPublications +=
                Number(data.linkedPublications) || 0;
              totalPubmedRecords += Number(data.pubmedRecords) || 0;
            }
          };

          while (true) {
            const { value, done } = await enrichReader.read();

            enrichBuffer += decoder.decode(
              value || new Uint8Array(),
              { stream: !done },
            );

            const lines = enrichBuffer.split(/\r?\n/);
            enrichBuffer = lines.pop() || "";

            for (const line of lines) {
              processEnrichmentLine(line);
            }

            if (done) {
              if (enrichBuffer.trim()) {
                processEnrichmentLine(enrichBuffer);
                enrichBuffer = "";
              }
              break;
            }
          }

          if (!batchCompleted) {
            console.warn(
              `Enrichment batch ${batchIndex + 1} did not complete. No author-email records from this batch will be included.`,
            );
            batchProjects = [];
            enrichmentHadError = true;
          }
          const uniqueProjects: NihProject[] = [];
          for (const project of batchProjects) {
            const email = project.email?.trim().toLowerCase();
            if (!email || seenEmails.has(email)) continue;
            seenEmails.add(email);
            uniqueProjects.push(project);
          }
          enrichedAllProjects.push(...uniqueProjects);

          setResults([
            ...enrichedAllProjects,
            ...projectsFromNih.slice(startIndex + batch.length),
          ]);
          setCollectedCount(projectsFromNih.length);
          setCollectionProgress(
            Math.min(
              99,
              90 +
                Math.round(
                  ((batchIndex + 1) / totalBatches) * 10,
                ),
            ),
          );
        } catch (batchError) {
          console.error(
            `Enrichment batch ${batchIndex + 1} failed:`,
            batchError,
          );

          enrichmentHadError = true;
          // Do not label unverified NIH project rows as author-email results.
          setCollectionStatus(
            `Publication enrichment batch ${
              batchIndex + 1
            } failed; those records were excluded because no author email was verified.`,
          );
        }
      }

      setResults(enrichedAllProjects);
      setTotalResults(enrichedAllProjects.length);
      setCollectedCount(enrichedAllProjects.length);
      setCollectionProgress(100);

      setCollectionStatus(
        enrichmentHadError
          ? "Collection complete; successfully verified author-email records are shown."
          : "Collection and author-email enrichment complete",
      );

      const totalEmailCount = new Set(
        enrichedAllProjects.map((project) => project.email).filter(Boolean),
      ).size;
      setCollectionMessage(
        `Final dataset: ${enrichedAllProjects.length.toLocaleString()} authors with public emails. ${totalEmailCount.toLocaleString()} unique emails found across ${totalLinkedPublications.toLocaleString()} linked publications and ${totalPubmedRecords.toLocaleString()} PubMed records.`,
      );

      setSearchCompleted(true);
    } else {
      setCollectionProgress(100);
      setCollectionStatus("Collection complete");
      setCollectionMessage("No NIH records were returned.");
      setSearchCompleted(true);
    }
  } catch (error) {
    console.error("NIH Search Error:", error);
    setResults([]);
    setTotalResults(0);
    setCollectionProgress(0);
    setCollectedCount(0);
    setCollectionStatus("Collection failed");
    setCollectionMessage(
      error instanceof Error
        ? error.message
        : "NIH collection failed.",
    );
  } finally {
    setIsSearching(false);
  }
};

  const exportExcel = () => {
    if (results.length === 0) {
      return;
    }

    const excelData = results.map((result, index) => ({
      "S.No": index + 1,
      "Author": result.authorName || result.principalInvestigator || "",
      "Email": result.email || "",
      "Recent Publication": result.recentPublication || "",
      "Publication Date": result.publicationDate || "",
      "PMID": result.pmid || "",
      "NIH Project ID": result.projectId || "",
      "Project Title": result.projectTitle || "",
      "Institution": result.organization || "",
      "Country": result.country || "",
      "Funding Amount": result.fundingAmount ?? "",
      "Fiscal Year": result.fiscalYear ?? "",
      "Activity Code": result.activityCode || "",
      "Funding Agency": result.fundingAgency || "",
      "Project Start Date": result.projectStartDate || "",
      "Project End Date": result.projectEndDate || "",
      "City": result.city || "",
      "State": result.state || "",
      "Application ID": result.applicationId || "",
      "Core Project Number": result.coreProjectNumber || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 34 },
      { wch: 55 },
      { wch: 18 },
      { wch: 14 },
      { wch: 20 },
      { wch: 35 },
      { wch: 20 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "NIH Projects"
    );

    const safeKeyword = keywords
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "search";

    const fileName = `nih-research-${safeKeyword}-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const clearSearch = () => {
    setKeywords("");
    setFromYear("2020");
    setToYear("2026");
    setSelectedCountries([]);
    setCountrySearch("");
    setLimit("30000");
    setProjectType("All Project Types");
    setFundingAgency("All Funding Agencies");
    setOrganization("");
    setResults([]);
    setTotalResults(0);
    setCollectionMessage("");
    setSearchCompleted(false);
  };

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#081522]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold">
              N
            </div>

            <div>
              <h1 className="text-lg font-semibold">
                NIH Research Explorer
              </h1>

              <p className="text-xs text-slate-400">
                Research intelligence platform
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            NIH Data
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Hero */}
        <section className="mb-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Research Discovery
          </p>

          <h2 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            Find researchers, projects and publications.
          </h2>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
            Search NIH-funded research using keywords, publication
            years and countries, then build a structured dataset for
            research analysis and export.
          </p>
        </section>

        {/* Main Search */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1929] p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">
              Search NIH Research
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Start with one or more research keywords.
            </p>
          </div>

          {/* Keyword */}
          <div>
            <label
              htmlFor="keywords"
              className="mb-2 block text-sm font-medium"
            >
              Keywords
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="keywords"
                value={keywords}
                onChange={(event) =>
                  setKeywords(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder="e.g. artificial intelligence, cancer, diabetes"
                className="h-12 flex-1 rounded-xl border border-white/10 bg-[#07111f] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
              />

              <button
                type="button"
                onClick={handleSearch}
                disabled={
                  isSearching || !keywords.trim()
                }
                className="h-12 rounded-xl bg-blue-600 px-8 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSearching ? "Collecting..." : "Search"}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Use commas to search multiple concepts.
            </p>

            {isSearching && (
              <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/5 p-4">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-200">
                      Collecting NIH Records
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {collectionStatus || "Fetching research records..."}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-blue-300">
                    {collectionProgress}%
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
                    style={{ width: `${collectionProgress}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {collectedCount.toLocaleString()} / {Number(limit || 0).toLocaleString()} records
                  </span>
                  <span>Please keep this page open</span>
                </div>
              </div>
            )}

            {!isSearching && collectionMessage && (
              <p className="mt-2 text-xs text-blue-300">
                {collectionMessage}
              </p>
            )}
          </div>

          {/* Main Filters */}
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div>
              <label
                htmlFor="fromYear"
                className="mb-2 block text-sm font-medium"
              >
                From Year
              </label>

              <select
                id="fromYear"
                value={fromYear}
                onChange={(event) =>
                  setFromYear(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm outline-none focus:border-blue-500"
              >
                {years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="toYear"
                className="mb-2 block text-sm font-medium"
              >
                To Year
              </label>

              <select
                id="toYear"
                value={toYear}
                onChange={(event) =>
                  setToYear(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm outline-none focus:border-blue-500"
              >
                {years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Country Multi Select */}
            <div className="relative">
              <label className="mb-2 block text-sm font-medium">
                Countries
              </label>

              <button
                type="button"
                onClick={() =>
                  setCountryOpen((current) => !current)
                }
                className="flex h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-[#07111f] px-3 text-left text-sm outline-none transition hover:border-white/20"
              >
                <span className="truncate text-slate-300">
                  {selectedCountries.length === 0
                    ? "All Countries"
                    : `${selectedCountries.length} selected`}
                </span>

                <span className="ml-2 text-slate-500">
                  {countryOpen ? "▲" : "▼"}
                </span>
              </button>

              {countryOpen && (
                <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0b1929] shadow-2xl">
                  <div className="border-b border-white/10 p-3">
                    <input
                      value={countrySearch}
                      onChange={(event) =>
                        setCountrySearch(event.target.value)
                      }
                      placeholder="Search countries..."
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 text-sm outline-none focus:border-blue-500"
                      autoFocus
                    />

                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={selectAllCountries}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Select all
                      </button>

                      <button
                        type="button"
                        onClick={clearCountries}
                        className="text-xs text-slate-500 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    {filteredCountries.map((country) => {
                      const checked =
                        selectedCountries.includes(country);

                      return (
                        <label
                          key={country}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleCountry(country)
                            }
                            className="h-4 w-4 accent-blue-600"
                          />

                          <span>{country}</span>
                        </label>
                      );
                    })}

                    {filteredCountries.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-slate-500">
                        No countries found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="limit"
                className="mb-2 block text-sm font-medium"
              >
                Maximum Records
              </label>

              <select
                id="limit"
                value={limit}
                onChange={(event) =>
                  setLimit(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm outline-none focus:border-blue-500"
              >
                {recordLimits.map((item) => (
                  <option key={item} value={item}>
                    {item.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Countries */}
          {selectedCountries.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-[#07111f] p-3">
              <div className="mb-2 text-xs font-medium text-slate-500">
                Selected countries
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedCountries.map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => toggleCountry(country)}
                    className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-400/20"
                  >
                    {country}
                    <span className="ml-2 opacity-60">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          <details className="mt-6 rounded-xl border border-white/10 bg-[#07111f]">
            <summary className="cursor-pointer px-4 py-4 text-sm font-medium text-slate-200">
              Advanced Filters
            </summary>

            <div className="grid gap-4 border-t border-white/10 p-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs text-slate-500">
                  Project Type
                </label>

                <select
                  value={projectType}
                  onChange={(event) =>
                    setProjectType(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1929] px-3 text-sm outline-none focus:border-blue-500"
                >
                  {projectTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-500">
                  Funding Agency
                </label>

                <select
                  value={fundingAgency}
                  onChange={(event) =>
                    setFundingAgency(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1929] px-3 text-sm outline-none focus:border-blue-500"
                >
                  {fundingAgencies.map((agency) => (
                    <option key={agency}>{agency}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-500">
                  Organization
                </label>

                <input
                  value={organization}
                  onChange={(event) =>
                    setOrganization(event.target.value)
                  }
                  placeholder="e.g. Harvard University"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1929] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>
            </div>
          </details>

          {/* Data Fields */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold">
              Data to Collect
            </h4>

            <p className="mt-1 text-xs text-slate-500">
              Choose the information that should appear in the
              exported dataset.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                "Author with email",
                "Email",
                "Recent Publication",
                "Publication Date",
                "Institution",
                "Country",
                "NIH Project ID",
                "Project Title",
                "Funding Amount",
              ].map((field) => (
                <label
                  key={field}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#07111f] px-3 py-3 text-sm text-slate-300 transition hover:border-white/20"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 accent-blue-600"
                  />

                  {field}
                </label>
              ))}
            </div>
          </div>

          {/* Active Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
            <span className="text-xs text-slate-500">
              Active filters:
            </span>

            {keywords && (
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-300">
                {keywords}
              </span>
            )}

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {fromYear}–{toYear}
            </span>

            {selectedCountries.length > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {selectedCountries.length} countries
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                All countries
              </span>
            )}

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Up to {Number(limit).toLocaleString()}
            </span>

            <button
              type="button"
              onClick={clearSearch}
              className="ml-1 text-xs text-slate-500 underline-offset-2 hover:text-white hover:underline"
            >
              Clear all
            </button>
          </div>
        </section>

        {/* Search Results */}
        <section className="mt-8">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-blue-400">
                Search Results
              </p>

              <h3 className="mt-1 text-2xl font-semibold">
                {searchCompleted
                  ? totalResults.toLocaleString()
                  : "Ready to search"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {searchCompleted
                  ? "Matching NIH research records"
                  : "Enter keywords above to begin"}
              </p>
            </div>

            {searchCompleted && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={results.length === 0}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Export Excel
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          {searchCompleted && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  totalResults.toLocaleString(),
                  "Author email records",
                ],
                [
                  new Set(
                    results
                      .map((item) => item.country)
                      .filter(Boolean)
                  ).size.toLocaleString(),
                  "Countries in preview",
                ],
                [
                  new Set(
                    results
                      .map((item) => item.authorName)
                      .filter(Boolean)
                  ).size.toLocaleString(),
                  "Authors in preview",
                ],
                [
                  new Set(results.map((item) => item.pmid).filter(Boolean))
                    .size.toLocaleString(),
                  "Publications",
                ],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-[#0b1929] p-5"
                >
                  <p className="text-2xl font-bold">
                    {value}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Results Table */}
        {searchCompleted && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1929]">
            <div className="border-b border-white/10 p-5">
              <h3 className="font-semibold">
                Authors with Public Emails
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                PubMed authors whose linked publication affiliations list a public email.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-white/10 bg-[#07111f] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">
                      Author
                    </th>
                    <th className="px-5 py-4">
                      Email
                    </th>
                    <th className="px-5 py-4">
                      Recent Publication
                    </th>
                    <th className="px-5 py-4">
                      Publication Date
                    </th>
                    <th className="px-5 py-4">
                      NIH Project ID
                    </th>
                    <th className="px-5 py-4">
                      Project Title
                    </th>
                    <th className="px-5 py-4">
                      Institution
                    </th>
                    <th className="px-5 py-4">
                      Country
                    </th>
                    <th className="px-5 py-4">
                      Funding
                    </th>
                    <th className="px-5 py-4">
                      FY
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {results.length > 0 ? (
                    results.map((result, index) => (
                      <tr
                        key={`${result.projectId ?? "project"}-${result.fiscalYear ?? "year"}-${result.applicationId ?? "app"}-${index}`}
                        className="border-b border-white/5 transition hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-4 font-medium">
                          {result.authorName || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {result.email || "N/A"}
                        </td>

                        <td className="max-w-md px-5 py-4 text-slate-300">
                          {result.recentPublication || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-400">
                          {result.publicationDate || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-400">
                          {result.projectId || "N/A"}
                        </td>

                        <td className="max-w-md px-5 py-4 text-slate-300">
                          {result.projectTitle || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {result.organization || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {result.country || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {typeof result.fundingAmount === "number"
                            ? `$${result.fundingAmount.toLocaleString()}`
                            : "N/A"}
                        </td>

                        <td className="px-5 py-4 text-slate-400">
                          {result.fiscalYear || "N/A"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No NIH projects were returned for this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="py-10 text-center text-xs text-slate-600">
          NIH Research Explorer • Research data discovery platform
        </footer>
      </div>
    </main>
  );
}
