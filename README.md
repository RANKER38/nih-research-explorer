# NIH Research Explorer

Search NIH RePORTER projects by keyword, fiscal year, country, project type,
funding agency, and organization. The app can enrich results with PubMed
publications and public email addresses listed in individual author
affiliations, then export the author-level results to an Excel workbook.

## Requirements

- Node.js compatible with Next.js 16
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

## Application routes

- `/` — NIH project search and export interface
- `/api/nih/search` — streams NIH RePORTER project search progress and results
- `/api/nih/enrich` — enriches projects using NIH publication links and PubMed

Application code lives in `src/app`. The NIH APIs are accessed server-side by
the route handlers; no API keys are required by this project.
