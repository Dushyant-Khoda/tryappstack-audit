# [1.1.0](https://github.com/Dushyant-Khoda/tryappstack-audit/compare/v1.0.0...v1.1.0) (2026-03-25)


### Features

* launch tryappstack-audit — 16-module code audit + AI team REPL for JS/TS projects ([163b919](https://github.com/Dushyant-Khoda/tryappstack-audit/commit/163b919eadcecd431531f04f54636538046da172))

# 1.0.0 (2026-03-25)


### Features

* launch tryappstack-audit — 16-module code audit + AI team REPL for JS/TS projects ([c16fd9c](https://github.com/Dushyant-Khoda/tryappstack-audit/commit/c16fd9c7416119e59bbc574e3e6fc226c87400c6))

# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- VS Code extension
- GitHub Action (marketplace listing)
- Custom audit module plugin system
- Python / Django project support
- SARIF output format for GitHub Security tab

---

## [1.0.0] - 2026-03-25

Initial public release.

---

### Static Audit (no API key required)

#### 16 audit modules

| Module | What it checks |
|--------|---------------|
| LOC Health | File sizes against framework-aware thresholds |
| Unused Packages | Dependencies not imported anywhere in the project |
| Dead Code | Unused exported components, hooks, and utilities |
| Structure | Naming conventions, barrel files, duplicates, nesting depth |
| Dependencies | Lock file, version pinning, TypeScript strict mode |
| Complexity | Hook counts, state variables, `any` types, `console.log` in production |
| Security | Hardcoded secrets, `.env` exposure, XSS patterns, `eval()` |
| Bundle | Heavy dependencies, available lighter alternatives |
| Performance | Missing `memo`/`lazy`, caching patterns, OnPush detection |
| Best Practices | Error boundaries, input validation patterns |
| Alternatives | 40+ package replacement suggestions |
| Environment | CI/CD config, Docker, README quality |
| Git Health | Branch count, commit patterns, large tracked files |
| Test Coverage | Test-to-source ratio, runner detection, untested critical files |
| Accessibility | `alt` attributes, ARIA roles, semantic HTML, skip links |
| Documentation | README completeness, JSDoc coverage, CHANGELOG, Swagger/OpenAPI |

#### Framework detection
- Auto-detects: React, Next.js (App Router + Pages Router), Angular, Vue, Nuxt, SvelteKit, NestJS, Express, Fastify, Node.js
- Monorepo detection: Turborepo, Lerna, pnpm workspaces
- Package manager detection: npm, yarn, pnpm, bun

#### Cross-platform engine
- macOS / Linux: bash engine — all 16 modules
- Windows + WSL: bash via WSL — all 16 modules
- Windows without WSL: pure JS fallback — 9 core modules
- Docker / CI: bash engine — all 16 modules

---

### Free commands

- `tas-audit` — run full audit, save scored report to `audits/`
- `tas-audit insights` — deeper scan: SQL injection patterns, missing rate limiting, empty catch blocks, hardcoded localhost URLs
- `tas-audit codedocs` — generate `PROJECT_DOCS.md` covering routes, components, exports, env vars, and dependencies
- `tas-audit context` — generate `.tas-context.md` for use with any AI chat tool (Claude.ai, ChatGPT, Gemini)
- `tas-audit legal` — static GDPR / CCPA compliance checklist
- `tas-audit init` — create `audits/` directory, config file, `.gitignore` entries
- `tas-audit hook` — install pre-push git hook with configurable score threshold
- `tas-audit fix` — auto-fix barrel exports, missing `.env.example`, `console.log` cleanup (with confirmation)
- `tas-audit doctor` — check Node version, bash availability, system dependencies
- `tas-audit trend` — plot score history from past reports in `audits/`
- `tas-audit watch` — re-audit automatically on file save
- `tas-audit compare <a> <b>` — diff two audit reports, show module-by-module changes
- `tas-audit badge` — generate Shields.io score badge for README
- `tas-audit show-template <cmd>` — preview realistic sample output for any command before running it
- `tas-audit status` — project health dashboard: AI config, hook, last audit score, memory file, `.tasrc`
- `tas-audit help [cmd]` — full command reference; pass a command name for options and examples
- `tas-audit version` — version, AI config status, Node version, platform info

#### CI/CD flags
- `--strict [N]` — exit code 1 if score < N (default 70)
- `--json` — machine-readable JSON output
- `--pre-push` — strict mode with minimal terminal output
- `--exclude <dirs>` — skip comma-separated directories
- `--include <dirs>` — audit only these directories
- `--verbose` — show every file scanned
- Per-module flags: `--loc` `--security` `--tests` `--a11y` and 12 more

---

### AI features (API key required)

#### Setup
- `tas-audit ai-setup` — arrow-key provider and model selection, masked key input
- Supported providers: Claude (Anthropic), GPT-4o (OpenAI), Grok (xAI), Gemini (Google), DeepSeek
- Key saved to `~/.tryappstack/config` (chmod 600) — never written to any project file
- Model selection per provider with recommended defaults shown

#### AI-assisted report commands
- `tas-audit bizplan` — revenue model options, competitor notes, 90-day roadmap
- `tas-audit features` — feature gap analysis, priority matrix
- `tas-audit estimate` — interactive Q&A → sprint plan, story points, risk register
- `tas-audit testplan` — unit, integration, and E2E test cases per route and component; CI config snippet
- `tas-audit brand` — ICP, positioning, GTM by channel, landing page and social copy
- `tas-audit legal` — full GDPR/CCPA checklist + ToS and Privacy Policy templates (AI-enhanced)
- `tas-audit insights` — AI priority fix list with code snippets and production checklist (AI-enhanced)
- `tas-audit codedocs` — architecture analysis, data flow, deployment guide (AI-enhanced)
- `tas-audit context` — AI executive summary + compressed context (AI-enhanced)
- `tas-audit ai-plan` — 2-week sprint plan from current audit findings
- `tas-audit ai-chat` — interactive Q&A about your codebase
- `tas-audit ai-estimate` — tech debt in hours broken down by module
- `tas-audit ai-review <file>` — deep code review with before/after suggestions
- `tas-audit --ai` — append AI insights to main audit in one run

#### `team` — interactive AI REPL
- Personas: `@dev`, `@architect`, `@security`, `@qa`, `@pm`, `@all`
- Reads project structure once — structured context (2,000–4,000 tokens typical)
- Detects code blocks in responses and offers to write files to disk
- Apply, skip, or diff each change before it is written
- Include any file in context with `@file <path>`
- Switch personas mid-session by typing `@security`, `@qa`, etc.
- Streaming responses with Ctrl+C interruption
- `--dry-run` flag — print full prompt without sending
- `--resume <name>` flag — resume a saved session at startup

#### Tab autocomplete for slash commands
- Type `/` and press Tab to see all available slash commands
- Partial completion: `/re` → Tab → `/remember`, `/retry`, `/resume`

#### Per-project config (`.tasrc`)
- JSON file in project root — safe to commit, no keys stored
- Override provider, model, and temperature per project
- Named profiles: `/use fast`, `/use careful`, `/use cheap`
- Daily and monthly budget limits
- Pinned instructions prepended to every request
- `_note` field in template reminds users keys are never stored here

#### Session memory (`tas-memory.md`)
- `/remember "fact"` — save a project fact, injected into every future session
- `/forget <text>` — remove a fact
- `/anchor "fact"` — pin a fact that survives context compression
- `/anchors` — list all anchors
- `/memory` — view full `tas-memory.md`
- File lives in project root, safe to commit, contains no credentials

#### Context window management
- Live meter: `Context: [████░░░░░░] 40%`
- Warning at 85% — prompt to compress
- Auto-summarise older messages while keeping anchors and recent history
- `/compress` — manual compression trigger

#### Session management
- `/save-session <name>` — save full conversation to `~/.tryappstack/sessions/`
- `/sessions` — list saved sessions
- `/resume <name>` — restore a session
- `/branch <name>` — fork session at current point

#### Prompt store
- `/save <name>` — save current input as a reusable prompt
- `/load <name>` — load a saved prompt
- `/prompts` — list saved prompts
- `/export <name>` — export prompts as YAML
- `/import <file>` — import a prompt pack

#### Cost tracking
- Per-message cost and token count displayed after every response
- `/cost` — session total
- `/tag <label>` — label an exchange for reporting
- `/cost-tags` — cost breakdown by label
- `/budget daily=N monthly=N` — set spend limits; warns on approach, blocks on breach
- `/benchmark` — show cost of last exchange across all supported models

#### Trust and verification
- `/confidence` — toggle AI confidence badge on responses
- `/verify` — ask AI to fact-check its last response
- `/disagree` — ask AI to argue against its last answer
- Hallucination risk flags on high-risk content categories

#### Search and bookmarks
- `/star` — bookmark the last response
- `/starred` — view bookmarks
- `/search <query>` — full-text search across all past sessions
- `/digest` — top 5 starred responses from the last 7 days

#### Routing and failover
- `/failover <provider> <key>` — add a backup provider for rate limit errors
- `/smart-route` — auto-route to cheap or powerful model based on query complexity
- Automatic retry with exponential back-off on retriable errors

#### Context injection
- `/fetch <url>` — load a URL's content into the next message
- `/image <path>` — load an image for vision-capable models
- `/pin "instruction"` — prepend an instruction to every request for the session
- `/unpin` — remove the pinned instruction

#### Bundle and export
- `/bundle` — export `tas-memory.md` + saved prompts + provider config to `tas-bundle.json`
- API keys are explicitly excluded from bundles
- Teammates can import the bundle with `/import tas-bundle.json`

---

### Security

- API keys stored exclusively in `~/.tryappstack/config` (chmod 600)
- `createTasRC()` never writes keys to `.tasrc`
- `loadTasRC()` scans for key fields on load — strips and warns immediately if found
- `exportBundle()` explicitly excludes all credential fields
- `runGitignoreGuard()` runs on every `team` session start:
  - Auto-adds `tas-bundle.json` and `.tryappstack/` to `.gitignore`
  - Scans `.tasrc` for common API key patterns (Anthropic, OpenAI, xAI, Gemini, DeepSeek)
  - Prints actionable warning with remediation steps if credentials are detected
- `/security` slash command — re-run the guard and show full storage policy
- Session logs written to OS temp directory (`/tmp/tas-audit/`) — never committed, auto-cleaned on normal exit

---

### Documentation

- `README.md` — complete rewrite: no AI buzzwords, factual descriptions, all commands listed
- `docs/guide.md` — full user guide: install, setup, all commands, workflows, troubleshooting
- `docs/without-ai.md` — every static command with realistic sample output
- `docs/with-ai.md` — every AI command, full slash command reference, sample REPL session
- `SECURITY.md` — credential storage policy and responsible disclosure
