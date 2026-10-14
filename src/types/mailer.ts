export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
};

export type MailerContact = {
  id: string;
  name: string;
  email: string;
  title: string;
  organization: string;
  country?: string;
  fundingAmount?: number;
  fiscalYear?: string | number | null;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  instanceId?: "1" | "2";
  sentAt?: string;
  error?: string;
  templateUsed?: string;
  subjectUsed?: string;
};

export type InstanceStatus = {
  instanceId: "1" | "2";
  browserRunning: boolean;
  isLoggedIn: boolean;
  currentStatus:
    | "disconnected"
    | "idle"
    | "logging_in"
    | "ready"
    | "sending"
    | "paused"
    | "error";
  lastUrl?: string;
  sentCount: number;
  failedCount: number;
  currentEmail?: string;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  instanceId?: "1" | "2";
};

export type AutomationState = {
  status: "idle" | "running" | "paused" | "stopped" | "completed";
  targetCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  delaySeconds: number;
  parallelMode: boolean;
  activeTemplateId: string;
  rotationMode?: "cycle" | "single";
  subjectLines?: string[];
  instance1: InstanceStatus;
  instance2: InstanceStatus;
  logs: LogEntry[];
};
