import React from "react";
import type { AutomationState } from "../types/mailer";

type NavbarProps = {
  activeTab: "explorer" | "mailer" | "templates";
  setActiveTab: (tab: "explorer" | "mailer" | "templates") => void;
  mailerState: AutomationState;
  onLaunchBigRock: (instanceId: "1" | "2") => void;
  contactCount: number;
};

export function Navbar({
  activeTab,
  setActiveTab,
  mailerState,
  onLaunchBigRock,
  contactCount,
}: NavbarProps) {
  const isInstance1Ready = mailerState.instance1.isLoggedIn;
  const isInstance2Ready = mailerState.instance2.isLoggedIn;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-violet-100 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-violet-600 to-purple-600 shadow-md shadow-violet-500/20">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg md:text-xl">
                NIH Explorer <span className="text-violet-600">&</span> Automated Mailer
              </h1>
              <span className="hidden rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-violet-700 md:inline-block">
                BIGROCK DUAL-ENGINE
              </span>
            </div>
            <p className="hidden text-xs sm:text-sm text-slate-500 sm:block">
              NIH Intelligence & BigRock Webmail Automation Suite
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("explorer")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "explorer"
                ? "bg-white text-violet-700 shadow-xs border border-violet-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>NIH Discovery</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("mailer")}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "mailer"
                ? "bg-white text-violet-700 shadow-xs border border-violet-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>BigRock Mailer</span>
            {contactCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                {contactCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "templates"
                ? "bg-white text-violet-700 shadow-xs border border-violet-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>Templates</span>
          </button>
        </nav>

        {/* Quick Launch & Status */}
        <div className="flex items-center gap-2.5">
          {/* Live Delivered Counter Pill */}
          {mailerState.successCount > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs sm:text-sm font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{mailerState.successCount} Delivered</span>
            </div>
          )}

          {/* Instance 1 Launch */}
          <button
            type="button"
            onClick={() => onLaunchBigRock("1")}
            className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:border-violet-300 hover:bg-violet-50/60"
            title="Launch BigRock Instance 1"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isInstance1Ready
                  ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                  : mailerState.instance1.browserRunning
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-300"
              }`}
            />
            <span className="text-violet-700 font-bold">BigRock #1</span>
          </button>

          {/* Instance 2 Launch */}
          <button
            type="button"
            onClick={() => onLaunchBigRock("2")}
            className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:border-violet-300 hover:bg-violet-50/60"
            title="Launch BigRock Instance 2 (Parallel)"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isInstance2Ready
                  ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                  : mailerState.instance2.browserRunning
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-300"
              }`}
            />
            <span className="text-purple-700 font-bold">BigRock #2</span>
          </button>
        </div>
      </div>
    </header>
  );
}
