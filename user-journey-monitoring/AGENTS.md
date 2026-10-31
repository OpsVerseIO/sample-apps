<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- **Layout**: app code is `src/app`, `src/components`, `src/lib`. All reusable instrumentation is in `src/observability/`; app code only calls into it (`trackJourneyStep`, `useJourneyStep`, `withSpan`, `recordOutcome`). App-specific setup: `src/instrumentation*.ts`, `src/lib/journeys.ts`, `src/lib/shop-metrics.ts`.
- **Don't rename** the journey event contract (`journey_step` event; `journey`, `step`, `step_index`, `outcome`, `error_reason` attributes). The collector config and `grafana/*.json` depend on it — see `INSTRUMENTATION.md`.
- **Metrics**: low-cardinality attributes only. Session, user and order IDs go on spans/logs, never metrics.
- **Collector config** (`otel-collector/config.yaml`): keep `context: log` on transform groups, the full Faro CORS `allowed_headers` list and `deltatocumulative` — removing any of them silently breaks data.
- **Secrets**: `.env*` is gitignored except `.env.example`; never commit credentials.
- **Verify**: `npx tsc --noEmit`, `npm run lint`, then with the app running `npm run simulate -- 5`.
