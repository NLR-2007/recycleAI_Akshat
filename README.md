# RecycleVision AI

**Scan it. Discover it. Give it a second life!**

An AI-powered environmental education web app. Upload a photo or type the name of an everyday
object, and get its likely materials, an honest list of advantages and disadvantages, what happens
to it under four different disposal routes, the most responsible next action, and up to three safe
second-life projects with full instructions. Then record what you actually did and watch your own
history build up.

- **Hackathon:** Rotary AI for Good
- **Theme:** Create Lasting Impact
- **Focus:** Environmental sustainability and community education
- **Live demo:** _add your `.vercel.app` URL here after deploying_

> RecycleVision AI is an independent hackathon entry. It is not an official Rotary product and
> carries no endorsement from Rotary or any partner organisation.

---

## Table of contents

- [Problem statement](#problem-statement)
- [Solution](#solution)
- [Core features](#core-features)
- [Technology stack](#technology-stack)
- [System architecture](#system-architecture)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Running without an API key (mock provider)](#running-without-an-api-key-mock-provider)
- [Tests](#tests)
- [Deploying to Vercel](#deploying-to-vercel)
- [Quotas, abuse protection and monitoring](#quotas-abuse-protection-and-monitoring)
- [Supported browsers](#supported-browsers)
- [Known limitations](#known-limitations)
- [AI and environmental accuracy disclaimer](#ai-and-environmental-accuracy-disclaimer)
- [Privacy](#privacy)
- [Screenshots](#screenshots)
- [Project structure](#project-structure)
- [License](#license)

---

## Problem statement

Every day, reusable and recyclable household items are thrown away because people have no quick way
to find out what they are made of, whether they can be repaired, donated or recycled, how improper
disposal affects the environment, or what else the object could become. Guidance exists, but not at
the moment the decision is made — standing at the bin.

People typically do not know:

- whether an item can be recycled where they live;
- whether it can be reused or repaired instead;
- what useful things could be made from it;
- what the advantages and drawbacks of the material are;
- how improper disposal affects soil, water and wildlife;
- which action is actually the most responsible.

## Solution

RecycleVision AI puts that answer one photo away. A vision-capable model identifies the object,
explains its likely materials and trade-offs, assesses the environmental impact of four disposal
routes, recommends the most responsible next step, and generates up to three realistic reuse
projects with step-by-step instructions and safety notes. Users can then record the action they
took and review their history and charts.

**Mission:** transform everyday waste into environmental knowledge, responsible decisions and
useful second-life opportunities.

## Core features

| Feature | What it does |
| --- | --- |
| **AI waste scanner** | Photo upload, mobile camera capture, desktop drag-and-drop, or plain text item name. Client-side resize and compression keeps uploads small. |
| **Product identification** | Object name, likely materials, category, possible actions, and explicit identification notes where the model is uncertain. |
| **Advantages & disadvantages** | 3–5 of each, specific to the item, in beginner-friendly language. |
| **Impact on nature** | Separate explanations for littering, landfill, recycling and reuse, plus wildlife risks, all qualitative by design. |
| **Best environmental action** | One recommended action from reduce / keep using / repair / reuse / donate / recycle / specialized disposal, with precautions. |
| **Give it a second life** | Up to three safe reuse projects: difficulty, time, materials, numbered steps, safety notes and environmental benefit. Opens in a detail modal with an **I'll Try This Idea** button. |
| **Eco action tracker** | Record planning / reused / repaired / donated / recycled / specialist collection / no action, add a note, filter and search history, re-open past AI results, delete one record or clear everything. |
| **Eco impact dashboard** | Recharts donut (material categories), bar (completed actions by type) and 14-day activity area chart, all from your own locally stored activity. |
| **Safety-first behaviour** | Hazardous items (damaged lithium cells, chemical containers, medical waste…) return **zero** DIY ideas and are routed to specialist disposal. Enforced on the server, not just in the prompt. |

## Technology stack

**Frontend** — React 18, TypeScript, Vite 6, Tailwind CSS 3, React Router 6, Framer Motion,
Recharts, Lucide icons, Zod.

**Backend** — a single Vercel Function in TypeScript: `POST /api/analyze`.

**AI** — two OpenAI-compatible providers behind one server-side adapter:

| Role | Provider | Default model | Env var |
| --- | --- | --- | --- |
| Primary | [Groq](https://console.groq.com) | `meta-llama/llama-4-scout-17b-16e-instruct` | `GROQ_API_KEY` |
| Fallback | [NVIDIA NIM](https://build.nvidia.com) | `meta/llama-4-maverick-17b-128e-instruct` | `NVIDIA_NIM_API_KEY` |

Both models are multimodal, so photo and text analysis use the same code path. If Groq fails, times
out or is rate limited, the request automatically retries on NVIDIA NIM. Either key alone is
enough to run the app; set both for resilience. Order is configurable with `AI_PROVIDER_ORDER`.

**Storage** — browser `localStorage` only. No accounts, no database, no server-side user data.

**Hosting** — Vercel for both the static frontend and the serverless function. GitHub is used for
source control only.

## System architecture

```
Browser (React SPA)
  │  photo resized + compressed to ~<1 MB JPEG in-browser
  │  POST /api/analyze  { itemName?, imageDataUrl? }
  ▼
Vercel Function  api/analyze.ts            ← API keys live ONLY here
  ├─ method / content-type / body-size checks
  ├─ per-IP fixed-window rate limit
  ├─ MIME + decoded-size validation of the data URL
  ├─ builds the system prompt (api/_prompt.ts)
  ├─ calls provider 1 → provider 2 (api/_providers.ts)
  ├─ extracts JSON (handles code fences and chatty replies)
  ├─ validates against the Zod schema (src/types/analysis.ts)
  ├─ one corrective round-trip if the shape is wrong
  └─ hazardous-item safety backstop: strips reuse ideas, forces specialist disposal
  ▼
{ ok: true, analysis, meta } or { ok: false, error: { code, message, retryable } }
  ▼
Browser saves scan metadata + analysis to localStorage (no photographs)
  → Results page, Eco Actions history, Dashboard charts
```

The schema in [`src/types/analysis.ts`](src/types/analysis.ts) is the single contract shared by the
function and the client, so a malformed model reply can never reach the UI. A failed request shows
an error with a retry button — **never** a fabricated analysis.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` serves the API too. A small dev-only Vite plugin mounts the *same*
`api/analyze.ts` handler at `/api/analyze`, so there is no second implementation to drift out of
sync — see [`vite.config.ts`](vite.config.ts). Secrets are read from `.env.local`.

Other scripts:

```bash
npm run build         # tsc -b && vite build  → dist/
npm run preview       # serve the production build locally
npm run typecheck     # TypeScript only
npm run lint          # ESLint
npm test              # full test suite (see below)
npm run dev:vercel    # vercel dev, the real Vercel Functions runtime
npm run mock:provider # local stand-in for Groq, for UI work without a key
```

To test the function on the genuine Vercel runtime instead of the Vite bridge:

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local   # pulls the keys you set in the Vercel dashboard
vercel dev
```

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in at least one API key:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

NVIDIA_NIM_API_KEY=your_nvidia_nim_api_key
NVIDIA_NIM_MODEL=meta/llama-4-maverick-17b-128e-instruct
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1

AI_PROVIDER_ORDER=groq,nvidia
```

All of these are **server-side** variables. None is prefixed with `VITE_`, so none is ever bundled
into the browser. `.env.local` is git-ignored. Never commit a real key, and never paste one into a
README or an issue.

If no key is configured the API returns a clear `not_configured` error rather than failing
silently or inventing results.

## Running without an API key (mock provider)

Useful for UI work and for demos while you wait for a key. It returns realistic, schema-valid
analyses for a bottle, a damaged lithium battery and generic items — clearly local, never passed
off as real AI output.

```bash
# terminal 1
npm run mock:provider          # listens on 127.0.0.1:5599

# .env.local
GROQ_API_KEY=local-mock-key
GROQ_BASE_URL=http://127.0.0.1:5599/v1
GROQ_MODEL=mock-vision-model
AI_PROVIDER_ORDER=groq

# terminal 2
npm run dev
```

Delete those lines and put your real key back before deploying.

## Tests

```bash
npm test
```

No test framework is installed. [`tests/run.mjs`](tests/run.mjs) bundles the TypeScript sources with
esbuild (already a Vite dependency) and runs three suites in plain Node, driving the **real**
handler against a mock provider:

| Suite | Covers |
| --- | --- |
| `tests/api.test.mjs` (19 tests) | method and content-type rejection, empty/short input, unsupported MIME, malformed data URL, oversized payload, missing keys, successful text analysis, fenced/chatty JSON recovery, image part delivery, input-mode reporting, hazardous-item backstop, provider 401/429/500 mapping, non-JSON and schema-violating replies, per-IP throttling with `Retry-After` |
| `tests/fallback.test.mjs` | a failing Groq request transparently falls back to NVIDIA NIM |
| `tests/storage.test.mjs` (17 tests) | save/load/update/delete, persistence across a simulated reload, "planning never counts as completed", completion timestamps, note cap, record cap, dashboard aggregation (summary, donut, bars, 14-day series), no image data in storage, graceful handling of corrupted storage |

Latest run: **37 passed, 0 failed**, alongside a clean `npm run typecheck`, `npm run lint`
(0 errors) and `npm run build`.

Manual checks worth repeating against a real key before you demo:

1. Text input — `Plastic water bottle` → identification, pros/cons, impact, guidance, up to 3 ideas.
2. Image upload — a photo of a cardboard box → preview, real AI result, useful suggestions.
3. Eco actions — pick a project, mark it complete, confirm history and dashboard update.
4. Persistence — refresh the page; records, results and stats remain.
5. Safety — `Damaged lithium-ion battery` → warnings, specialist disposal, **no** DIY ideas.
6. API failure — set a deliberately invalid key → safe error plus retry, no fabricated analysis.
7. Deployment — the public URL on desktop and mobile, including direct navigation to each route.

## Deploying to Vercel

1. Create a GitHub repository, e.g. `RecycleVision-AI`.
2. Push this project to it.
3. In Vercel, choose **Add New Project** and import the repository.
4. Confirm the detected framework is **Vite**.
5. Build command `npm run build`, output directory `dist` (both already in `vercel.json`).
6. Under **Settings → Environment Variables**, add `GROQ_API_KEY` and/or `NVIDIA_NIM_API_KEY`
   (plus the optional model/order variables) for Production, Preview and Development. Leave them as
   plain server variables — do **not** prefix them with `VITE_`.
7. Deploy.
8. Open the `.vercel.app` URL and check the pages load.
9. Run a real scan to confirm `POST /api/analyze` works in production.
10. Navigate directly to `/scan`, `/actions`, `/dashboard` and `/about` to confirm SPA routing.
11. Confirm that further pushes to `main` trigger production deployments.

[`vercel.json`](vercel.json) handles the rest: the SPA rewrite is written as
`/((?!api/).*) → /index.html`, so deep links work while `/api/*` keeps reaching the function, and
the function is given 1024 MB and a 60 s limit.

## Quotas, abuse protection and monitoring

- **Request validation** — only `POST` with `application/json`; bodies over ~4 MB are rejected
  before parsing; image MIME type and decoded size are checked (JPEG/PNG/WebP, max 3 MB decoded).
- **Rate limiting** — a per-IP fixed window (12 requests/minute) inside the function, returning
  `429` with `Retry-After`. Serverless instances are ephemeral and not shared, so this is a speed
  bump, not a guarantee. For anything public and busy, put a shared store (Upstash Redis, Vercel
  KV) or Vercel's WAF/rate-limiting in front of it.
- **Provider quotas** — both Groq and NVIDIA NIM apply their own free-tier rate and token limits.
  Watch usage in the [Groq console](https://console.groq.com) and
  [NVIDIA build dashboard](https://build.nvidia.com), and set the fallback order to suit whichever
  has headroom.
- **Timeouts** — each provider call is aborted after 45 s; the function's own limit is 60 s.
- **Logging** — the function logs provider, model and failure reasons only. Photographs, data URLs
  and API keys are never logged, and error responses never echo provider internals.

## Supported browsers

Current Chrome, Edge, Firefox and Safari on desktop, and Chrome/Safari on Android and iOS. Camera
capture uses `<input capture="environment">`, which falls back to the normal file picker where it
is unsupported. `localStorage` must be enabled for history to persist; with it blocked the app
still works for one-off analyses. The UI honours `prefers-reduced-motion`.

## Known limitations

- History is per browser. There is no account and no sync between devices; clearing site data
  removes everything.
- Uploaded photographs are deliberately not stored, so past records show metadata and text only.
- History is capped at the 40 most recent records to stay inside `localStorage` quotas.
- Material identification from a photo is approximate, and plastic resin types cannot be determined
  visually at all.
- No local recycling-centre lookup — the app never invents municipal rules or facilities.
- English only for now.
- Completed actions are self-reported and not verified.

## AI and environmental accuracy disclaimer

This is an educational prototype, not a certified waste-management service.

The app deliberately does **not** produce:

- exact CO₂, water or energy savings;
- decomposition timelines or recycling percentages stated as fact;
- claims about what your local service accepts;
- numeric AI confidence scores.

Those figures depend on the specific material, local infrastructure and transport. Any quantitative
estimate added later must carry documented sources, assumptions, units and a calculation method.
Until then, explanations are qualitative and the uncertainty is stated in words.

**Safety:** for damaged or swollen batteries, lithium-ion cells, chemical or solvent containers,
pressurised canisters, and medical or contaminated waste, the app returns no DIY ideas and points
to qualified collection instead. Never cut, heat, puncture, charge or dismantle such items. Reuse
suggestions are ideas, not certified instructions — supervise children, and never reuse a container
for food or drinking water unless it was made for that purpose and can be cleaned thoroughly.

## Privacy

- Your item name and compressed photo are sent to this app's own serverless endpoint, which
  forwards them to the configured AI provider solely to produce the analysis.
- The app stores no photographs and keeps no server-side account or user record.
- Scan metadata, the analysis text and your recorded actions stay in your browser's
  `localStorage`. Nothing syncs between devices.
- You can delete any record, or clear everything, from the **My Eco Actions** page.
- A privacy note stating all of this is shown in the app, on the scanner page and in the footer.

## Screenshots

_Add screenshots after deploying — suggested set:_

| View | File |
| --- | --- |
| Home / hero | `docs/screenshots/home.png` |
| AI scanner with image preview | `docs/screenshots/scanner.png` |
| Analysis results | `docs/screenshots/results.png` |
| Second-life project modal | `docs/screenshots/reuse-idea.png` |
| My eco actions | `docs/screenshots/actions.png` |
| Impact dashboard | `docs/screenshots/dashboard.png` |

## Project structure

```text
RecycleVision-AI/
├── api/
│   ├── analyze.ts          # POST /api/analyze — validation, providers, schema, safety backstop
│   ├── _prompt.ts          # system prompt + user prompt builders (accuracy & safety rules)
│   └── _providers.ts       # Groq / NVIDIA NIM adapter (OpenAI-compatible)
├── public/favicon.svg
├── src/
│   ├── components/
│   │   ├── analysis/       # identity, pros/cons, impact, reuse ideas, action picker
│   │   ├── dashboard/      # Recharts wrappers
│   │   ├── layout/         # navbar with mobile drawer, footer
│   │   ├── scanner/        # dropzone + camera, staged progress
│   │   └── ui/             # button, card, badge, alert, modal, toast, skeleton, SVG art
│   ├── hooks/useRecords.ts # live subscription to local records (updates across tabs)
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── image.ts        # validation, downscale, compression
│   │   ├── stats.ts        # dashboard aggregation (unit-tested)
│   │   ├── storage.ts      # localStorage layer, action bookkeeping, caps
│   │   └── utils.ts        # cn(), date formatting, day bucketing
│   ├── pages/              # Home, Scanner, Results, EcoActions, Dashboard, About, NotFound
│   ├── services/analyzeService.ts
│   ├── types/analysis.ts   # Zod schema shared by server and client
│   ├── App.tsx  main.tsx  index.css
├── tests/                  # api, fallback and storage suites + mock provider
├── .env.example
├── vercel.json
├── vite.config.ts          # includes the dev-only /api bridge
└── README.md
```

## License

MIT — see [`LICENSE`](LICENSE).
