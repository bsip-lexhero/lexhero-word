# Lexhero Word Add-in MVP

Lexhero is a production-shaped Microsoft Word task-pane assistant for Italian legal work. The monorepo contains a React/Office.js add-in, a NestJS API, and Supabase migrations. The primary model is Gemini 3.1 Flash-Lite; deterministic mock LLM and MCP fallbacks remain available for offline development.

## Architecture

```text
apps/word-addin  React + Vite + Office.js + Supabase Auth
apps/api         NestJS orchestration, verified Supabase JWTs, persistence and adapters
supabase         Postgres schema, indexes, triggers, RLS policies
```

The add-in sends only the Supabase URL and public anon key to the browser. Protected API routes verify the bearer JWT (HS256 secret when configured, otherwise Supabase JWKS). The authenticated `sub` is the sole source of user identity. The API uses the service-role key only server-side for persistence; RLS additionally protects direct user-scoped Supabase access.

Request orchestration lives in `WorkflowService`. Controllers stay thin. Office.js, Supabase, API calls, LLM, MCP, webhook, and persistence each have isolated adapters. Optional MCP/webhook failures become warnings and tool-call records when a useful response can still be returned.

## Design provenance

The public `lexhero-public/design` repository was inspected before implementation. It is a Next.js 14 React app using Panda CSS/Park UI, Tailwind, Lucide, and Motion. The task pane selectively ports:

- Directly reused: `lexhero-wordmark.png`, `lexhero.png`, `icon.svg`, and `icon-dark.svg`.
- Adapted: the pink/neutral CSS tokens, status colors, small radii, typography intent, compact prompt hierarchy, buttons, form controls, history rows, focus treatment, empty/error/loading states, and legal-assistant tone.
- Reimplemented: auth form, task-pane header, selection context, workflow composer, citation stack, expandable tool calls, insertion actions, and history, using lightweight React and plain centralized CSS for 320–480px widths.
- Not used: desktop sidebar/app shell, editor canvas, pricing, marketplace, upload dialogs, wide tables, and Panda-generated runtime. These add weight or do not fit Word's narrow pane.

No runtime path references the cloned design repository. See [DESIGN-INTEGRATION.md](./DESIGN-INTEGRATION.md) for the detailed audit.

## Local setup

Prerequisites: Node.js 20+, npm, Microsoft Word desktop or web, and a Supabase project (hosted or local).

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/word-addin/.env.example apps/word-addin/.env
```

Set the frontend `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and API URL. Never put a service-role key in the frontend environment. Set the same Supabase URL plus `SUPABASE_SERVICE_ROLE_KEY` in the API environment. For JWT verification, either set the legacy `SUPABASE_JWT_SECRET`, or leave it empty to use the project's JWKS endpoint.

### Supabase

For hosted Supabase, apply `supabase/migrations/202607100001_lexhero_mvp.sql` with the SQL editor or linked CLI and create a demo email/password user in Authentication.

For local Supabase:

```bash
npx supabase start
npx supabase db reset
```

Copy the local API URL, anon key, service-role key, and JWT secret printed by the CLI into the appropriate `.env` files. In Supabase Auth URL configuration, allow `https://localhost:3001` (email/password login itself does not redirect).

### Start the services

In separate terminals:

```bash
npm run dev:api
npm run dev:addin
```

Check `http://localhost:3000/api/health` and accept/trust the Vite development certificate at `https://localhost:3001`.

### Sideload in Word

The manifest is `apps/word-addin/manifest.xml`.

- Word on the web: open a document, choose **Home → Add-ins → More Add-ins → My Add-ins → Upload My Add-in**, then upload the manifest.
- Word on Windows: use **File → Options → Trust Center → Trusted Add-in Catalogs**, add a network share containing the manifest, restart Word, and insert Lexhero from **Shared Folder**.
- Word on macOS: copy the manifest to `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`, restart Word, then choose **Insert → My Add-ins**.

Exact startup after initial setup:

```bash
npm run dev:api
npm run dev:addin
```

## Integrations

### MCP legal research

Default local settings enable the real MCP client with mock fallback. `legal_references`, explicit `useMcp`, and prompts mentioning Italian sources select the adapter. The API connects to `capazme/mcp-legal-it` over SSE, discovers its advertised tools, invokes `cite_law` for explicit article references and unified jurisprudence search for the broader query, then normalizes returned Markdown into citations. Calls and result counts are bounded. The deterministic fallback is used only when configured and the real server is unavailable.

Run the server with Docker:

```bash
git clone https://github.com/capazme/mcp-legal-it.git
cd mcp-legal-it
docker build -t mcp-legal-it .
docker run --rm -p 8000:8000 mcp-legal-it
```

Or run it from a Python environment with `MCP_TRANSPORT=sse`. Configure Lexhero:

```env
MCP_LEGAL_SERVER_URL=http://localhost:8000/sse
MCP_LEGAL_ENABLED=true
MCP_LEGAL_MOCK_FALLBACK=false
MCP_LEGAL_TIMEOUT_MS=30000
MCP_LEGAL_MAX_RESULTS=5
```

The integration was interoperability-tested against `mcp-legal-it` v2.8.0 over `http://localhost:8000/sse`. Keeping fallback enabled is useful for offline UI development; production should normally disable it so research failures cannot be mistaken for live results.

### Webhook

Only the server-configured URL can be called. The frontend cannot provide a URL. Enable it with:

```env
LEXHERO_WEBHOOK_ENABLED=true
LEXHERO_WEBHOOK_URL=https://your-allowlisted-workflow.example/hook
LEXHERO_WEBHOOK_SECRET=server-only-secret
LEXHERO_WEBHOOK_TIMEOUT_MS=360000
```

The adapter forwards only the action, prompt, text context, and safe metadata; it applies an abort timeout and never returns secrets.

### Gemini 3.1 Flash-Lite

The production LLM adapter calls Google's `generateContent` endpoint from the backend. The API key never reaches the Word add-in. MCP output and normalized citations are supplied as explicitly labelled grounding context, and the system instruction prohibits invented legal sources.

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=45000
GEMINI_THINKING_MODEL=gemini-3.1-flash-lite
```

Set `LLM_PROVIDER=mock` only for deterministic offline development.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Manual test checklist

1. Open the task pane at 320px, 400px, and 480px; confirm no horizontal overflow and visible keyboard focus.
2. Log in with the Supabase demo account, reload the pane, and confirm session restoration; then log out.
3. Select a clause in Word, click **Aggiorna**, and confirm the preview.
4. Run every workflow; test a custom prompt both with and without selected text.
5. Confirm whole-document text is sent only after checking the explicit option.
6. Run legal references with the MCP server unavailable; confirm mocked tool status, demo citation, and warning.
7. Run the webhook button while disabled and confirm the clear warning/tool status; enable a configured endpoint and repeat.
8. Confirm answer, citations, warnings, MCP/webhook status, and expandable tools render and long references wrap.
9. Test copy, insert at cursor, insert after selection, and replace selection. No mutation should happen automatically.
10. Open history, refresh it, and reload an earlier response.
11. Inspect Supabase rows for the user, document, session, messages, and tool calls; verify another user cannot read them through user-scoped access.

## Troubleshooting

- **HTTPS/certificate:** visit `https://localhost:3001` directly and trust the generated certificate. Restart Vite if Office cached a failed certificate.
- **Manifest/sideload:** validate that the dev server is running and all manifest URLs use HTTPS. Word desktop caches manifests; fully restart Word after changes.
- **CORS:** include the exact add-in origin in `CORS_ORIGINS`. Do not use wildcard CORS with credentials.
- **Supabase redirects/login:** add the local HTTPS URL in Auth URL configuration and confirm email/password is enabled.
- **Expired session:** the API returns 401 and the UI reports that the session expired; log out/in to refresh it.
- **MCP unavailable:** keep `MCP_LEGAL_MOCK_FALLBACK=true` for local development. Results are visibly marked mocked.
- **Empty selection:** prompt-only custom workflows remain available. Replace acts on the current insertion point when Word has no non-empty selection.
- **Desktop vs web:** manifest upload paths and Office.js behavior vary. Word web requires the dev URL to remain reachable by the browser; desktop may require a trusted catalog and restart.
- **Persistence unavailable:** the API intentionally reports a service configuration error when service-role persistence is required. Health remains public.

## Current limitations and deployment TODOs

- The MCP adapter currently targets the repository's legacy SSE endpoint because that is the required deployment URL. A future deployment may prefer its newer Streamable HTTP transport at `/mcp`.
- A real LLM provider adapter, prompt hardening, rate limiting, token/cost controls, and production observability remain.
- Document records are created per workflow in this MVP; production should upsert a stable Office document identifier where the host provides one.
- Production should use asymmetric Supabase signing/JWKS where available, rotate secrets, restrict origins, deploy behind TLS, configure structured redacted logs, and add abuse controls.
- The mock MCP citation is not a verified research result and is labeled accordingly.
