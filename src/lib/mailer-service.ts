import path from "node:path";
import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import type {
  AutomationState,
  EmailTemplate,
  InstanceStatus,
  LogEntry,
  MailerContact,
} from "../types/mailer";
import {
  DEFAULT_SUBJECT_LINES,
  DEFAULT_TEMPLATES,
  formatBodyForHtml,
  renderTemplate,
} from "./templates";

const WEBMAIL_SENT_URL =
  "https://us3.webmail.mailhostbox.com/?_task=mail&_mbox=Sent";
const WEBMAIL_COMPOSE_URL =
  "https://us3.webmail.mailhostbox.com/?_task=mail&_action=compose";

type BrowserInstance = {
  context: BrowserContext | null;
  page: Page | null;
  status: InstanceStatus;
};

class MailerService {
  private instances: Record<"1" | "2", BrowserInstance> = {
    "1": {
      context: null,
      page: null,
      status: {
        instanceId: "1",
        browserRunning: false,
        isLoggedIn: false,
        currentStatus: "disconnected",
        sentCount: 0,
        failedCount: 0,
      },
    },
    "2": {
      context: null,
      page: null,
      status: {
        instanceId: "2",
        browserRunning: false,
        isLoggedIn: false,
        currentStatus: "disconnected",
        sentCount: 0,
        failedCount: 0,
      },
    },
  };

  private contactsQueue: MailerContact[] = [];
  private templates: EmailTemplate[] = [...DEFAULT_TEMPLATES];
  private subjectLines: string[] = [...DEFAULT_SUBJECT_LINES];
  private rotationMode: "cycle" | "single" = "cycle";
  private activeTemplateId: string = "template-1";
  private delaySeconds: number = 7;
  private parallelMode: boolean = false;
  private targetCount: number = 100;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isStopped: boolean = false;

  private logs: LogEntry[] = [];
  private listeners: Set<(event: string, data: unknown) => void> = new Set();

  constructor() {
    this.addLog(
      "info",
      "Mailer service initialized. Ready for BigRock webmail automation.",
    );
  }

  public subscribe(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: string, data: unknown) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error("Error in mailer event listener:", err);
      }
    }
  }

  public addLog(
    level: LogEntry["level"],
    message: string,
    instanceId?: "1" | "2",
  ) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      instanceId,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 500) this.logs.pop();
    this.emit("log", entry);
  }

  private getChromeExecutable(): { channel?: string; executablePath?: string } {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];

    for (const p of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        return { executablePath: p };
      }
    }

    return { channel: "chrome" };
  }

  public async launchInstance(id: "1" | "2"): Promise<InstanceStatus> {
    const instance = this.instances[id];

    // If context already exists and is active, bring page to front
    if (instance.context && instance.page) {
      try {
        await instance.page.bringToFront();
        await instance.page.goto(WEBMAIL_SENT_URL, { waitUntil: "domcontentloaded" });
        await this.inspectLoginState(id);
        this.addLog("info", `Instance ${id} brought to front.`, id);
        return instance.status;
      } catch {
        // Stale context, will relaunch below
        instance.context = null;
        instance.page = null;
      }
    }

    const userDataDir = path.join(
      process.cwd(),
      ".webmail-sessions",
      `instance-${id}`,
    );

    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    this.addLog("info", `Launching BigRock Webmail window for Instance ${id}...`, id);
    instance.status.currentStatus = "logging_in";
    this.emitState();

    try {
      const launchConfig = this.getChromeExecutable();

      const context = await chromium.launchPersistentContext(userDataDir, {
        ...launchConfig,
        headless: false,
        viewport: null,
        args: [
          "--start-maximized",
          "--no-first-run",
          "--no-default-browser-check",
          `--window-name=BigRock-Instance-${id}`,
        ],
      });

      context.on("close", () => {
        instance.context = null;
        instance.page = null;
        instance.status.browserRunning = false;
        instance.status.isLoggedIn = false;
        instance.status.currentStatus = "disconnected";
        this.addLog("warn", `Instance ${id} browser window closed.`, id);
        this.emitState();
      });

      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      instance.context = context;
      instance.page = page;
      instance.status.browserRunning = true;

      await page.goto(WEBMAIL_SENT_URL, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      await this.inspectLoginState(id);
      this.addLog(
        "success",
        `Instance ${id} ready. Navigate to login if required.`,
        id,
      );
      this.emitState();
      return instance.status;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      instance.status.currentStatus = "error";
      this.addLog("error", `Failed to launch Instance ${id}: ${msg}`, id);
      this.emitState();
      throw err;
    }
  }

  public async inspectLoginState(id: "1" | "2"): Promise<boolean> {
    const instance = this.instances[id];
    if (!instance.page) {
      instance.status.isLoggedIn = false;
      instance.status.currentStatus = "disconnected";
      return false;
    }

    try {
      const page = instance.page;
      const url = page.url();
      instance.status.lastUrl = url;

      // Check if login form is on page
      const hasLoginForm = await page
        .locator("#rcmloginuser, input[name='_user']")
        .isVisible({ timeout: 1500 })
        .catch(() => false);

      if (hasLoginForm) {
        instance.status.isLoggedIn = false;
        instance.status.currentStatus = "logging_in";
        return false;
      }

      // Check for logged-in indicators in Roundcube (compose button or mail list)
      const hasCompose = await page
        .locator("a.button-compose, #rcmbtn107, a[href*='_action=compose'], .compose")
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      const hasMailTask = url.includes("_task=mail") && !hasLoginForm;

      if (hasCompose || hasMailTask) {
        instance.status.isLoggedIn = true;
        if (instance.status.currentStatus !== "sending") {
          instance.status.currentStatus = "ready";
        }
        return true;
      }

      instance.status.isLoggedIn = false;
      return false;
    } catch {
      return false;
    }
  }

  public async closeInstance(id: "1" | "2"): Promise<void> {
    const instance = this.instances[id];
    if (instance.context) {
      try {
        await instance.context.close();
      } catch {
        // ignore
      }
      instance.context = null;
      instance.page = null;
    }
    instance.status.browserRunning = false;
    instance.status.isLoggedIn = false;
    instance.status.currentStatus = "disconnected";
    this.addLog("info", `Instance ${id} closed.`, id);
    this.emitState();
  }

  public setContacts(contacts: MailerContact[]): void {
    this.contactsQueue = contacts;
    this.addLog("info", `Loaded ${contacts.length} contacts into automation queue.`);
    this.emitState();
  }

  public getContacts(): MailerContact[] {
    return this.contactsQueue;
  }

  public updateConfig(config: {
    delaySeconds?: number;
    parallelMode?: boolean;
    activeTemplateId?: string;
    targetCount?: number;
    rotationMode?: "cycle" | "single";
    subjectLines?: string[];
    templates?: EmailTemplate[];
  }): void {
    if (typeof config.delaySeconds === "number") {
      this.delaySeconds = Math.max(2, Math.min(60, config.delaySeconds));
    }
    if (typeof config.parallelMode === "boolean") {
      this.parallelMode = config.parallelMode;
    }
    if (config.activeTemplateId) {
      this.activeTemplateId = config.activeTemplateId;
    }
    if (config.rotationMode) {
      this.rotationMode = config.rotationMode;
    }
    if (Array.isArray(config.subjectLines)) {
      this.subjectLines = config.subjectLines
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      if (this.subjectLines.length === 0) {
        this.subjectLines = [...DEFAULT_SUBJECT_LINES];
      }
    }
    if (typeof config.targetCount === "number") {
      this.targetCount = Math.max(1, Math.min(500, config.targetCount));
    }
    if (Array.isArray(config.templates)) {
      this.templates = config.templates;
    }
    this.emitState();
  }

  public getTemplates(): EmailTemplate[] {
    return this.templates;
  }

  public getSubjectLines(): string[] {
    return this.subjectLines;
  }

  public async startAutomation(): Promise<void> {
    if (this.isRunning) {
      if (this.isPaused) {
        this.resumeAutomation();
      }
      return;
    }

    if (this.contactsQueue.length === 0) {
      this.addLog("warn", "Cannot start automation: Contacts queue is empty.");
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isStopped = false;

    this.addLog(
      "info",
      `Starting automated campaign (Target: ${this.targetCount} emails, Mode: ${
        this.parallelMode ? "Dual 2-Instance Parallel" : "Single Instance"
      }).`,
    );
    this.emitState();

    // Prepare instances
    try {
      await this.launchInstance("1");
      const loggedIn1 = await this.waitForLogin("1", 30000);
      if (!loggedIn1) {
        this.addLog(
          "warn",
          "Instance 1 is not logged in. Please log into your Mailhostbox account in the opened window, then click Resume.",
          "1",
        );
        this.pauseAutomation();
      }

      if (this.parallelMode) {
        await this.launchInstance("2");
        const loggedIn2 = await this.waitForLogin("2", 30000);
        if (!loggedIn2) {
          this.addLog(
            "warn",
            "Instance 2 is not logged in. Please log in, then click Resume.",
            "2",
          );
          this.pauseAutomation();
        }
      }
    } catch (launchErr) {
      this.addLog("error", `Instance startup issue: ${launchErr}`);
    }

    // Run dispatcher in background
    this.runDispatcher().catch((err) => {
      this.addLog("error", `Dispatcher error: ${err}`);
      this.isRunning = false;
      this.emitState();
    });
  }

  private async waitForLogin(id: "1" | "2", timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await this.inspectLoginState(id);
      if (ok) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  public pauseAutomation(): void {
    if (!this.isRunning) return;
    this.isPaused = true;
    this.instances["1"].status.currentStatus = "paused";
    this.instances["2"].status.currentStatus = "paused";
    this.addLog("warn", "Automation PAUSED by user. Click Resume to continue.");
    this.emitState();
  }

  public resumeAutomation(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.instances["1"].status.currentStatus = "sending";
    if (this.parallelMode) {
      this.instances["2"].status.currentStatus = "sending";
    }
    this.addLog("info", "Automation RESUMED.");
    this.emitState();
  }

  public stopAutomation(): void {
    this.isStopped = true;
    this.isRunning = false;
    this.isPaused = false;
    this.instances["1"].status.currentStatus = "idle";
    this.instances["2"].status.currentStatus = "idle";
    this.addLog("info", "Automation STOPPED.");
    this.emitState();
  }

  private async runDispatcher(): Promise<void> {
    // Select contacts to send up to targetCount
    const pendingContacts = this.contactsQueue.filter(
      (c) => c.status === "pending",
    );
    const toProcess = pendingContacts.slice(0, this.targetCount);

    if (toProcess.length === 0) {
      this.addLog("info", "No pending contacts left to send.");
      this.isRunning = false;
      this.emitState();
      return;
    }

    const toProcessWithIndex = toProcess.map((contact, idx) => ({
      contact,
      idx,
    }));

    if (this.parallelMode) {
      // Split contacts between Instance 1 and Instance 2
      const batch1: { contact: MailerContact; idx: number }[] = [];
      const batch2: { contact: MailerContact; idx: number }[] = [];

      toProcessWithIndex.forEach((item) => {
        if (item.idx % 2 === 0) {
          item.contact.instanceId = "1";
          batch1.push(item);
        } else {
          item.contact.instanceId = "2";
          batch2.push(item);
        }
      });

      this.addLog(
        "info",
        `Dispatching: Instance 1 assigned ${batch1.length} emails, Instance 2 assigned ${batch2.length} emails. (Strategy: ${
          this.rotationMode === "cycle"
            ? "3-Template & 3-Subject Cyclic Rotation"
            : "Single Template"
        })`,
      );

      await Promise.allSettled([
        this.runWorker("1", batch1),
        this.runWorker("2", batch2),
      ]);
    } else {
      toProcessWithIndex.forEach((item) => {
        item.contact.instanceId = "1";
      });
      await this.runWorker("1", toProcessWithIndex);
    }

    this.isRunning = false;
    this.isPaused = false;
    this.instances["1"].status.currentStatus = "idle";
    this.instances["2"].status.currentStatus = "idle";
    this.addLog("success", "Automated mailing campaign completed!");
    this.emitState();
  }

  private async runWorker(
    instanceId: "1" | "2",
    items: { contact: MailerContact; idx: number }[],
  ): Promise<void> {
    const instance = this.instances[instanceId];

    for (const { contact, idx } of items) {
      if (this.isStopped) break;

      // Handle pause loop
      while (this.isPaused) {
        if (this.isStopped) break;
        await new Promise((r) => setTimeout(r, 600));
      }
      if (this.isStopped) break;

      instance.status.currentStatus = "sending";
      instance.status.currentEmail = contact.email;
      contact.status = "sending";
      this.emitState();

      // Determine template and subject line for this contact
      let activeTemplate: EmailTemplate;
      let activeSubject: string;

      if (this.rotationMode === "cycle" && this.templates.length > 0) {
        // 3-template rotation: Mail 1 -> Template 1, Mail 2 -> Template 2, Mail 3 -> Template 3, then repeat (1, 2, 3...)
        const tplIdx = idx % Math.min(3, Math.max(1, this.templates.length));
        activeTemplate = this.templates[tplIdx] || this.templates[0];

        // Up to 5-subject lines rotation: repeats across all active subject lines (S1 -> S2 -> S3 -> S4 -> S5 -> S1...)
        const effectiveSubjects =
          this.subjectLines.length > 0
            ? this.subjectLines
            : DEFAULT_SUBJECT_LINES;
        const subjIdx = idx % effectiveSubjects.length;
        activeSubject = effectiveSubjects[subjIdx] || activeTemplate.subject;
      } else {
        activeTemplate =
          this.templates.find((t) => t.id === this.activeTemplateId) ||
          this.templates[0];
        activeSubject = this.subjectLines[0] || activeTemplate.subject;
      }

      const rendered = renderTemplate(
        { subject: activeSubject, body: activeTemplate.body },
        contact,
      );

      contact.templateUsed = activeTemplate.name;
      contact.subjectUsed = rendered.subject;

      const templateNum = (idx % Math.min(3, Math.max(1, this.templates.length))) + 1;
      const effectiveSubjectsCount = (
        this.subjectLines.length > 0 ? this.subjectLines : DEFAULT_SUBJECT_LINES
      ).length;
      const subjectNum = (idx % effectiveSubjectsCount) + 1;
      this.addLog(
        "info",
        `Instance ${instanceId}: [Cycle Mail #${idx + 1} • Template ${templateNum}/3 • Subject ${subjectNum}/${effectiveSubjectsCount}] Preparing for ${contact.name} using "${activeTemplate.name}" with Subject: "${rendered.subject}".`,
        instanceId,
      );

      try {
        await this.sendMailViaWebmail(instanceId, contact, rendered);
        contact.status = "sent";
        contact.sentAt = new Date().toLocaleTimeString();
        instance.status.sentCount++;
        this.addLog(
          "success",
          `Delivered (${contact.name || contact.email}) via Instance ${instanceId} using "${activeTemplate.name}".`,
          instanceId,
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        contact.status = "failed";
        contact.error = errorMsg;
        instance.status.failedCount++;
        this.addLog(
          "error",
          `Failed sending to ${contact.email} on Instance ${instanceId}: ${errorMsg}`,
          instanceId,
        );
      }

      this.emitState();

      // Wait between sends (delay + small random jitter)
      if (!this.isStopped) {
        const jitter = Math.floor(Math.random() * 2000);
        const waitTime = this.delaySeconds * 1000 + jitter;
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }

    instance.status.currentStatus = "idle";
    instance.status.currentEmail = undefined;
    this.emitState();
  }

  private async sendMailViaWebmail(
    instanceId: "1" | "2",
    contact: MailerContact,
    rendered: { subject: string; body: string },
  ): Promise<void> {
    const instance = this.instances[instanceId];
    if (!instance.page) {
      throw new Error(`Instance ${instanceId} browser is not running.`);
    }

    const page = instance.page;

    // 1. Ensure user is logged in
    const isLoggedIn = await this.inspectLoginState(instanceId);
    if (!isLoggedIn) {
      throw new Error(
        `Instance ${instanceId} is not logged into BigRock Webmail. Please log in.`,
      );
    }

    // 2. Navigate to compose screen
    await page.goto(WEBMAIL_COMPOSE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 3. Fill "To" field
    // Roundcube uses recipient input widget (tokeninput) or standard textarea
    const toInput = page
      .locator(
        ".recipient-input input, textarea#_to, input#_to, textarea[name='_to'], input[name='_to']",
      )
      .first();

    await toInput.waitFor({ state: "attached", timeout: 15000 });

    try {
      await toInput.click({ timeout: 2000 }).catch(() => {});
      await toInput.fill(contact.email);
      // In tokeninput, pressing Enter and Comma commits the recipient pill/badge
      await toInput.press("Enter");
      await toInput.press(",");
      await toInput.press("Tab");
    } catch {
      // fallback to DOM evaluation
    }

    // Directly register recipient in Roundcube's native recipient model
    await page.evaluate((email) => {
      const win = window as unknown as {
        rcmail?: {
          add_recipient?: (email: string, type: string) => void;
          ksearch_add_recipient?: (email: string, type: string) => void;
        };
      };

      if (win.rcmail && typeof win.rcmail.add_recipient === "function") {
        try {
          win.rcmail.add_recipient(email, "to");
        } catch {
          // ignore
        }
      }

      // Also ensure the hidden or visible textarea[name='_to'] has the email value
      const ta = (document.getElementById("_to") ||
        document.querySelector("textarea[name='_to'], input[name='_to']")) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (ta) {
        if (!ta.value || !ta.value.includes(email)) {
          ta.value = email;
        }
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.dispatchEvent(new Event("change", { bubbles: true }));
        ta.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }, contact.email);

    // 4. Fill "Subject"
    const subjectLocator = page
      .locator("#compose-subject, input[name='_subject'], #_subject")
      .first();
    await subjectLocator.waitFor({ state: "attached", timeout: 10000 });
    await subjectLocator.fill(rendered.subject);
    await subjectLocator.dispatchEvent("change");

    await page.evaluate((subj) => {
      const el = document.querySelector(
        "#compose-subject, input[name='_subject'], #_subject",
      ) as HTMLInputElement | null;
      if (el) {
        el.value = subj;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, rendered.subject);

    // 5. Fill "Message Body"
    // BigRock / Roundcube uses TinyMCE for rich text (data-html-editor="1") or plain textarea
    const bodyHtml = formatBodyForHtml(rendered.body);
    let bodySet = false;

    // Strategy 1: Direct TinyMCE API evaluation (Roundcube's native WYSIWYG instance)
    for (let attempt = 0; attempt < 12; attempt++) {
      const resultSet = await page.evaluate(
        ({ html }) => {
          const win = window as unknown as {
            tinymce?: {
              get?: (id: string) => {
                setContent: (c: string) => void;
                save?: () => void;
                fire?: (e: string) => void;
              };
              activeEditor?: {
                setContent: (c: string) => void;
                save?: () => void;
                fire?: (e: string) => void;
              };
            };
            tinyMCE?: {
              get?: (id: string) => {
                setContent: (c: string) => void;
                save?: () => void;
                fire?: (e: string) => void;
              };
              activeEditor?: {
                setContent: (c: string) => void;
                save?: () => void;
                fire?: (e: string) => void;
              };
            };
          };

          const editor =
            win.tinymce?.get?.("composebody") ||
            win.tinymce?.get?.("_message") ||
            win.tinymce?.activeEditor ||
            win.tinyMCE?.get?.("composebody") ||
            win.tinyMCE?.activeEditor;

          if (editor) {
            try {
              editor.setContent(html);
              if (typeof editor.save === "function") editor.save();
              if (typeof editor.fire === "function") editor.fire("change");

              // Also ensure body element inside editor iframe has Times New Roman style
              try {
                const edBody = (editor as { getBody?: () => HTMLElement }).getBody?.();
                if (edBody) {
                  edBody.style.fontFamily = "'Times New Roman', Times, serif";
                  edBody.style.fontSize = "15px";
                }
              } catch {
                // ignore
              }

              // Also ensure textarea is synced
              const ta = (document.getElementById("composebody") ||
                document.querySelector(
                  "textarea[name='_message']",
                )) as HTMLTextAreaElement | null;
              if (ta) {
                ta.value = html;
                ta.dispatchEvent(new Event("input", { bubbles: true }));
                ta.dispatchEvent(new Event("change", { bubbles: true }));
              }
              return true;
            } catch {
              // Wait for next attempt
            }
          }
          return false;
        },
        { html: bodyHtml },
      );

      if (resultSet) {
        bodySet = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    // Strategy 2: If TinyMCE API wasn't found, try iframe in DOM
    if (!bodySet) {
      const iframeSelector =
        "iframe#composebody_ifr, iframe[id*='composebody'], iframe#_message_ifr, iframe[id*='message'], .mce-edit-area iframe, .tox-edit-area iframe";
      const iframeLocator = page.locator(iframeSelector).first();
      const hasIframe = await iframeLocator
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (hasIframe) {
        try {
          const frameLocator = page.frameLocator(iframeSelector).first();
          const frameBody = frameLocator
            .locator(
              "body#tinymce, body.mce-content-body, body[contenteditable='true'], body",
            )
            .first();

          await frameBody.waitFor({ state: "attached", timeout: 4000 });
          await frameBody.evaluate((el, html) => {
            el.innerHTML = html;
            el.style.fontFamily = "'Times New Roman', Times, serif";
            el.style.fontSize = "15px";
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }, bodyHtml);
          bodySet = true;
        } catch (frameErr) {
          console.warn("Iframe set body error:", frameErr);
        }
      }
    }

    // Strategy 3: Plain textarea (visible or hidden fallback)
    if (!bodySet) {
      const textarea = page
        .locator("#composebody, #_message, textarea[name='_message']")
        .first();

      const isTextareaVisible = await textarea.isVisible().catch(() => false);
      if (isTextareaVisible) {
        await textarea.fill(rendered.body);
        bodySet = true;
      } else {
        await page.evaluate(
          ({ text, html }) => {
            const ta = (document.getElementById("composebody") ||
              document.querySelector(
                "textarea[name='_message']",
              )) as HTMLTextAreaElement | null;
            if (ta) {
              const isHtml = ta.getAttribute("data-html-editor") === "1";
              ta.value = isHtml ? html : text;
              ta.dispatchEvent(new Event("input", { bubbles: true }));
              ta.dispatchEvent(new Event("change", { bubbles: true }));
            }
          },
          { text: rendered.body, html: bodyHtml },
        );
        bodySet = true;
      }
    }

    // Always trigger TinyMCE save to synchronize underlying textarea before submit
    await page.evaluate(
      ({ html, text }) => {
        const win = window as unknown as {
          tinyMCE?: { triggerSave?: () => void };
          tinymce?: {
            triggerSave?: () => void;
            get?: (id: string) => { save?: () => void };
            activeEditor?: { save?: () => void };
          };
        };

        if (win.tinyMCE && typeof win.tinyMCE.triggerSave === "function") {
          win.tinyMCE.triggerSave();
        } else if (win.tinymce && typeof win.tinymce.triggerSave === "function") {
          win.tinymce.triggerSave();
        }

        const editor =
          win.tinymce?.get?.("composebody") ||
          win.tinymce?.get?.("_message") ||
          win.tinymce?.activeEditor;
        if (editor && typeof editor.save === "function") {
          editor.save();
        }

        const ta = (document.getElementById("composebody") ||
          document.querySelector(
            "textarea[name='_message']",
          )) as HTMLTextAreaElement | null;
        if (ta && (!ta.value || ta.value.trim() === "")) {
          ta.value = ta.getAttribute("data-html-editor") === "1" ? html : text;
          ta.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      { html: bodyHtml, text: rendered.body },
    );

    // 6. Set Email Priority to High in BigRock Webmail
    await this.setWebmailPriorityHigh(instanceId, page);

    // Small delay to let Roundcube internal events register
    await new Promise((r) => setTimeout(r, 600));

    // 7. Ensure Send command is enabled and remove disabled attributes
    await page.evaluate(() => {
      const win = window as unknown as {
        rcmail?: {
          enable_command?: (cmd: string, enable: boolean) => void;
          commands?: Record<string, boolean | number>;
        };
      };
      if (win.rcmail) {
        if (typeof win.rcmail.enable_command === "function") {
          win.rcmail.enable_command("send", true);
        }
        if (win.rcmail.commands) {
          win.rcmail.commands["send"] = true;
        }
      }

      // Remove disabled classes from any send buttons
      const btns = document.querySelectorAll(
        "#messagetoolbar .send, .header .send, button.send, a.button.send, #rcmbtn107, [data-action='send']",
      );
      btns.forEach((b) => {
        b.classList.remove("disabled");
        b.removeAttribute("disabled");
        b.removeAttribute("aria-disabled");
      });
    });

    this.addLog("info", `Clicking Send button for ${contact.email}...`, instanceId);

    // Click the actual Send button element
    const sendButton = page
      .locator(
        "#messagetoolbar button.send, #messagetoolbar a.send, .header button.send, button.btn-primary.send, button.send, a.button.send, a.buttonsend, #rcmbtn107, [data-action='send'], button[name='_send']",
      )
      .first();

    try {
      if (await sendButton.isVisible({ timeout: 3000 })) {
        await sendButton.click({ timeout: 5000, force: true });
      }
    } catch {
      // fallback
    }

    // Trigger Roundcube's native send command as secondary guarantee
    await page.evaluate(() => {
      const win = window as unknown as {
        rcmail?: {
          command?: (cmd: string, arg?: unknown, el?: unknown) => void;
          send_message?: () => void;
        };
      };
      if (win.rcmail) {
        if (typeof win.rcmail.send_message === "function") {
          try {
            win.rcmail.send_message();
            return;
          } catch {
            // fallback
          }
        }
        if (typeof win.rcmail.command === "function") {
          try {
            const btn = document.querySelector(
              "#messagetoolbar .send, button.send, a.button.send, #rcmbtn107",
            );
            win.rcmail.command("send", "", btn);
          } catch {
            // fallback
          }
        }
      }
    });

    // 8. Confirm dispatch and delivery from Roundcube
    let sendConfirmed = false;
    let roundcubeError = "";

    const checkStartTime = Date.now();
    const maxWaitMs = 20000; // 20s timeout for SMTP delivery confirmation

    while (Date.now() - checkStartTime < maxWaitMs) {
      // A. Check if URL navigated away from compose (standard Roundcube behavior on send)
      const currentUrl = page.url();
      if (!currentUrl.includes("_action=compose") && currentUrl.includes("_task=mail")) {
        sendConfirmed = true;
        break;
      }

      // B. Check for modal dialogs (e.g. "Send message without subject?" confirmation)
      const modalConfirm = page
        .locator(
          ".ui-dialog-buttonpane button:has-text('Send'), .ui-dialog-buttonpane button:has-text('OK'), .modal-footer button:has-text('Send'), .modal-footer button:has-text('OK')",
        )
        .first();
      if (await modalConfirm.isVisible({ timeout: 300 }).catch(() => false)) {
        await modalConfirm.click().catch(() => {});
      }

      // C. Check Roundcube notification banners for success or error
      const statusBanner = await page.evaluate(() => {
        // Success notices
        const notices = document.querySelectorAll(
          "#messagestack div, #message, .notice, .confirmation, .alert-success, .boxinformation, div.toast",
        );
        for (const el of Array.from(notices)) {
          const text = (el.textContent || "").trim();
          if (/sent|successfully|message sent/i.test(text)) {
            return { type: "success", text };
          }
        }

        // Error or warning notices
        const errors = document.querySelectorAll(
          "#messagestack .error, #messagestack .warning, .boxerror, .boxwarning, .alert-danger, .alert-warning",
        );
        for (const el of Array.from(errors)) {
          const text = (el.textContent || "").trim();
          if (text && !/loading|sending/i.test(text)) {
            return { type: "error", text };
          }
        }

        return null;
      });

      if (statusBanner) {
        if (statusBanner.type === "success") {
          sendConfirmed = true;
          break;
        } else if (statusBanner.type === "error") {
          roundcubeError = statusBanner.text;
          break;
        }
      }

      await new Promise((r) => setTimeout(r, 800));
    }

    if (roundcubeError) {
      throw new Error(`BigRock Webmail rejected message: "${roundcubeError}"`);
    }

    if (!sendConfirmed) {
      if (page.url().includes("_action=compose")) {
        throw new Error(
          `Message to ${contact.email} was not dispatched by BigRock. Ensure your account is logged in and not rate-limited.`,
        );
      }
    }
  }

  private async setWebmailPriorityHigh(
    instanceId: "1" | "2",
    page: Page,
  ): Promise<void> {
    try {
      // 1. Check if #_priority or select[name='_priority'] is visible directly
      const prioritySelect = page
        .locator("#_priority, select[name='_priority']")
        .first();

      let isVisible = await prioritySelect
        .isVisible({ timeout: 1500 })
        .catch(() => false);

      // If priority dropdown is collapsed or hidden inside options accordion in Roundcube, toggle it
      if (!isVisible) {
        const optionsToggle = page
          .locator(
            "a[href*='#options'], a#composeoptionstoggle, a.button.options, button:has-text('Options'), a:has-text('Options'), #composeoptions, a[onclick*='options']",
          )
          .first();

        if (await optionsToggle.isVisible({ timeout: 1500 }).catch(() => false)) {
          await optionsToggle.click().catch(() => {});
          await new Promise((r) => setTimeout(r, 400));
          isVisible = await prioritySelect
            .isVisible({ timeout: 1500 })
            .catch(() => false);
        }
      }

      let prioritySet = false;

      // 2. Try selecting High priority via Playwright selector
      if (await prioritySelect.count() > 0) {
        // Roundcube priority values: 1 = highest, 2 = high, 3 = normal, 4 = low, 5 = lowest
        for (const opt of [
          { label: "High" },
          { value: "2" },
          { label: "Highest" },
          { value: "1" },
        ]) {
          try {
            await prioritySelect.selectOption(opt, { timeout: 1500 });
            prioritySet = true;
            break;
          } catch {
            // try next option
          }
        }
      }

      // 3. Fallback: Directly update DOM select and form element to ensure Roundcube sends high priority
      const evaluated = await page
        .evaluate(() => {
          const select = document.querySelector(
            'select[name="_priority"], #_priority',
          ) as HTMLSelectElement | null;

          if (select) {
            let targetVal = "";
            for (const opt of Array.from(select.options)) {
              if (
                /high|urgent/i.test(opt.text) ||
                opt.value === "2" ||
                opt.value === "1"
              ) {
                targetVal = opt.value;
                break;
              }
            }
            if (!targetVal) targetVal = "2";
            select.value = targetVal;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }

          // If no select element is present, inject hidden input into compose form
          const form = document.querySelector(
            'form[name="form"], form#compose-form, form[action*="_task=mail"]',
          );
          if (form) {
            let input = form.querySelector(
              'input[name="_priority"]',
            ) as HTMLInputElement | null;
            if (!input) {
              input = document.createElement("input");
              input.type = "hidden";
              input.name = "_priority";
              form.appendChild(input);
            }
            input.value = "2";
            return true;
          }

          return false;
        })
        .catch(() => false);

      if (prioritySet || evaluated) {
        this.addLog(
          "info",
          `Instance ${instanceId}: Priority set to HIGH in BigRock Webmail.`,
          instanceId,
        );
      } else {
        this.addLog(
          "warn",
          `Instance ${instanceId}: Priority field not detected; proceeded with default priority.`,
          instanceId,
        );
      }
    } catch (err) {
      this.addLog(
        "warn",
        `Instance ${instanceId}: Notice while setting priority: ${err}`,
        instanceId,
      );
    }
  }

  public getState(): AutomationState {
    const processed = this.contactsQueue.filter(
      (c) => c.status === "sent" || c.status === "failed",
    ).length;
    const success = this.contactsQueue.filter((c) => c.status === "sent").length;
    const failed = this.contactsQueue.filter((c) => c.status === "failed").length;

    let overallStatus: AutomationState["status"] = "idle";
    if (this.isRunning) {
      overallStatus = this.isPaused ? "paused" : "running";
    } else if (
      this.contactsQueue.length > 0 &&
      this.contactsQueue.every((c) => c.status !== "pending")
    ) {
      overallStatus = "completed";
    }

    return {
      status: overallStatus,
      targetCount: this.targetCount,
      processedCount: processed,
      successCount: success,
      failedCount: failed,
      delaySeconds: this.delaySeconds,
      parallelMode: this.parallelMode,
      activeTemplateId: this.activeTemplateId,
      rotationMode: this.rotationMode,
      subjectLines: [...this.subjectLines],
      instance1: { ...this.instances["1"].status },
      instance2: { ...this.instances["2"].status },
      logs: this.logs.slice(0, 100),
    };
  }

  private emitState(): void {
    this.emit("state", this.getState());
  }
}

// Global singleton instance so it persists across Next.js API requests
const globalForMailer = globalThis as unknown as {
  __mailerService?: MailerService;
};

export const mailerService =
  globalForMailer.__mailerService || new MailerService();

if (process.env.NODE_ENV !== "production") {
  globalForMailer.__mailerService = mailerService;
}
