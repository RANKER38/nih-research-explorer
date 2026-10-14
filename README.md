# NIH Research Explorer & BigRock Automated Mailing Suite

A full-screen research intelligence and automated outreach platform. Discover NIH RePORTER projects, enrich records with verified PubMed author emails, and automate BigRock / Mailhostbox Roundcube webmail campaigns with dual parallel browser engines.

## Key Features

1. **NIH Research Discovery**:
   - Query NIH RePORTER across fiscal years, countries, agencies, project types, and keywords.
   - Stream live author affiliation enrichment via PubMed NCBI E-utilities.
   - Export structured datasets to formatted Excel (.xlsx) and CSV with UTF-8 BOM.
   - **One-click Push to Mailer**: Transfer enriched contacts directly into the automation queue.

2. **BigRock Automated Mailer (`us3.webmail.mailhostbox.com`)**:
   - **Scope & Policy**: Strictly designed for **normal, authentic 1-to-1 research correspondence** (not for bulk marketing or mass campaigning data). **Supported exclusively for BigRock Webmail**.
   - Automated browser controller for Mailhostbox / BigRock Roundcube Webmail.
   - **Dual Parallel Instances**: Run Instance 1 and Instance 2 simultaneously to dispatch research emails with 2 parallel browser engines.
   - **Launch BigRock Buttons**: Launch persistent browser windows directly to the webmail sent box for seamless account authentication.
   - **Delivery Status & Verification Hub**:
     - Real-time tracker showing how many emails were delivered directly to the BigRock Sent box.
     - Delivery success rate percentage gauge and error tracking.
     - Breakdown of deliveries by Instance 1 and Instance 2.
     - Live delivered email registry feed.
     - One-click **Export Delivery Report** in Excel (.xlsx) and CSV formats.
   - **Automated High Priority Dispatch**: Sets email Priority to **High** (`X-Priority: 1 / 2`) in the BigRock compose interface before clicking Send.
   - **Custom Template Upload & Variable Replacement**: Upload your own `.txt`, `.md`, or `.json` template directly from the page; automatically replaces `{Name}`, `{Title}` / `{ProjectTitle}`, `{Institution}`, and `{Email}` dynamically for each contact.
   - **Throttling & Safety**: Batch caps up to 100 emails, customizable delay between sends (3s - 15s) with randomized jitter.
   - **Pause, Resume & Stop**: Real-time campaign state control with seamless pause and resume without losing place in queue.
   - **Direct File Import**: Upload external Excel or CSV contact lists directly into the mailer queue.
   - **Live Activity Stream**: Real-time Server-Sent Events (SSE) terminal streaming live dispatch logs and statuses.

3. **Outreach Template Workshop**:
   - **Upload & Custom Templates**: Upload any `.txt`, `.json`, or `.md` template file, or compose a custom template.
   - 3 pre-built scientific outreach strategies:
     - Template 1: Academic Collaboration & Research Discussion
     - Template 2: Editorial & Peer Publication Review Invitation
     - Template 3: Laboratory Technology, Services & Support
   - Live variable interpolation (`{Name}`, `{ProjectTitle}`, `{Title}`, `{Institution}`, `{Email}`).
   - Interactive live preview window mimicking webmail client rendering.

4. **Modern Executive UI**:
   - Full-screen dashboard layout maximizing productivity.
   - High-contrast obsidian and slate executive dark theme with indigo, cyan, and emerald glowing status indicators.

## Requirements

- Node.js 18+ (Node.js 24 supported)
- Google Chrome or Microsoft Edge installed on host machine
- npm

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validate and build

```bash
npm run lint
npm run build
npm start
```

## Application Routes

- `/` — Full-screen interface with tab navigation between NIH Discovery, BigRock Mailer, and Templates
- `/api/nih/search` — Streams NIH RePORTER project search results
- `/api/nih/enrich` — Enriches projects with PubMed publication links and author emails
- `/api/mailer/launch` & `/api/mailer/control` — Controls BigRock Playwright browser instances, start, pause, resume, and stop
- `/api/mailer/status` — Returns live automation state and contact queues
- `/api/mailer/stream` — Real-time Server-Sent Events (SSE) stream for logs and progress
