import React, { useRef, useState } from "react";
import type { EmailTemplate } from "../types/mailer";
import {
  DEFAULT_TEMPLATES,
  formatBodyForHtml,
  renderTemplate,
} from "../lib/templates";

type TemplatesManagerProps = {
  templates: EmailTemplate[];
  activeTemplateId: string;
  onSelectActiveTemplate: (id: string) => void;
  onUpdateTemplates: (templates: EmailTemplate[]) => void;
  onNavigateToMailer: () => void;
};

export function TemplatesManager({
  templates,
  activeTemplateId,
  onSelectActiveTemplate,
  onUpdateTemplates,
  onNavigateToMailer,
}: TemplatesManagerProps) {
  const [selectedId, setSelectedId] = useState<string>(activeTemplateId || "template-1");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentTemplate =
    templates.find((t) => t.id === selectedId) || templates[0];

  const handleFieldChange = (field: "subject" | "body", value: string) => {
    const updated = templates.map((t) =>
      t.id === selectedId ? { ...t, [field]: value } : t,
    );
    onUpdateTemplates(updated);
  };

  const handleResetToDefault = (id: string) => {
    const defaultT = DEFAULT_TEMPLATES.find((t) => t.id === id);
    if (!defaultT) return;
    const updated = templates.map((t) => (t.id === id ? { ...defaultT } : t));
    onUpdateTemplates(updated);
  };

  // Upload Template File (.txt, .json, .md)
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || "");
        let name = file.name.replace(/\.[^/.]+$/, "");
        let subject = "Inquiry regarding your research: {ProjectTitle}";
        let body = text;

        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          name = parsed.name || name;
          subject = parsed.subject || subject;
          body = parsed.body || text;
        } else {
          const lines = text.split("\n");
          const subjectLine = lines.find((l) => /^subject\s*:/i.test(l.trim()));
          if (subjectLine) {
            subject = subjectLine.replace(/^subject\s*:/i, "").trim();
            body = lines.filter((l) => !/^subject\s*:/i.test(l.trim())).join("\n").trim();
          } else if (lines.length > 1 && lines[0].trim().length < 120) {
            subject = lines[0].trim();
            body = lines.slice(1).join("\n").trim();
          }
        }

        const newId = `uploaded-${Date.now()}`;
        const newTemplate: EmailTemplate = {
          id: newId,
          name: `Uploaded: ${name}`,
          category: "Custom Uploaded",
          subject,
          body,
        };

        const updated = [...templates, newTemplate];
        onUpdateTemplates(updated);
        setSelectedId(newId);
        onSelectActiveTemplate(newId);
        alert(`Template "${name}" uploaded successfully!`);
      } catch (err) {
        alert(
          `Failed to parse template file: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Create New Blank Custom Template
  const handleCreateNewTemplate = () => {
    const newId = `custom-${Date.now()}`;
    const newTemplate: EmailTemplate = {
      id: newId,
      name: `Custom Template ${templates.length + 1}`,
      category: "Custom Outreach",
      subject: "Collaboration inquiry: {ProjectTitle}",
      body: `Dear Dr. {Name},

I hope this message finds you well.

I came across your NIH research project titled "{ProjectTitle}" at {Institution} and would like to connect regarding collaborative opportunities.

[Write your custom message here]

Best regards,
Research Group`,
    };
    const updated = [...templates, newTemplate];
    onUpdateTemplates(updated);
    setSelectedId(newId);
    onSelectActiveTemplate(newId);
  };

  // Bold & Italic Formatting Helpers
  const handleApplyFormatting = (
    prefix: string,
    suffix: string,
    defaultPlaceholder = "Important Text",
  ) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = currentTemplate.body || "";
    const selected = text.slice(start, end);
    const contentToWrap = selected || defaultPlaceholder;
    const replacement = `${prefix}${contentToWrap}${suffix}`;
    const newBody = text.slice(0, start) + replacement + text.slice(end);

    handleFieldChange("body", newBody);

    setTimeout(() => {
      ta.focus();
      if (selected) {
        ta.setSelectionRange(start, start + replacement.length);
      } else {
        ta.setSelectionRange(
          start + prefix.length,
          start + prefix.length + defaultPlaceholder.length,
        );
      }
    }, 40);
  };

  const handleInsertVariable = (code: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      handleFieldChange("body", (currentTemplate.body || "") + " " + code);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = currentTemplate.body || "";
    const newBody = text.slice(0, start) + code + text.slice(end);
    handleFieldChange("body", newBody);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + code.length, start + code.length);
    }, 40);
  };

  const sampleContact = {
    name: "Dr. Sarah Jenkins",
    email: "s.jenkins@stanford.edu",
    title: "Mechanisms of CRISPR-Cas9 Target Recognition in Human Stem Cells",
    organization: "Stanford University School of Medicine",
  };

  const sampleRendered = renderTemplate(currentTemplate, sampleContact);

  const variables = [
    { code: "{Name}", label: "PI Name" },
    { code: "{ProjectTitle}", label: "Project Title" },
    { code: "{Title}", label: "Title Alias" },
    { code: "{Institution}", label: "Institution" },
    { code: "{Email}", label: "Email" },
  ];

  return (
    <div className="w-full space-y-7">
      {/* Top Banner (White & Lavender Card) */}
      <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-xs sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
              TEMPLATE WORKSHOP
            </span>
            <span className="text-xs text-slate-400 font-medium">• 3 Strategic Templates</span>
          </div>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">
            Outreach Email Templates
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Personalize outreach messaging for NIH principal investigators. Supports in-line bold formatting and dynamic variable substitution.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleTemplateUpload}
            accept=".txt,.json,.md,.html"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-xs font-semibold text-violet-700 shadow-2xs transition hover:bg-violet-100"
            title="Upload a .txt, .md or .json template"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload Template</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNewTemplate}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
          >
            <span>+ New Template</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToMailer}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-violet-700"
          >
            <span>Open BigRock Mailer</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3 Template Cards Grid */}
      <div className="grid gap-5 md:grid-cols-3">
        {templates.map((tpl, tIdx) => {
          const isSelected = tpl.id === selectedId;
          const cycleAssignment =
            tIdx === 0
              ? "Mail #1, #4, #7..."
              : tIdx === 1
              ? "Mail #2, #5, #8..."
              : "Mail #3, #6, #9...";

          return (
            <div
              key={tpl.id}
              onClick={() => setSelectedId(tpl.id)}
              className={`cursor-pointer rounded-2xl border p-5 transition ${
                isSelected
                  ? "border-violet-500 bg-violet-50/40 shadow-xs ring-2 ring-violet-200"
                  : "border-violet-100 bg-white hover:border-violet-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  {tpl.category}
                </span>

                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  {cycleAssignment}
                </span>
              </div>

              <h3 className="mt-3 text-sm font-bold text-slate-900">{tpl.name}</h3>
              <p className="mt-1 line-clamp-1 text-xs font-medium text-violet-700">
                Subject: {tpl.subject}
              </p>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">
                {tpl.body}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-violet-100 pt-3 text-xs">
                <span className={`font-semibold text-xs ${isSelected ? "text-violet-700" : "text-slate-400"}`}>
                  {isSelected ? "● Currently Editing" : "Click to Edit"}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetToDefault(tpl.id);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
                >
                  Reset Default
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Editor Card */}
        <div className="space-y-4 rounded-2xl border border-violet-100 bg-white p-6 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-violet-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Edit {currentTemplate.name}
              </h3>
              <p className="text-xs text-slate-500">
                Changes update the campaign templates automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectActiveTemplate(currentTemplate.id)}
              className="rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-violet-700"
            >
              Select as Primary
            </button>
          </div>

          {/* Subject Field */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Email Subject Line
            </label>
            <input
              value={currentTemplate.subject}
              onChange={(e) => handleFieldChange("subject", e.target.value)}
              className="w-full rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              placeholder="e.g. Inquiry regarding your NIH research: {ProjectTitle}"
            />
          </div>

          {/* Body Field with Formatting Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Email Message Body
              </label>
              <span className="text-[11px] text-slate-400">
                Supports Bold (**text**) & dynamic variables
              </span>
            </div>

            {/* Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/70 p-2.5">
              <span className="px-1 text-xs font-bold text-slate-600">
                Format:
              </span>

              {/* Times New Roman Badge */}
              <span className="rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-xs font-serif font-bold text-violet-900 shadow-2xs">
                Times New Roman (Standard)
              </span>

              <div className="mx-1 h-5 w-px bg-violet-200" />

              <span className="px-1 text-xs font-bold text-slate-600">
                Style:
              </span>

              {/* Bold Button */}
              <button
                type="button"
                onClick={() => handleApplyFormatting("**", "**", "Important Text")}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-violet-700 active:scale-95"
                title="Make selected text Bold (**text**)"
              >
                <span className="text-sm font-black">B</span>
                <span>Bold</span>
              </button>

              {/* Italic Button */}
              <button
                type="button"
                onClick={() => handleApplyFormatting("*", "*", "italic text")}
                className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-violet-50 active:scale-95"
                title="Make selected text Italic (*text*)"
              >
                <span className="text-sm italic font-serif text-slate-700">I</span>
                <span>Italic</span>
              </button>

              <div className="mx-1 h-5 w-px bg-violet-200" />

              <span className="px-1 text-xs font-bold text-slate-600">
                Insert:
              </span>

              {/* Dynamic Variable Quick-Insert Chips */}
              {variables.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => handleInsertVariable(v.code)}
                  className="flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2.5 py-1 text-xs font-mono font-semibold text-violet-700 transition hover:bg-violet-50 hover:border-violet-300"
                  title={`Insert ${v.code} at cursor (${v.label})`}
                >
                  <span>{v.code}</span>
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              rows={13}
              value={currentTemplate.body}
              onChange={(e) => handleFieldChange("body", e.target.value)}
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              className="w-full rounded-xl border border-violet-200 bg-white p-4 font-serif text-sm sm:text-base leading-relaxed text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              placeholder="Compose your personalized outreach template... Select any text and click 'Bold' to emphasize it."
            />

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                💡 <strong className="text-slate-700">Tip:</strong> Formatted in <strong className="text-violet-700 font-serif">Times New Roman</strong>. Select any text and click <strong className="text-violet-700">Bold (B)</strong> to emphasize in BigRock Webmail.
              </span>
              <span>{currentTemplate.body.length} characters</span>
            </div>
          </div>
        </div>

        {/* Right: Live Preview Card */}
        <div className="space-y-4 rounded-2xl border border-violet-100 bg-white p-6 shadow-xs lg:col-span-5">
          <div className="border-b border-violet-100 pb-3">
            <span className="rounded-md bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
              LIVE EMAIL PREVIEW
            </span>
            <h4 className="mt-1 text-base font-bold text-slate-900">
              BigRock Webmail Render
            </h4>
            <p className="text-xs sm:text-sm text-slate-500">
              Preview simulated with Dr. Sarah Jenkins (Stanford University) with Times New Roman typography.
            </p>
          </div>

          {/* Mock Email Window (Clean, Elegant) */}
          <div className="overflow-hidden rounded-xl border border-violet-200/80 bg-white shadow-xs">
            {/* Window header */}
            <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-mono text-slate-700 font-semibold">
                  BigRock Webmail Compose
                </span>
              </div>
              <span className="rounded-md border border-violet-200 bg-violet-100 px-2 py-0.5 text-[11px] font-serif font-bold text-violet-800">
                Times New Roman Font Format Active
              </span>
            </div>

            {/* Email Meta */}
            <div className="space-y-1.5 border-b border-slate-100 bg-slate-50/50 p-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold text-slate-400">To:</span>
                <span className="rounded bg-violet-100/80 px-2.5 py-0.5 text-violet-800 font-medium">
                  {sampleContact.name} &lt;{sampleContact.email}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold text-slate-400">Subject:</span>
                <span className="font-semibold text-slate-800">
                  {sampleRendered.subject}
                </span>
              </div>
            </div>

            {/* Email Body rendered with formatBodyForHtml in Times New Roman */}
            <div className="p-5 text-slate-900 bg-white">
              <div
                className="font-serif text-sm sm:text-base leading-relaxed"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
                dangerouslySetInnerHTML={{
                  __html: formatBodyForHtml(sampleRendered.body),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
