"use client";

import { useEffect, useState } from "react";
import type { NihProject } from "../types/nih";
import type {
  AutomationState,
  EmailTemplate,
  LogEntry,
  MailerContact,
} from "../types/mailer";
import { DEFAULT_SUBJECT_LINES, DEFAULT_TEMPLATES } from "../lib/templates";
import { Navbar } from "../components/Navbar";
import { NihExplorer } from "../components/NihExplorer";
import { AutomatedMailer } from "../components/AutomatedMailer";
import { TemplatesManager } from "../components/TemplatesManager";

const INITIAL_MAILER_STATE: AutomationState = {
  status: "idle",
  targetCount: 100,
  processedCount: 0,
  successCount: 0,
  failedCount: 0,
  delaySeconds: 7,
  parallelMode: false,
  activeTemplateId: "template-1",
  rotationMode: "cycle",
  subjectLines: DEFAULT_SUBJECT_LINES,
  instance1: {
    instanceId: "1",
    browserRunning: false,
    isLoggedIn: false,
    currentStatus: "disconnected",
    sentCount: 0,
    failedCount: 0,
  },
  instance2: {
    instanceId: "2",
    browserRunning: false,
    isLoggedIn: false,
    currentStatus: "disconnected",
    sentCount: 0,
    failedCount: 0,
  },
  logs: [],
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"explorer" | "mailer" | "templates">(
    "explorer",
  );
  const [nihResults, setNihResults] = useState<NihProject[]>([]);
  const [contacts, setContacts] = useState<MailerContact[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [mailerState, setMailerState] = useState<AutomationState>(INITIAL_MAILER_STATE);

  // Load initial mailer status on mount
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/mailer/status");
        if (res.ok) {
          const data = await res.json();
          if (data.state) setMailerState(data.state);
          if (Array.isArray(data.contacts) && data.contacts.length > 0) {
            setContacts(data.contacts);
          }
          if (Array.isArray(data.templates) && data.templates.length > 0) {
            setTemplates(data.templates);
          }
        }
      } catch (err) {
        console.warn("Could not load initial mailer status:", err);
      }
    }
    loadStatus();
  }, []);

  // Connect to SSE stream for real-time progress & live logs
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/mailer/stream");

      es.addEventListener("state", (event) => {
        try {
          const data: AutomationState = JSON.parse(event.data);
          setMailerState(data);
        } catch {
          // ignore
        }
      });

      es.addEventListener("log", (event) => {
        try {
          const newLog: LogEntry = JSON.parse(event.data);
          setMailerState((prev) => ({
            ...prev,
            logs: [newLog, ...prev.logs].slice(0, 200),
          }));
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        // SSE disconnected, EventSource will automatically retry
      };
    } catch (err) {
      console.warn("Failed to connect to SSE stream:", err);
    }

    return () => {
      es?.close();
    };
  }, []);

  // API Control helpers
  const handleLaunchInstance = async (instanceId: "1" | "2") => {
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "launch", instanceId }),
      });
    } catch (err) {
      console.error("Failed to launch instance:", err);
    }
  };

  const handleCloseInstance = async (instanceId: "1" | "2") => {
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", instanceId }),
      });
    } catch (err) {
      console.error("Failed to close instance:", err);
    }
  };

  const handleStartAutomation = async (config?: Partial<AutomationState>) => {
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          config: {
            templates,
            activeTemplateId: mailerState.activeTemplateId,
            delaySeconds: mailerState.delaySeconds,
            parallelMode: mailerState.parallelMode,
            targetCount: mailerState.targetCount,
            rotationMode: mailerState.rotationMode,
            subjectLines: mailerState.subjectLines,
            ...config,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to start automation:", err);
    }
  };

  const handlePauseAutomation = async () => {
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
    } catch (err) {
      console.error("Failed to pause automation:", err);
    }
  };

  const handleResumeAutomation = async () => {
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
    } catch (err) {
      console.error("Failed to resume automation:", err);
    }
  };

  const handleStopAutomation = async () => {
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch (err) {
      console.error("Failed to stop automation:", err);
    }
  };

  const handleSetContacts = async (newContacts: MailerContact[]) => {
    setContacts(newContacts);
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_contacts", contacts: newContacts }),
      });
    } catch (err) {
      console.error("Failed to set contacts:", err);
    }
  };

  const handleUpdateConfig = async (config: {
    delaySeconds?: number;
    parallelMode?: boolean;
    activeTemplateId?: string;
    targetCount?: number;
    templates?: EmailTemplate[];
    subjectLines?: string[];
    rotationMode?: "cycle" | "single";
  }) => {
    setMailerState((prev) => ({
      ...prev,
      ...config,
    }));
    try {
      await fetch("/api/mailer/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_config", config }),
      });
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  };

  const handleTransferToMailer = async (transferredContacts: MailerContact[]) => {
    await handleSetContacts(transferredContacts);
    setActiveTab("mailer");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#f8f5ff] text-slate-800 antialiased">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mailerState={mailerState}
        onLaunchBigRock={handleLaunchInstance}
        contactCount={contacts.length}
      />

      {/* Main Full-Screen Section Content */}
      <main className="w-full flex-1 px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        {activeTab === "explorer" && (
          <NihExplorer
            results={nihResults}
            setResults={setNihResults}
            onTransferToMailer={handleTransferToMailer}
          />
        )}

        {activeTab === "mailer" && (
          <AutomatedMailer
            mailerState={mailerState}
            contacts={contacts}
            templates={templates}
            onSetContacts={handleSetContacts}
            onLaunchInstance={handleLaunchInstance}
            onCloseInstance={handleCloseInstance}
            onStartAutomation={handleStartAutomation}
            onPauseAutomation={handlePauseAutomation}
            onResumeAutomation={handleResumeAutomation}
            onStopAutomation={handleStopAutomation}
            onUpdateConfig={handleUpdateConfig}
            onUpdateTemplates={(updatedTemplates) => {
              setTemplates(updatedTemplates);
              handleUpdateConfig({ templates: updatedTemplates });
            }}
            onNavigateToExplorer={() => setActiveTab("explorer")}
            onNavigateToTemplates={() => setActiveTab("templates")}
          />
        )}

        {activeTab === "templates" && (
          <TemplatesManager
            templates={templates}
            activeTemplateId={mailerState.activeTemplateId}
            onSelectActiveTemplate={(id) => handleUpdateConfig({ activeTemplateId: id })}
            onUpdateTemplates={(updatedTemplates) => {
              setTemplates(updatedTemplates);
              handleUpdateConfig({ templates: updatedTemplates });
            }}
            onNavigateToMailer={() => setActiveTab("mailer")}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-violet-100 bg-white/80 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">
        NIH Research Explorer & BigRock Automated Mailing Suite • Dual Parallel Engine
      </footer>
    </div>
  );
}
