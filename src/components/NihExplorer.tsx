import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { isNihProject, isRecord, type NihProject } from "../types/nih";
import type { MailerContact } from "../types/mailer";

const years = Array.from({ length: 27 }, (_, i) => 2026 - i);

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana",
  "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Democratic Republic of the Congo",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
  "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines",
  "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste",
  "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

export const HIC_COUNTRIES = [
  "Japan",
  "Italy",
  "United States",
  "United Kingdom",
  "Australia",
  "Austria",
  "Brazil",
  "Saudi Arabia",
  "Germany",
  "United Arab Emirates",
  "Kuwait",
];

const recordLimits = [50, 100, 250, 500, 1000, 5000, 10000];

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

type KeywordSuggestion = {
  keyword: string;
  projectCount: number;
};

type NihExplorerProps = {
  results: NihProject[];
  setResults: (results: NihProject[]) => void;
  onTransferToMailer: (contacts: MailerContact[]) => void;
};

export function NihExplorer({
  results,
  setResults,
  onTransferToMailer,
}: NihExplorerProps) {
  const [keywords, setKeywords] = useState("");
  const [fromYear, setFromYear] = useState("2020");
  const [toYear, setToYear] = useState("2026");
  const [totalResults, setTotalResults] = useState(0);

  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionSource, setSuggestionSource] = useState<"keyword" | "journal">("keyword");
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [selectedSuggestionKeywords, setSelectedSuggestionKeywords] = useState<string[]>([]);
  const [suggestionProjectCount, setSuggestionProjectCount] = useState(0);
  const [suggestionTotalMatches, setSuggestionTotalMatches] = useState(0);
  const [suggestionJournalArticles, setSuggestionJournalArticles] = useState<number | null>(null);
  const [suggestionHasRun, setSuggestionHasRun] = useState(false);

  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const [limit, setLimit] = useState("100");
  const [projectType, setProjectType] = useState("All Project Types");
  const [fundingAgency, setFundingAgency] = useState("All Funding Agencies");
  const [organization, setOrganization] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState("");
  const [collectionProgress, setCollectionProgress] = useState(0);
  const [collectedCount, setCollectedCount] = useState(0);
  const [collectionStatus, setCollectionStatus] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((country) => country.toLowerCase().includes(query));
  }, [countrySearch]);

  const toggleCountry = (country: string) => {
    setSelectedCountries((current) =>
      current.includes(country)
        ? current.filter((item) => item !== country)
        : [...current, country],
    );
  };

  const selectAllCountries = () => setSelectedCountries(countries);
  const clearCountries = () => {
    setSelectedCountries([]);
    setCountrySearch("");
  };

  const isAllHicSelected = useMemo(() => {
    return HIC_COUNTRIES.every((c) => selectedCountries.includes(c));
  }, [selectedCountries]);

  const hicSelectedCount = useMemo(() => {
    return HIC_COUNTRIES.filter((c) => selectedCountries.includes(c)).length;
  }, [selectedCountries]);

  const selectAllHic = () => {
    setSelectedCountries((current) => {
      const set = new Set([...current, ...HIC_COUNTRIES]);
      return Array.from(set);
    });
  };

  const deselectAllHic = () => {
    setSelectedCountries((current) =>
      current.filter((c) => !HIC_COUNTRIES.includes(c)),
    );
  };

  const toggleAllHic = () => {
    if (isAllHicSelected) {
      deselectAllHic();
    } else {
      selectAllHic();
    }
  };

  const toggleSuggestionKeyword = (keyword: string) => {
    setSelectedSuggestionKeywords((current) =>
      current.some(
        (selected) => selected.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
      )
        ? current.filter(
            (selected) =>
              selected.toLocaleLowerCase() !== keyword.toLocaleLowerCase(),
          )
        : [...current, keyword],
    );
  };

  const useSelectedSuggestions = () => {
    if (selectedSuggestionKeywords.length === 0) return;
    const existingTerms = keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const selectedTerms = new Map(
      existingTerms.map((keyword) => [keyword.toLocaleLowerCase(), keyword]),
    );
    for (const keyword of selectedSuggestionKeywords) {
      const key = keyword.toLocaleLowerCase();
      if (!selectedTerms.has(key)) selectedTerms.set(key, keyword);
    }
    setKeywords(Array.from(selectedTerms.values()).join(", "));
  };

  const suggestKeywords = async () => {
    const query = suggestionQuery.trim();
    if (!query) return;
    setIsSuggestingKeywords(true);
    setSuggestionError("");
    setKeywordSuggestions([]);
    setSelectedSuggestionKeywords([]);
    setSuggestionHasRun(false);
    try {
      const response = await fetch("/api/nih/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          source: suggestionSource,
        }),
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data) || data.success !== true) {
        throw new Error(
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Unable to generate keyword suggestions.",
        );
      }
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter(
            (item): item is KeywordSuggestion =>
              isRecord(item) &&
              typeof item.keyword === "string" &&
              typeof item.projectCount === "number",
          )
        : [];
      setKeywordSuggestions(suggestions);
      setSuggestionProjectCount(
        typeof data.matchedProjects === "number" ? data.matchedProjects : 0,
      );
      setSuggestionTotalMatches(
        typeof data.totalMatches === "number" ? data.totalMatches : 0,
      );
      setSuggestionJournalArticles(
        typeof data.journalArticles === "number" ? data.journalArticles : null,
      );
      setSuggestionHasRun(true);
    } catch (error) {
      setSuggestionError(
        error instanceof Error
          ? error.message
          : "Unable to generate keyword suggestions.",
      );
    } finally {
      setIsSuggestingKeywords(false);
    }
  };

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    if (!fromYear || !toYear || Number(fromYear) > Number(toYear)) return;

    const requestedLimit = Number(limit) || 100;

    setIsSearching(true);
    setSearchCompleted(false);
    setTablePage(1);
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
        } catch {
          // ignore
        }
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
            (typeof data.status === "string" && data.status) ||
              "Collecting NIH records...",
          );
          setCollectionMessage(
            `${collected.toLocaleString()} / ${requestedLimit.toLocaleString()} NIH records collected.`,
          );
          return;
        }

        if (data.type === "error") {
          throw new Error(
            (typeof data.error === "string" && data.error) ||
              "NIH collection failed.",
          );
        }

        if (data.type === "complete") {
          completed = true;
          projectsFromNih = Array.isArray(data.projects)
            ? data.projects.filter(isNihProject)
            : [];

          const fetched = Number(data.fetched) || projectsFromNih.length;

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

        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          processNihLine(line);
        }

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

      // Publication + email enrichment
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

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
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
              let serverMessage = `Enrichment request failed with HTTP ${enrichResponse.status}.`;
              try {
                const errorText = await enrichResponse.text();
                if (errorText) {
                  try {
                    const errorJson = JSON.parse(errorText);
                    serverMessage =
                      errorJson.error || errorJson.message || serverMessage;
                  } catch {
                    serverMessage = errorText.slice(0, 500) || serverMessage;
                  }
                }
              } catch {
                // Keep HTTP status message
              }
              throw new Error(serverMessage);
            }

            if (!enrichResponse.body) {
              throw new Error("The enrichment server returned an empty response.");
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
                console.error("Publication enrichment error:", data.error);
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
                totalLinkedPublications += Number(data.linkedPublications) || 0;
                totalPubmedRecords += Number(data.pubmedRecords) || 0;
              }
            };

            while (true) {
              const { value, done } = await enrichReader.read();

              enrichBuffer += decoder.decode(value || new Uint8Array(), {
                stream: !done,
              });

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
                90 + Math.round(((batchIndex + 1) / totalBatches) * 10),
              ),
            );
          } catch (batchError) {
            console.error(
              `Enrichment batch ${batchIndex + 1} failed:`,
              batchError,
            );

            enrichmentHadError = true;
            setCollectionStatus(
              `Publication enrichment batch ${
                batchIndex + 1
              } failed; those records were excluded because no verified author email was obtained.`,
            );
          }
        }

        if (enrichedAllProjects.length > 0) {
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
        } else {
          setResults(projectsFromNih);
          setTotalResults(projectsFromNih.length);
          setCollectedCount(projectsFromNih.length);
          setCollectionProgress(100);
          setCollectionStatus(
            "Collection complete (no public author emails found in linked publications)",
          );
          setCollectionMessage(
            `Collected ${projectsFromNih.length.toLocaleString()} NIH project records. No public author emails were detected in linked PubMed publications. Displaying project records.`,
          );
        }

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
        error instanceof Error ? error.message : "NIH collection failed.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handlePushToMailer = () => {
    const validContacts: MailerContact[] = results
      .filter((r) => r.email && r.email.includes("@"))
      .map((r, i) => ({
        id: `nih-${r.projectId ?? i}-${Date.now()}`,
        name: r.authorName || r.principalInvestigator || "Researcher",
        email: r.email || "",
        title: r.projectTitle || r.recentPublication || "NIH Research Project",
        organization: r.organization || "",
        country: r.country,
        fundingAmount: r.fundingAmount,
        fiscalYear: r.fiscalYear,
        status: "pending",
      }));

    if (validContacts.length === 0) {
      alert("No contacts with email addresses were found to send to the mailer.");
      return;
    }

    onTransferToMailer(validContacts);
  };

  const exportExcel = () => {
    if (results.length === 0) return;

    const excelData = results.map((result, index) => ({
      "S.No": index + 1,
      "Author / Contact": result.authorName || result.principalInvestigator || "",
      "Email": result.email || "",
      "Principal Investigator (PI)": result.principalInvestigator || "",
      "All Project PIs":
        result.principalInvestigators?.map((pi) => pi.fullName).filter(Boolean).join("; ") ||
        result.principalInvestigator ||
        "",
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
      "Email Source": result.emailSource || (result.email ? "PubMed author affiliation" : ""),
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet["!cols"] = [
      { wch: 8 }, { wch: 28 }, { wch: 34 }, { wch: 28 }, { wch: 35 },
      { wch: 55 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 35 },
      { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
      { wch: 18 }, { wch: 22 }, { wch: 26 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NIH Projects");

    const safeKeyword =
      keywords.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
      "search";

    const fileName = `nih-research-${safeKeyword}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportCsv = () => {
    if (results.length === 0) return;

    const headers = [
      "S.No", "Author / Contact", "Email", "Principal Investigator (PI)", "All Project PIs",
      "Recent Publication", "Publication Date", "PMID", "NIH Project ID", "Project Title",
      "Institution", "Country", "Funding Amount", "Fiscal Year", "Activity Code",
      "Funding Agency", "Project Start Date", "Project End Date", "City", "State",
      "Application ID", "Core Project Number", "Email Source",
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = results.map((result, index) =>
      [
        index + 1,
        result.authorName || result.principalInvestigator || "",
        result.email || "",
        result.principalInvestigator || "",
        result.principalInvestigators?.map((pi) => pi.fullName).filter(Boolean).join("; ") ||
          result.principalInvestigator ||
          "",
        result.recentPublication || "",
        result.publicationDate || "",
        result.pmid || "",
        result.projectId || "",
        result.projectTitle || "",
        result.organization || "",
        result.country || "",
        result.fundingAmount ?? "",
        result.fiscalYear ?? "",
        result.activityCode || "",
        result.fundingAgency || "",
        result.projectStartDate || "",
        result.projectEndDate || "",
        result.city || "",
        result.state || "",
        result.applicationId || "",
        result.coreProjectNumber || "",
        result.emailSource || (result.email ? "PubMed author affiliation" : ""),
      ]
        .map(escapeCsv)
        .join(","),
    );

    const csvContent =
      "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeKeyword =
      keywords.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
      "search";
    link.href = url;
    link.download = `nih-research-${safeKeyword}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearSearch = () => {
    setKeywords("");
    setFromYear("2020");
    setToYear("2026");
    setSelectedCountries([]);
    setCountrySearch("");
    setLimit("100");
    setProjectType("All Project Types");
    setFundingAgency("All Funding Agencies");
    setOrganization("");
    setResults([]);
    setTotalResults(0);
    setCollectionMessage("");
    setSearchCompleted(false);
    setTablePage(1);
  };

  const emailCountInResults = results.filter((r) => r.email && r.email.includes("@")).length;

  const totalTablePages = Math.max(1, Math.ceil(results.length / pageSize));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const paginatedResults = useMemo(() => {
    const start = (safeTablePage - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, safeTablePage, pageSize]);

  return (
    <div className="w-full space-y-6">
      {/* Search Filter Card */}
      <section className="rounded-2xl border border-violet-100 bg-white p-7 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <span className="rounded-md border border-violet-200/60 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
              NIH RESEARCH DISCOVERY
            </span>
            <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Search NIH RePORTER Projects & Extract Author Emails
            </h2>
          </div>
          <span className="text-xs sm:text-sm font-medium text-slate-400">Live API Connection</span>
        </div>

        {/* Keyword Search */}
        <div>
          <label htmlFor="keywords" className="mb-2 block text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-700">
            Research Keywords
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="e.g. artificial intelligence, crispr, immunotherapy, alzheimer"
              className="h-13 flex-1 rounded-xl border border-violet-200 bg-violet-50/20 px-4 text-sm sm:text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white"
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching || !keywords.trim()}
              className="h-13 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-sm sm:text-base font-bold text-white shadow-md shadow-violet-200 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSearching ? "Collecting..." : "Search & Enrich"}
            </button>
          </div>

          <p className="mt-2 text-xs sm:text-sm text-slate-500">
            Use commas to search multiple concepts. Multiple terms are searched as alternatives to return broader results.
          </p>

          {/* Keyword suggestions */}
          <div className="mt-6 rounded-xl border border-violet-100 bg-[#faf8ff] p-5">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-800">Keyword suggestions</h4>
              <p className="mt-1 text-xs text-slate-500">
                Find related NIH-funded research terms from a keyword or a journal&apos;s NIH-linked publications.
              </p>
            </div>

            <div className="mb-3 flex flex-wrap gap-2" aria-label="Suggestion source">
              {[
                ["keyword", "Research keyword"],
                ["journal", "Journal name"],
              ].map(([source, label]) => (
                <button
                  key={source}
                  type="button"
                  aria-pressed={suggestionSource === source}
                  onClick={() => {
                    setSuggestionSource(source as "keyword" | "journal");
                    setKeywordSuggestions([]);
                    setSelectedSuggestionKeywords([]);
                    setSuggestionProjectCount(0);
                    setSuggestionTotalMatches(0);
                    setSuggestionJournalArticles(null);
                    setSuggestionError("");
                    setSuggestionHasRun(false);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    suggestionSource === source
                      ? "border-violet-300 bg-violet-100 text-violet-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={suggestionQuery}
                onChange={(event) => {
                  setSuggestionQuery(event.target.value);
                  setKeywordSuggestions([]);
                  setSelectedSuggestionKeywords([]);
                  setSuggestionProjectCount(0);
                  setSuggestionTotalMatches(0);
                  setSuggestionJournalArticles(null);
                  setSuggestionError("");
                  setSuggestionHasRun(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") suggestKeywords();
                }}
                aria-label={
                  suggestionSource === "journal"
                    ? "Journal name for keyword suggestions"
                    : "Research keyword for suggestions"
                }
                placeholder={
                  suggestionSource === "journal"
                    ? "e.g. Nature, The Lancet"
                    : "e.g. cancer, diabetes"
                }
                maxLength={200}
                className="h-11 flex-1 rounded-lg border border-violet-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-500"
              />

              <button
                type="button"
                onClick={suggestKeywords}
                disabled={isSuggestingKeywords || !suggestionQuery.trim()}
                className="h-11 rounded-lg border border-violet-200 bg-violet-50 px-5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSuggestingKeywords ? "Finding..." : "Suggest keywords"}
              </button>
            </div>

            {isSuggestingKeywords && (
              <p className="mt-3 text-xs font-medium text-violet-700" role="status">
                Finding related NIH projects and unique terms...
              </p>
            )}

            {suggestionError && (
              <p className="mt-3 text-xs font-medium text-rose-600" role="alert">
                {suggestionError}
              </p>
            )}

            {!isSuggestingKeywords && !suggestionError && (
              <>
                {suggestionJournalArticles !== null && (
                  <p className="mt-3 text-xs text-slate-500">
                    PubMed found {suggestionJournalArticles.toLocaleString()} journal articles; up to 200 are checked for NIH funding links.
                  </p>
                )}

                {suggestionTotalMatches > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Showing terms from {suggestionProjectCount.toLocaleString()} NIH projects
                    {suggestionTotalMatches > suggestionProjectCount
                      ? ` (of ${suggestionTotalMatches.toLocaleString()} matching projects)`
                      : ""}
                    .
                  </p>
                )}

                {keywordSuggestions.length > 0 ? (
                  <>
                    <p className="mt-3 text-xs text-slate-500">
                      Select one or more terms to combine them in a broader NIH search.
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {keywordSuggestions.map((suggestion) => {
                        const selected = selectedSuggestionKeywords.some(
                          (keyword) =>
                            keyword.toLocaleLowerCase() ===
                            suggestion.keyword.toLocaleLowerCase(),
                        );

                        return (
                          <button
                            key={suggestion.keyword.toLocaleLowerCase()}
                            type="button"
                            aria-pressed={selected}
                            title={`${selected ? "Remove" : "Select"} "${suggestion.keyword}" (${suggestion.projectCount.toLocaleString()} NIH projects)`}
                            onClick={() => toggleSuggestionKeyword(suggestion.keyword)}
                            className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                              selected
                                ? "border-violet-400 bg-violet-100 text-violet-900 font-semibold"
                                : "border-violet-200/80 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50/50"
                            }`}
                          >
                            <span aria-hidden="true">{selected ? "✓ " : "+ "}</span>
                            {suggestion.keyword}
                            <span className="ml-2 font-normal text-violet-500">
                              {suggestion.projectCount.toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedSuggestionKeywords.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={useSelectedSuggestions}
                          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 shadow-sm"
                        >
                          Use {selectedSuggestionKeywords.length} selected{" "}
                          {selectedSuggestionKeywords.length === 1 ? "keyword" : "keywords"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSuggestionKeywords([])}
                          className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  suggestionHasRun && (
                    <p className="mt-3 text-xs text-slate-500">
                      {suggestionSource === "journal" && suggestionJournalArticles === 0
                        ? "No PubMed articles were found for that journal name."
                        : suggestionProjectCount === 0
                        ? suggestionSource === "journal"
                          ? "No NIH-funded projects were linked to the journal articles checked."
                          : "No NIH projects matched that keyword."
                        : "No distinct related terms were found. Try another keyword or journal."}
                    </p>
                  )
                )}
              </>
            )}

            {keywordSuggestions.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Add selected terms to the search above. Multiple terms are combined as alternatives; set the record limit for a larger dataset.
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar & Status */}
        {isSearching && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-violet-950">
                  Collecting & Enriching Research Records
                </p>
                <p className="mt-1 text-xs text-violet-600">
                  {collectionStatus || "Connecting to NIH RePORTER & PubMed..."}
                </p>
              </div>
              <span className="text-lg font-bold text-violet-700">
                {collectionProgress}%
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${collectionProgress}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{collectedCount.toLocaleString()} / {Number(limit).toLocaleString()} records</span>
              <span>Please keep this window open</span>
            </div>
          </div>
        )}

        {!isSearching && collectionMessage && (
          <p className="mt-3 text-xs font-medium text-violet-700">{collectionMessage}</p>
        )}

        {/* Primary Filters Grid */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">From Year</label>
            <select
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
              className="h-12 w-full rounded-xl border border-violet-200 bg-violet-50/20 px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">To Year</label>
            <select
              value={toYear}
              onChange={(e) => setToYear(e.target.value)}
              className="h-12 w-full rounded-xl border border-violet-200 bg-violet-50/20 px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Countries with High Income Countries (HIC) Section */}
          <div className="relative">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-slate-700">Countries</label>
              <button
                type="button"
                onClick={toggleAllHic}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                  isAllHicSelected
                    ? "bg-violet-600 text-white shadow-2xs"
                    : "bg-violet-100 text-violet-800 hover:bg-violet-200"
                }`}
                title="Select / Deselect High Income Countries: Japan, Italy, US, UK, Australia, Austria, Brazil, Saudi Arabia, Germany, UAE, Kuwait"
              >
                <span>⚡ HIC ({hicSelectedCount}/11)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCountryOpen((cur) => !cur)}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50/20 px-3.5 text-left text-xs sm:text-sm text-slate-800 outline-none transition hover:border-violet-300 focus:bg-white"
            >
              <span className="truncate">
                {selectedCountries.length === 0
                  ? "All Countries"
                  : `${selectedCountries.length} selected`}
              </span>
              <span className="text-slate-500">{countryOpen ? "▲" : "▼"}</span>
            </button>

            {countryOpen && (
              <div className="absolute left-0 right-0 z-50 mt-2 w-full sm:w-[380px] overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl">
                {/* Dedicated High Income Countries (HIC) Section */}
                <div className="border-b border-violet-100 bg-violet-50/70 p-3">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-2 w-2 rounded-full bg-violet-600" />
                      <span className="text-xs font-bold text-violet-950 uppercase tracking-wide">
                        High Income Countries (HIC)
                      </span>
                      <span className="rounded-full bg-violet-200 px-1.5 py-0.2 text-[10px] font-bold text-violet-800">
                        11
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAllHic}
                      className="text-[11px] font-bold text-violet-700 hover:text-violet-900 transition"
                    >
                      {isAllHicSelected ? "Deselect HIC" : "Select All HIC"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {HIC_COUNTRIES.map((c) => {
                      const checked = selectedCountries.includes(c);
                      return (
                        <label
                          key={`hic-${c}`}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                            checked
                              ? "border-violet-300 bg-violet-100 text-violet-950 font-bold"
                              : "border-violet-200/50 bg-white text-slate-700 hover:bg-violet-50/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCountry(c)}
                            className="accent-violet-600 rounded"
                          />
                          <span className="truncate">{c === "United Arab Emirates" ? "UAE" : c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Search & All Countries Filter */}
                <div className="border-b border-violet-100 p-2.5">
                  <input
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search all other countries..."
                    className="h-9 w-full rounded-lg border border-violet-200 bg-violet-50/30 px-2.5 text-xs text-slate-800 outline-none focus:border-violet-500"
                    autoFocus
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <button type="button" onClick={selectAllCountries} className="font-semibold text-violet-600 hover:text-violet-700">
                      Select all countries
                    </button>
                    <button type="button" onClick={clearCountries} className="text-slate-500 hover:text-slate-800">
                      Clear selection
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto p-2">
                  <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    All Countries (A–Z)
                  </p>
                  {filteredCountries.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs text-slate-700 hover:bg-violet-50">
                      <input
                        type="checkbox"
                        checked={selectedCountries.includes(c)}
                        onChange={() => toggleCountry(c)}
                        className="accent-violet-600"
                      />
                      <span>{c}</span>
                      {HIC_COUNTRIES.includes(c) && (
                        <span className="ml-auto rounded bg-violet-100 px-1 py-0.2 text-[9px] font-bold text-violet-700">
                          HIC
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Record Limit */}
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">Target Records Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-12 w-full rounded-xl border border-violet-200 bg-violet-50/20 px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
            >
              {recordLimits.map((lim) => (
                <option key={lim} value={lim}>
                  {lim.toLocaleString()} Records
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Filters details */}
        <details className="mt-4 rounded-xl border border-violet-100 bg-[#faf8ff]">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-700 hover:text-violet-700">
            + Advanced Filters (Agency, Project Type, Organization)
          </summary>
          <div className="grid gap-4 border-t border-violet-100 p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Project Type</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500"
              >
                {projectTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Funding Agency</label>
              <select
                value={fundingAgency}
                onChange={(e) => setFundingAgency(e.target.value)}
                className="h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500"
              >
                {fundingAgencies.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Organization / University</label>
              <input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Harvard, Stanford"
                className="h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500"
              />
            </div>
          </div>
        </details>

        {/* Active Filters Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-violet-100 pt-4 text-xs">
          <span className="text-slate-500">Active filters:</span>
          {keywords && (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 font-medium text-violet-700">
              &ldquo;{keywords}&rdquo;
            </span>
          )}
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-slate-700">
            {fromYear}–{toYear}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-slate-700">
            {selectedCountries.length > 0 ? `${selectedCountries.length} countries` : "All countries"}
          </span>
          <button type="button" onClick={clearSearch} className="font-medium text-xs text-slate-500 hover:text-slate-800">
            Clear all
          </button>
        </div>
      </section>

      {/* Prominent Action Banner When Contacts Ready */}
      {results.length > 0 && emailCountInResults > 0 && (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50/50 p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Ready for BigRock Automation
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {emailCountInResults.toLocaleString()} Contacts with Verified Public Emails
            </h3>
            <p className="text-xs text-slate-600">
              Transfer these enriched contacts directly to BigRock Automated Mailer to start dispatching with Template 1, 2, or 3.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePushToMailer}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:from-violet-700 hover:to-indigo-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span>Push to Automated Mailer</span>
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      {searchCompleted && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              {emailCountInResults > 0 ? "Author Email Records" : "NIH Project Records"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalResults.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-slate-400">Live search results</p>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Countries in Preview</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {new Set(results.map((r) => r.country).filter(Boolean)).size.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Geographic distribution</p>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Unique Researchers</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {new Set(results.map((r) => r.authorName || r.principalInvestigator).filter(Boolean)).size.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Principal Investigators / Authors</p>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Linked Publications</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {new Set(results.map((r) => r.pmid).filter(Boolean)).size.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">PubMed indexed papers</p>
          </div>
        </div>
      )}

      {/* Results Table Section */}
      {searchCompleted && (
        <section className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-violet-100 p-6 bg-white sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Research Data Preview</h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Verified records from NIH RePORTER and linked PubMed affiliations.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={exportCsv}
                disabled={results.length === 0}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-violet-700 hover:bg-violet-100 transition disabled:opacity-40"
              >
                Export CSV
              </button>

              <button
                type="button"
                onClick={exportExcel}
                disabled={results.length === 0}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-violet-700 hover:bg-violet-100 transition disabled:opacity-40"
              >
                Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-xs sm:text-sm">
              <thead className="border-b border-violet-100 bg-violet-50/70 uppercase tracking-wider text-slate-700 text-xs font-bold">
                <tr>
                  <th className="px-4 py-3.5">Author / Contact</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Recent Publication</th>
                  <th className="px-4 py-3.5">Pub Date</th>
                  <th className="px-4 py-3.5">NIH Project ID</th>
                  <th className="px-4 py-3.5">Project Title</th>
                  <th className="px-4 py-3.5">Institution</th>
                  <th className="px-4 py-3.5">Country</th>
                  <th className="px-4 py-3.5">Funding</th>
                  <th className="px-4 py-3.5">FY</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-violet-50">
                {paginatedResults.length > 0 ? (
                  paginatedResults.map((r, i) => (
                    <tr key={`${r.projectId || "p"}-${(safeTablePage - 1) * pageSize + i}`} className="transition hover:bg-violet-50/40">
                      <td className="px-4 py-3.5 font-semibold text-slate-900 text-sm sm:text-base">
                        <div>
                          <span>{r.authorName || r.principalInvestigator || "N/A"}</span>
                          {r.authorName && r.principalInvestigator && r.authorName !== r.principalInvestigator && (
                            <span className="block text-[11px] font-normal text-slate-500">
                              PI: {r.principalInvestigator}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-violet-700 font-bold text-xs sm:text-sm">
                        {r.email || "N/A"}
                      </td>

                      <td className="max-w-xs truncate px-4 py-3.5 text-slate-700 text-xs sm:text-sm">
                        {r.recentPublication || "N/A"}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 text-xs sm:text-sm">{r.publicationDate || "N/A"}</td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs sm:text-sm">{r.projectId || "N/A"}</td>
                      <td className="max-w-xs truncate px-4 py-3.5 text-slate-700 text-xs sm:text-sm">{r.projectTitle || "N/A"}</td>
                      <td className="max-w-xs truncate px-4 py-3.5 text-slate-600 text-xs sm:text-sm">{r.organization || "N/A"}</td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs sm:text-sm">
                        {r.country || "N/A"}
                        {r.country && HIC_COUNTRIES.includes(r.country) && (
                          <span className="ml-1 rounded bg-violet-100 px-1 py-0.2 text-[9px] font-bold text-violet-700">
                            HIC
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800 text-xs sm:text-sm">
                        {typeof r.fundingAmount === "number" ? `$${r.fundingAmount.toLocaleString()}` : "N/A"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs sm:text-sm">{r.fiscalYear || "N/A"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {results.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-violet-100 bg-violet-50/30 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>
                  Showing <strong className="text-slate-900 font-semibold">{((safeTablePage - 1) * pageSize) + 1}</strong> to{" "}
                  <strong className="text-slate-900 font-semibold">{Math.min(safeTablePage * pageSize, results.length)}</strong> of{" "}
                  <strong className="text-slate-900 font-semibold">{results.length.toLocaleString()}</strong> records
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setTablePage(1);
                    }}
                    className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-violet-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={safeTablePage <= 1}
                  onClick={() => setTablePage(1)}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
                  title="First Page"
                >
                  « First
                </button>

                <button
                  type="button"
                  disabled={safeTablePage <= 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
                >
                  ‹ Prev
                </button>

                <span className="px-3 py-1 text-xs font-bold text-violet-700 bg-violet-100 rounded-lg">
                  Page {safeTablePage} of {totalTablePages}
                </span>

                <button
                  type="button"
                  disabled={safeTablePage >= totalTablePages}
                  onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
                >
                  Next ›
                </button>

                <button
                  type="button"
                  disabled={safeTablePage >= totalTablePages}
                  onClick={() => setTablePage(totalTablePages)}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
                  title="Last Page"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
