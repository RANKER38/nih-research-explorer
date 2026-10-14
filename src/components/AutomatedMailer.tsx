import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type {
  AutomationState,
  EmailTemplate,
  MailerContact,
} from "../types/mailer";
import { DEFAULT_SUBJECT_LINES } from "../lib/templates";

type AutomatedMailerProps = {
  mailerState: AutomationState;
  contacts: MailerContact[];
  templates: EmailTemplate[];
  onSetContacts: (contacts: MailerContact[]) => void;
  onLaunchInstance: (instanceId: "1" | "2") => void;
  onCloseInstance: (instanceId: "1" | "2") => void;
  onStartAutomation: (config?: Partial<AutomationState>) => void;
  onPauseAutomation: () => void;
  onResumeAutomation: () => void;
  onStopAutomation: () => void;
  onUpdateConfig: (config: {
    delaySeconds?: number;
    parallelMode?: boolean;
    activeTemplateId?: string;
    targetCount?: number;
    rotationMode?: "cycle" | "single";
    subjectLines?: string[];
    templates?: EmailTemplate[];
  }) => void;
  onUpdateTemplates?: (templates: EmailTemplate[]) => void;
  onNavigateToTemplates?: () => void;
  onNavigateToExplorer: () => void;
};

export function AutomatedMailer({
  mailerState,
  contacts,
  templates,
  onSetContacts,
  onLaunchInstance,
  onCloseInstance,
  onStartAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onStopAutomation,
  onUpdateConfig,
  onNavigateToTemplates,
  onNavigateToExplorer,
}: AutomatedMailerProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRunning = mailerState.status === "running";
  const isPaused = mailerState.status === "paused";

  const target = Math.min(mailerState.targetCount || 100, contacts.length || 100);
  const percentComplete =
    target > 0
      ? Math.min(100, Math.round((mailerState.processedCount / target) * 100))
      : 0;

  const subjectLines =
    mailerState.subjectLines && mailerState.subjectLines.length > 0
      ? mailerState.subjectLines
      : DEFAULT_SUBJECT_LINES;

  const rotationMode = mailerState.rotationMode || "cycle";

  // Subject line management (No clutter, up to 5 lines)
  const handleUpdateSubject = (index: number, value: string) => {
    const updated = [...subjectLines];
    updated[index] = value;
    onUpdateConfig({ subjectLines: updated });
  };

  const handleAddSubject = () => {
    if (subjectLines.length >= 5) return;
    const defaultSuggestions = [
      "Inquiry regarding your NIH research: {ProjectTitle}",
      "Invitation to Contribute: Following your recent work on {ProjectTitle}",
      "Specialized research support for your project at {Institution}",
      "Collaborative research initiative regarding {ProjectTitle}",
      "Academic discussion & synergies with your laboratory at {Institution}",
    ];
    const newSubj =
      defaultSuggestions[subjectLines.length] ||
      `Collaboration inquiry regarding {ProjectTitle}`;
    onUpdateConfig({ subjectLines: [...subjectLines, newSubj] });
  };

  const handleDeleteSubject = (index: number) => {
    if (subjectLines.length <= 1) return;
    const updated = subjectLines.filter((_, i) => i !== index);
    onUpdateConfig({ subjectLines: updated });
  };

  const handleResetSubjects = () => {
    onUpdateConfig({ subjectLines: [...DEFAULT_SUBJECT_LINES] });
  };

  const handleAppendVarToLastSubject = (varTag: string) => {
    if (subjectLines.length === 0) return;
    const lastIdx = subjectLines.length - 1;
    const current = subjectLines[lastIdx];
    const updated = [...subjectLines];
    updated[lastIdx] = current ? `${current} ${varTag}` : varTag;
    onUpdateConfig({ subjectLines: updated });
  };

  // Excel / CSV File Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.SheetNames[0];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
          workbook.Sheets[firstSheet],
        );

        const parsedContacts: MailerContact[] = rows
          .map((row, index) => {
            const email = String(
              row["Email"] ||
                row["email"] ||
                row["E-mail"] ||
                row["Contact Email"] ||
                "",
            ).trim();

            const name = String(
              row["Author / Contact"] ||
                row["Author"] ||
                row["Researcher / PI"] ||
                row["Principal Investigator (PI)"] ||
                row["Name"] ||
                row["name"] ||
                "Researcher",
            ).trim();

            const title = String(
              row["Project Title"] ||
                row["Recent Publication"] ||
                row["Title"] ||
                row["title"] ||
                "",
            ).trim();

            const organization = String(
              row["Institution"] ||
                row["Organization"] ||
                row["organization"] ||
                row["University"] ||
                "",
            ).trim();

            return {
              id: `imported-${index + 1}-${Date.now()}`,
              name,
              email,
              title,
              organization,
              status: "pending" as const,
            };
          })
          .filter((c) => c.email && c.email.includes("@"));

        if (parsedContacts.length > 0) {
          onSetContacts(parsedContacts);
        } else {
          alert("No valid email contacts were found in this file.");
        }
      } catch (err) {
        alert(
          `Error importing file: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const deliveredContacts = contacts.filter((c) => c.status === "sent");
  const failedContacts = contacts.filter((c) => c.status === "failed");
  const totalAttempted = mailerState.successCount + mailerState.failedCount;
  const deliverySuccessRate =
    totalAttempted > 0
      ? Math.round((mailerState.successCount / totalAttempted) * 100)
      : mailerState.successCount > 0
      ? 100
      : 0;

  // Export Delivery Report
  const handleExportDeliveryReport = (format: "xlsx" | "csv") => {
    const delivered = contacts.filter((c) => c.status === "sent");
    if (delivered.length === 0 && mailerState.successCount === 0) {
      alert("No delivered emails found yet to export. Start the automation to dispatch emails.");
      return;
    }

    const exportData = (delivered.length > 0 ? delivered : contacts).map((c, i) => ({
      "No": i + 1,
      "Recipient Name": c.name || "N/A",
      "Recipient Email": c.email,
      "Delivery Status": c.status === "sent" ? "DELIVERED" : c.status.toUpperCase(),
      "Delivered At": c.sentAt || "Recorded in Roundcube Sent Box",
      "Template Used": c.templateUsed || "Template 1",
      "Subject Line Used": c.subjectUsed || "N/A",
      "BigRock Worker Instance": c.instanceId ? `BigRock #${c.instanceId}` : "Instance 1",
      "Project / Research Title": c.title || "",
      "Institution / Organization": c.organization || "",
      "Error Details": c.error || "None",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery Report");

    const dateStr = new Date().toISOString().split("T")[0];
    if (format === "csv") {
      XLSX.writeFile(workbook, `bigrock_delivery_report_${dateStr}.csv`, {
        bookType: "csv",
      });
    } else {
      XLSX.writeFile(workbook, `bigrock_delivery_report_${dateStr}.xlsx`);
    }
  };

  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(25);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.organization.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contacts, filterStatus, searchFilter]);

  const totalQueuePages = Math.max(1, Math.ceil(filteredContacts.length / queuePageSize));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const paginatedContacts = useMemo(() => {
    const start = (safeQueuePage - 1) * queuePageSize;
    return filteredContacts.slice(start, start + queuePageSize);
  }, [filteredContacts, safeQueuePage, queuePageSize]);

  return (
    <div className="w-full space-y-7">
      {/* 1. Sleek Instructions & Scope Notice (Clean, non-congested, Lavender/White) */}
      <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-xs transition sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100/70 text-violet-700 shadow-xs">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                  Normal Academic Correspondence
                </h3>
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 border border-violet-200/60">
                  BigRock Webmail Exclusively
                </span>
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-serif font-bold text-violet-800 border border-violet-200">
                  Times New Roman Format
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                  High-Priority Active
                </span>
              </div>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600">
                This engine is designed for <strong className="text-slate-800">1-to-1 individual research communications</strong> (scientific collaborations, journal peer review invites, and laboratory discussions). It connects directly to BigRock Roundcube (<code className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-violet-800 text-xs">us3.webmail.mailhostbox.com</code>) to preserve authentic human mailbox rates and domain sender reputation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Header & Primary Controls */}
      <div className="rounded-2xl border border-violet-100 bg-white p-7 shadow-xs sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-violet-100/80 px-2.5 py-1 text-xs font-bold text-violet-700">
              DISPATCH CONTROLLER
            </span>
            <span className="text-xs sm:text-sm text-slate-400 font-medium">• Up to 100 Contacts per Batch</span>
          </div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            BigRock Webmail Automation
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
            Automates login and sending via Roundcube Webmail. Runs up to 2 instances with 3-template & 5-subject line repeated rotation.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-0">
          {!isRunning ? (
            <button
              type="button"
              onClick={() => onStartAutomation()}
              disabled={contacts.length === 0}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm sm:text-base font-bold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-98"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Start Automation</span>
            </button>
          ) : isPaused ? (
            <button
              type="button"
              onClick={onResumeAutomation}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-98"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPauseAutomation}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/25 transition hover:bg-amber-600 active:scale-98"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <span>Pause</span>
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={onStopAutomation}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-xs transition hover:bg-rose-100"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Dual BigRock Instances (Clean White & Lavender Cards) */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Instance 1 */}
        <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-xs transition sm:p-6">
          <div className="flex items-center justify-between border-b border-violet-100/80 pb-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-3 w-3 rounded-full ${
                  mailerState.instance1.isLoggedIn
                    ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                    : mailerState.instance1.browserRunning
                    ? "bg-amber-400 animate-pulse"
                    : "bg-slate-300"
                }`}
              />
              <h3 className="font-bold text-slate-900 text-sm">BigRock Instance #1 (Primary)</h3>
            </div>

            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                mailerState.instance1.isLoggedIn
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : mailerState.instance1.browserRunning
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {mailerState.instance1.isLoggedIn
                ? "Ready & Authenticated"
                : mailerState.instance1.browserRunning
                ? "Awaiting Login"
                : "Disconnected"}
            </span>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs">
              <p className="text-slate-500">
                Webmail:{" "}
                <span className="font-mono text-violet-700 font-medium">
                  us3.webmail.mailhostbox.com
                </span>
              </p>
              <p className="text-slate-500">
                Status:{" "}
                <span className="font-medium text-slate-700">
                  {mailerState.instance1.currentEmail ? (
                    <span className="text-violet-600 font-semibold">
                      Sending to {mailerState.instance1.currentEmail}...
                    </span>
                  ) : (
                    "Idle"
                  )}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onLaunchInstance("1")}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-violet-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Launch BigRock #1</span>
              </button>

              {mailerState.instance1.browserRunning && (
                <button
                  type="button"
                  onClick={() => onCloseInstance("1")}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-5 rounded-xl bg-violet-50/50 border border-violet-100 p-3 text-xs text-slate-600">
            <div>
              Delivered:{" "}
              <span className="font-bold text-emerald-600">
                {mailerState.instance1.sentCount}
              </span>
            </div>
            <div>
              Failed:{" "}
              <span className="font-bold text-rose-600">
                {mailerState.instance1.failedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Instance 2 */}
        <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-xs transition sm:p-6">
          <div className="flex items-center justify-between border-b border-violet-100/80 pb-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-3 w-3 rounded-full ${
                  mailerState.instance2.isLoggedIn
                    ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                    : mailerState.instance2.browserRunning
                    ? "bg-amber-400 animate-pulse"
                    : "bg-slate-300"
                }`}
              />
              <h3 className="font-bold text-slate-900 text-sm">BigRock Instance #2 (Parallel)</h3>
            </div>

            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                mailerState.instance2.isLoggedIn
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : mailerState.instance2.browserRunning
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {mailerState.instance2.isLoggedIn
                ? "Ready & Authenticated"
                : mailerState.instance2.browserRunning
                ? "Awaiting Login"
                : "Disconnected"}
            </span>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs">
              <p className="text-slate-500">
                Webmail:{" "}
                <span className="font-mono text-purple-700 font-medium">
                  us3.webmail.mailhostbox.com
                </span>
              </p>
              <p className="text-slate-500">
                Status:{" "}
                <span className="font-medium text-slate-700">
                  {mailerState.instance2.currentEmail ? (
                    <span className="text-purple-600 font-semibold">
                      Sending to {mailerState.instance2.currentEmail}...
                    </span>
                  ) : (
                    "Idle"
                  )}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onLaunchInstance("2")}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-purple-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Launch BigRock #2</span>
              </button>

              {mailerState.instance2.browserRunning && (
                <button
                  type="button"
                  onClick={() => onCloseInstance("2")}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-5 rounded-xl bg-violet-50/50 border border-violet-100 p-3 text-xs text-slate-600">
            <div>
              Delivered:{" "}
              <span className="font-bold text-emerald-600">
                {mailerState.instance2.sentCount}
              </span>
            </div>
            <div>
              Failed:{" "}
              <span className="font-bold text-rose-600">
                {mailerState.instance2.failedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Campaign Dispatcher Settings */}
      <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Campaign Settings & Throttling
        </h4>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Target Count */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Batch Target Limit
            </label>
            <select
              value={mailerState.targetCount}
              onChange={(e) =>
                onUpdateConfig({ targetCount: Number(e.target.value) })
              }
              disabled={isRunning}
              className="h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
            >
              {[10, 25, 50, 75, 100].map((num) => (
                <option key={num} value={num}>
                  Up to {num} Emails
                </option>
              ))}
            </select>
          </div>

          {/* Delay */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Delay Between Sends
            </label>
            <select
              value={mailerState.delaySeconds}
              onChange={(e) =>
                onUpdateConfig({ delaySeconds: Number(e.target.value) })
              }
              disabled={isRunning}
              className="h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
            >
              <option value={3}>3 seconds (Fast)</option>
              <option value={5}>5 seconds</option>
              <option value={7}>7 seconds (Recommended)</option>
              <option value={10}>10 seconds (Polite)</option>
              <option value={15}>15 seconds (Safe)</option>
            </select>
          </div>

          {/* Parallel Mode Toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Instance Mode
            </label>
            <button
              type="button"
              disabled={isRunning}
              onClick={() =>
                onUpdateConfig({ parallelMode: !mailerState.parallelMode })
              }
              className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 text-xs font-semibold transition ${
                mailerState.parallelMode
                  ? "border-violet-300 bg-violet-50 text-violet-800 shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>
                {mailerState.parallelMode
                  ? "⚡ 2 Instances (Parallel)"
                  : "1 Instance (Sequential)"}
              </span>
              <span className="text-[10px] text-slate-400">Toggle</span>
            </button>
          </div>

          {/* Rotation Mode Toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Dispatch Rotation Mode
            </label>
            <button
              type="button"
              disabled={isRunning}
              onClick={() =>
                onUpdateConfig({
                  rotationMode: rotationMode === "cycle" ? "single" : "cycle",
                })
              }
              className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 text-xs font-semibold transition ${
                rotationMode === "cycle"
                  ? "border-violet-300 bg-violet-50 text-violet-800 shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="truncate">
                {rotationMode === "cycle"
                  ? "🔄 3-Template Cyclic Rotation"
                  : "📌 Single Template Mode"}
              </span>
              <span className="text-[10px] text-slate-400">Switch</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Clean, Uncluttered Campaign Subject Lines Hub (No multiple instructions under sublines) */}
      <div className="rounded-2xl border border-violet-100 bg-white p-7 shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-violet-100/80 pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Campaign Subject Lines
              </h3>
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 border border-violet-200">
                {subjectLines.length} of 5 Sub Lines Active
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              Continuous repeating cycle: Dispatches 3 outreach templates across up to 5 subject lines in repeated sequence for each recipient (Mail 1: T1+S1, Mail 2: T2+S2, Mail 3: T3+S3, Mail 4: T1+S4, Mail 5: T2+S5, Mail 6: T3+S1...).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRunning || subjectLines.length >= 5}
              onClick={handleAddSubject}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>+ Add Sub Line</span>
              <span className="text-[11px] opacity-80">({subjectLines.length}/5)</span>
            </button>

            <button
              type="button"
              disabled={isRunning}
              onClick={handleResetSubjects}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50"
              title="Reset to 5 recommended scientific subject lines"
            >
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Dynamic Variable Helper Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50/60 border border-violet-100 p-3 text-xs sm:text-sm">
          <span className="font-semibold text-slate-600 text-xs">Click to append tag:</span>
          {["{ProjectTitle}", "{Name}", "{Institution}", "{Title}"].map((vTag) => (
            <button
              key={vTag}
              type="button"
              disabled={isRunning}
              onClick={() => handleAppendVarToLastSubject(vTag)}
              className="rounded-md border border-violet-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-violet-700 transition hover:bg-violet-50 hover:border-violet-300"
              title={`Append ${vTag} to subject line`}
            >
              {vTag}
            </button>
          ))}
        </div>

        {/* 5 Clean, Spacious Subject Line Rows (NO repetitive instruction clutter) */}
        <div className="mt-4 space-y-2.5">
          {subjectLines.map((subj, sIdx) => (
            <div
              key={sIdx}
              className="flex items-center gap-3 rounded-xl border border-violet-100 bg-slate-50/50 p-2.5 transition hover:bg-white hover:border-violet-200"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 font-mono text-xs font-bold text-violet-700">
                S{sIdx + 1}
              </span>

              <input
                value={subj}
                disabled={isRunning}
                onChange={(e) => handleUpdateSubject(sIdx, e.target.value)}
                placeholder="Enter subject line..."
                className="flex-1 rounded-lg border border-violet-200/80 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
              />

              {subjectLines.length > 1 && !isRunning && (
                <button
                  type="button"
                  onClick={() => handleDeleteSubject(sIdx)}
                  className="rounded-lg p-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                  title="Remove this subject line"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Outreach Templates Status Bar (Templates Kept Separate per User Request) */}
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/70 via-purple-50/40 to-white p-5 shadow-xs sm:p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Outreach Email Templates
              </h3>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                3 Strategy Templates Configured
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Templates are managed in the dedicated Templates Workshop with Bold formatting toolbar, dynamic variables, and real-time live preview.
            </p>
          </div>
        </div>

        {onNavigateToTemplates && (
          <button
            type="button"
            onClick={onNavigateToTemplates}
            className="mt-4 sm:mt-0 flex items-center gap-2 rounded-xl bg-white border border-violet-200 px-4 py-2.5 text-xs font-bold text-violet-700 shadow-2xs transition hover:bg-violet-50 hover:border-violet-300"
          >
            <span>Open Templates Workshop</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        )}
      </div>

      {/* 7. Delivery Status & Verification Section */}
      <section className="rounded-2xl border border-violet-100 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 border-b border-violet-100/80 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Delivery Status & Verification Hub
                </h3>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {mailerState.successCount} Delivered
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Verified delivery dispatched directly into BigRock Roundcube Sent mailbox.
              </p>
            </div>
          </div>

          {/* Export Delivery Report */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportDeliveryReport("xlsx")}
              disabled={mailerState.successCount === 0 && deliveredContacts.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Delivery Report (Excel)</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportDeliveryReport("csv")}
              disabled={mailerState.successCount === 0 && deliveredContacts.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 5 Metric Cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Mails Delivered
            </span>
            <div className="mt-1 text-3xl font-extrabold text-slate-900">
              {mailerState.successCount.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-emerald-700">Confirmed in Webmail</p>
          </div>

          <div className="rounded-xl border border-violet-100 bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Delivery Rate
            </span>
            <div className="mt-1 text-3xl font-extrabold text-violet-700">
              {deliverySuccessRate}%
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-violet-600 transition-all duration-500"
                style={{ width: `${deliverySuccessRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-violet-100 bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
              BigRock #1 Sent
            </span>
            <div className="mt-1 text-3xl font-extrabold text-slate-900">
              {mailerState.instance1.sentCount.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Primary Instance</p>
          </div>

          <div className="rounded-xl border border-violet-100 bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
              BigRock #2 Sent
            </span>
            <div className="mt-1 text-3xl font-extrabold text-slate-900">
              {mailerState.instance2.sentCount.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Parallel Instance</p>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Failed / Errors
            </span>
            <div className="mt-1 text-3xl font-extrabold text-rose-800">
              {mailerState.failedCount.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-rose-600">
              {failedContacts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilterStatus("failed")}
                  className="underline hover:text-rose-800"
                >
                  View {failedContacts.length} failed
                </button>
              ) : (
                "Zero errors"
              )}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {(isRunning || mailerState.processedCount > 0) && (
          <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Batch Progress ({mailerState.processedCount} of {target} attempted)
              </span>
              <span className="font-bold text-violet-700">{percentComplete}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-violet-200/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>
        )}

        {/* Delivered Emails Feed */}
        {deliveredContacts.length > 0 && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Delivered Emails Registry ({deliveredContacts.length})
              </span>
              <button
                type="button"
                onClick={() => setFilterStatus("sent")}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 hover:underline"
              >
                Filter Queue to Sent Mails &rarr;
              </button>
            </div>

            <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
              {deliveredContacts.slice(-10).reverse().map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white p-2.5 text-xs transition hover:border-violet-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      ✓
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="font-mono text-[11px] text-violet-700">{c.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    {c.templateUsed && (
                      <span className="rounded bg-violet-50 px-2 py-0.5 font-medium text-violet-700 border border-violet-100">
                        {c.templateUsed}
                      </span>
                    )}
                    {c.subjectUsed && (
                      <span className="max-w-xs truncate text-slate-500" title={c.subjectUsed}>
                        Sub: {c.subjectUsed}
                      </span>
                    )}
                    {c.instanceId && (
                      <span className="font-semibold text-violet-700">
                        BigRock #{c.instanceId}
                      </span>
                    )}
                    {c.sentAt && (
                      <span className="font-mono text-slate-400">{c.sentAt}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 8. Contacts Queue Table & Actions */}
      <div className="rounded-2xl border border-violet-100 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-violet-100 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Contacts Queue</h3>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                {contacts.length} Contacts
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Populated from NIH Research Discovery or imported from external CSV / Excel files.
            </p>
          </div>

          {/* Import / Source Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <svg className="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToExplorer}
              className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2 text-xs font-semibold text-violet-700 shadow-2xs hover:bg-violet-100"
            >
              <svg className="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Pull from NIH Explorer</span>
            </button>

            {contacts.length > 0 && !isRunning && (
              <button
                type="button"
                onClick={() => onSetContacts([])}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
              >
                Clear Queue
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-violet-50/40 p-3.5 text-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5">
            {["all", "pending", "sending", "sent", "failed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setFilterStatus(st);
                  setQueuePage(1);
                }}
                className={`rounded-lg px-3 py-1 font-semibold uppercase tracking-wider text-[11px] transition ${
                  filterStatus === st
                    ? "bg-violet-600 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-white/80"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setQueuePage(1);
              }}
              placeholder="Search queue by name, email, org..."
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
            />
          </div>
        </div>

        {/* Table */}
        <div className="max-h-96 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-violet-100 bg-violet-50/70 uppercase tracking-wider text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cycle Step</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Recipient Name</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Subject Line</th>
                <th className="px-4 py-3">Dispatched At / Note</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-violet-50 text-slate-700">
              {paginatedContacts.length > 0 ? (
                paginatedContacts.map((contact, index) => {
                  const originalIndex = (safeQueuePage - 1) * queuePageSize + index;
                  const cycleStep = originalIndex % 3;
                  const assignedTpl = templates[cycleStep] || templates[0];
                  const assignedSubj =
                    subjectLines[cycleStep % subjectLines.length] ||
                    assignedTpl.subject;

                  return (
                    <tr
                      key={contact.id}
                      className="transition hover:bg-violet-50/30"
                    >
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {originalIndex + 1}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            contact.status === "sent"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : contact.status === "sending"
                              ? "bg-violet-50 text-violet-700 border border-violet-200 animate-pulse"
                              : contact.status === "failed"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              contact.status === "sent"
                                ? "bg-emerald-500"
                                : contact.status === "sending"
                                ? "bg-violet-600"
                                : contact.status === "failed"
                                ? "bg-rose-500"
                                : "bg-slate-400"
                            }`}
                          />
                          {contact.status}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded bg-violet-50 px-2 py-0.5 text-[10px] font-mono font-bold text-violet-700 border border-violet-200/60">
                          Mail #{cycleStep + 1} • T{cycleStep + 1}+S{cycleStep + 1}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {contact.instanceId ? (
                          <span className="font-semibold text-violet-700">
                            BigRock #{contact.instanceId}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-900">
                        {contact.name || "N/A"}
                      </td>

                      <td className="px-4 py-3 font-mono text-violet-700">
                        {contact.email}
                      </td>

                      <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                        {contact.templateUsed || assignedTpl.name}
                      </td>

                      <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                        <span className="font-mono text-[11px] text-slate-700">
                          {contact.subjectUsed || assignedSubj}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {contact.sentAt ? (
                          <span className="text-emerald-700 font-mono text-[11px] font-medium">
                            {contact.sentAt}
                          </span>
                        ) : contact.error ? (
                          <span className="text-rose-600 text-[11px] font-medium">
                            {contact.error}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {contacts.length === 0 ? (
                      <div className="space-y-2">
                        <p>No contacts currently in queue.</p>
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={onNavigateToExplorer}
                            className="text-violet-600 underline hover:text-violet-700 font-semibold"
                          >
                            Search in NIH Explorer
                          </button>
                          <span>or</span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-purple-600 underline hover:text-purple-700 font-semibold"
                          >
                            Import CSV / Excel
                          </button>
                        </div>
                      </div>
                    ) : (
                      "No contacts match the active filter."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredContacts.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-violet-100 bg-violet-50/30 px-5 py-3.5 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Showing <strong className="text-slate-900 font-semibold">{((safeQueuePage - 1) * queuePageSize) + 1}</strong> to{" "}
                <strong className="text-slate-900 font-semibold">{Math.min(safeQueuePage * queuePageSize, filteredContacts.length)}</strong> of{" "}
                <strong className="text-slate-900 font-semibold">{filteredContacts.length}</strong> contacts
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={queuePageSize}
                  onChange={(e) => {
                    setQueuePageSize(Number(e.target.value));
                    setQueuePage(1);
                  }}
                  className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-violet-500"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={safeQueuePage <= 1}
                onClick={() => setQueuePage(1)}
                className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
                title="First Page"
              >
                « First
              </button>

              <button
                type="button"
                disabled={safeQueuePage <= 1}
                onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
              >
                ‹ Prev
              </button>

              <span className="px-2.5 py-1 text-xs font-bold text-violet-700 bg-violet-100 rounded-lg">
                Page {safeQueuePage} of {totalQueuePages}
              </span>

              <button
                type="button"
                disabled={safeQueuePage >= totalQueuePages}
                onClick={() => setQueuePage((p) => Math.min(totalQueuePages, p + 1))}
                className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
              >
                Next ›
              </button>

              <button
                type="button"
                disabled={safeQueuePage >= totalQueuePages}
                onClick={() => setQueuePage(totalQueuePages)}
                className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-white"
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 9. Live Dispatcher Activity Stream (Terminal) */}
      <div className="rounded-2xl border border-violet-950/20 bg-[#161824] p-5 shadow-sm text-slate-200">
        <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Dispatcher Activity Stream
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">
            Real-time Roundcube Webmail event log
          </span>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed">
          {mailerState.logs.length > 0 ? (
            mailerState.logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-slate-300">
                <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                {log.instanceId && (
                  <span className="rounded bg-violet-900/60 px-1 text-[9px] font-bold text-violet-300">
                    #{log.instanceId}
                  </span>
                )}
                <span
                  className={
                    log.level === "success"
                      ? "text-emerald-400"
                      : log.level === "error"
                      ? "text-rose-400"
                      : log.level === "warn"
                      ? "text-amber-400"
                      : "text-slate-300"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-500">No activity logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
