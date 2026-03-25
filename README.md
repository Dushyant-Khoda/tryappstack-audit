<div align="center">

<img src="https://res.cloudinary.com/dsidb5jqw/image/upload/v1772630287/App_logo_light_upvroj.png" width="200" />

# tryappstack-audit

### Code audit + AI assistant for JS/TS projects — runs in your terminal, no IDE required

[![npm version](https://img.shields.io/npm/v/tryappstack-audit)](https://www.npmjs.com/package/tryappstack-audit)
[![downloads](https://img.shields.io/npm/dm/tryappstack-audit)](https://www.npmjs.com/package/tryappstack-audit)
[![license](https://img.shields.io/npm/l/tryappstack-audit)](https://www.npmjs.com/package/tryappstack-audit)

**[Website](https://tryappstack.vercel.app/)** · **[npm](https://www.npmjs.com/package/tryappstack-audit)** · **[GitHub](https://github.com/Dushyant-Khoda/tryappstack-audit)**

</div>

---

## What it does

`tryappstack-audit` is a terminal CLI for JS/TS projects with two distinct parts:

**Part 1 — Static audit (no AI key required)**
Scans your project across 16 modules and produces a scored report. Finds things that linters and TypeScript don't check: unused packages, dead components, missing error handling, security patterns, test coverage gaps, accessibility issues. Saves reports to `audits/` so you can track changes over time.

**Part 2 — AI assistant (your own API key)**
Connects to Claude, GPT-4o, Grok, Gemini, or DeepSeek using your key. Reads the structured audit output rather than raw source files, so token usage stays low. Runs as a REPL where you talk to AI personas (@dev, @architect, @security, @qa, @pm) that write code directly to your files.

```bash
# No key needed
npx tryappstack-audit          # scan and score
npx tryappstack-audit insights # hidden issues report
npx tryappstack-audit codedocs # generate project documentation
npx tryappstack-audit context  # create .tas-context.md for any AI chat

# Add your key once, then
npx tryappstack-audit team     # interactive REPL — AI writes code to disk
npx tryappstack-audit bizplan  # business analysis from your codebase
npx tryappstack-audit testplan # test case generation
npx tryappstack-audit brand    # marketing copy and GTM notes
npx tryappstack-audit legal    # GDPR/CCPA checklist + ToS template
```

Part of the **TryAppStack** ecosystem:
- **[tryappstack](https://www.npmjs.com/package/tryappstack)** — production-ready boilerplates
- **[tryappstack-audit](https://www.npmjs.com/package/tryappstack-audit)** — this package

---

## Free vs AI-assisted

```
Free (no key)                    With your AI key
────────────────────────────     ────────────────────────────────────
✓ 16-module audit + scores       ✓ Everything in the free tier
✓ insights — hidden issues       ✓ AI priority list + production fixes
✓ codedocs — project docs        ✓ Architecture analysis in codedocs
✓ context — .tas-context.md      ✓ Executive summary in context output
✓ legal — static checklist       ✓ Full GDPR/CCPA + ToS template
✓ Pre-push git gate              ✓ bizplan — revenue + roadmap analysis
✓ Score trend + watch mode       ✓ features — feature gap analysis
Free forever                     ✓ estimate — sprint plan + story points
                                 ✓ testplan — test cases per route
                                 ✓ brand — channel strategy + copy
                                 ✓ team — REPL that writes code to files
                                 ~$0.01/run, your key, your data
```

Supported providers: Claude · GPT-4o · Grok · Gemini · DeepSeek

> Your source code values and env var contents never leave your machine. Only structured metadata (route paths, component names, dependency names, issue categories) is sent to the AI.

---

## Commands

### Free (no AI key)

| Command | What it does | Output |
|---------|-------------|--------|
| `tas-audit` | Score 16 modules | `audits/*.md` |
| `tas-audit insights` | Find hidden security and arch issues | `audits/insights-*.md` |
| `tas-audit codedocs` | Generate project documentation | `PROJECT_DOCS.md` |
| `tas-audit context` | Build portable AI context file | `.tas-context.md` |
| `tas-audit legal` | Static compliance checklist | `audits/legal-*.md` |
| `tas-audit init` | Create config, hooks, audits dir | — |
| `tas-audit hook` | Install pre-push git gate | — |
| `tas-audit fix` | Auto-fix barrel exports and configs | — |
| `tas-audit doctor` | Check system dependencies | — |
| `tas-audit trend` | Plot score history | — |
| `tas-audit watch` | Re-audit on file save | — |
| `tas-audit badge` | Generate Shields.io badge | — |
| `tas-audit compare a.md b.md` | Diff two audit reports | — |

### With AI key

Run `tas-audit ai-setup` once to save your provider and key to `~/.tryappstack/config`.

| Command | What it does |
|---------|-------------|
| `tas-audit team` | Interactive REPL — AI writes code to your files |
| `tas-audit bizplan` | Revenue analysis, market position, 90-day roadmap |
| `tas-audit features` | Feature gaps, competitor notes, priority list |
| `tas-audit estimate` | Sprint plan, story points, cost range, risk register |
| `tas-audit testplan` | Test cases per route/component, E2E scenarios, CI config |
| `tas-audit brand` | ICP, positioning, GTM notes, copy by channel |
| `tas-audit legal` | GDPR/CCPA checklist, ToS clauses, Privacy Policy draft |
| `tas-audit insights` | Priority fixes, production checklist (AI-enhanced) |
| `tas-audit codedocs` | Architecture analysis, data flow, deployment guide |
| `tas-audit context` | Compressed context with AI executive summary |
| `tas-audit ai-plan` | 2-week sprint plan from audit findings |
| `tas-audit ai-chat` | Ask questions about your codebase |
| `tas-audit ai-estimate` | Tech debt in hours by module |
| `tas-audit ai-review <file>` | Deep review with before/after code |
| `tas-audit --ai` | Append AI insights to main audit |

---

## `team` — the interactive REPL

`tas-audit team` is the main AI command. It scans your project once, builds a structured context, and opens a REPL where you pick an AI persona.

```bash
tas-audit team
```

**Personas:**
- `@dev` — writes production code, creates and modifies files
- `@architect` — reviews structure, patterns, trade-offs
- `@security` — finds vulnerabilities, writes patches
- `@qa` — writes test cases and E2E scenarios
- `@pm` — defines requirements and acceptance criteria
- `@all` — routes your question across all roles

**Example:**

```
@dev > create a rate limiting middleware for Express

  @dev  (Senior Developer)

  Code Changes Detected  (1 file)

  CREATE  src/middleware/rateLimit.ts
  + import rateLimit from 'express-rate-limit';
  + export const apiLimiter = rateLimit({
  +   windowMs: 15 * 60 * 1000,
  +   max: 100,
  + });

  Apply these changes? (y/n/skip) y
  ✓ Created: src/middleware/rateLimit.ts
```

**Why the token count is lower than sending raw files:**
The scanner builds a structured summary of your project — routes, components, dependencies, issue categories, file shapes. That summary is what goes to the AI, not the raw source. A typical project context is 2,000–4,000 tokens rather than 50,000+.

**Tab autocomplete for slash commands:** type `/` and press Tab to see all commands. Type `/re` and press Tab to complete to `/remember`, `/retry`, or `/resume`.

**Slash commands available inside the REPL:**

```
/help              full command reference
/context           show what context the AI is working from
/remember "fact"   save a fact to tas-memory.md (persists across sessions)
/memory            show tas-memory.md
/star              bookmark the last response
/search <query>    search past responses
/verify            fact-check the last response with the same model
/disagree          ask the AI to argue against its last answer
/confidence        toggle confidence badge on responses
/tag <label>       label this exchange for cost tracking
/cost              show session cost so far
/save-session <n>  save session to disk
/resume <name>     resume a saved session
/dry-run           preview the prompt without sending
/security          show where TAS stores data and check for exposed keys
/init-config       create .tasrc in the project root
/help              full list
```

---

## Setup

```bash
# Install globally (optional — npx works too)
npm install -g tryappstack-audit

# Preview what any command's output looks like before running it
tas-audit show-template audit
tas-audit show-template team
tas-audit show-template bizplan

# Run static audit
tas-audit

# Set up AI (one time)
tas-audit ai-setup
# Choose: Claude / OpenAI / Grok / Gemini / DeepSeek
# Enter your API key
# Key saved to ~/.tryappstack/config (chmod 600, not in any project file)

# Start the team REPL
tas-audit team
```

### Model selection

At `ai-setup` you choose both provider and model. Pick based on what you need:

| Provider | General use | More careful reasoning | Fastest |
|----------|------------|----------------------|---------|
| Claude | `claude-sonnet-4` | `claude-opus-4` | `claude-haiku-4` |
| OpenAI | `gpt-4o` | `o1-preview` | `gpt-4o-mini` |
| Grok | `grok-3` | `grok-3` | `grok-3-mini` |
| Gemini | `gemini-2.0-flash` | `gemini-1.5-pro` | `gemini-1.5-flash` |
| DeepSeek | `deepseek-chat` | `deepseek-reasoner` | `deepseek-chat` |

Switch at any time: `tas-audit ai-setup` again.

### Per-project config (`.tasrc`)

To override model or temperature for one project:

```bash
# Inside the team REPL
/init-config
```

This creates `.tasrc` in your project root. Edit it:

```json
{
  "provider": "claude",
  "model": "claude-opus-4-20250514",
  "temperature": 0.2,
  "budget": { "daily": 1.00, "monthly": 15.00 },
  "profiles": {
    "fast": { "provider": "gemini", "model": "gemini-2.0-flash" },
    "careful": { "provider": "claude", "model": "claude-opus-4-20250514" }
  }
}
```

API keys are never written to `.tasrc`. Switch profiles inside the REPL with `/use fast`.

---

## `context` command

```bash
tas-audit context
```

Generates `.tas-context.md` — a structured summary of your codebase including stack, routes, components, dependencies, and current audit scores. Attach it to any AI chat tool (Claude.ai, ChatGPT, Gemini) to get answers about your project without pasting raw files.

The file includes ready-to-use prompt templates for common tasks:
- Debug and fix critical issues
- Add a new feature (stack-aware)
- Audit the auth or payment flow
- Write tests for critical paths
- Refactor for production
- Generate API documentation

---

## What `insights` checks

Things static analysis tools typically miss, common in code written quickly or with AI assistance:

| Category | Checks |
|----------|--------|
| Security | Hardcoded secrets, SQL injection via template literals, `dangerouslySetInnerHTML` without sanitisation, `eval()` |
| API patterns | Express without `helmet`, no rate limiting, no input validation, no CORS config |
| Error handling | Empty `catch {}` blocks, async functions without `try/catch`, swallowed promise rejections |
| Components | Files over 300 lines, `fetch` calls directly in components, missing memoisation |
| Architecture | No service layer, hardcoded `localhost` URLs, missing `.env.example` |
| TypeScript | Widespread `any` usage |

---

## A note on AI output

All AI-generated output in this tool — estimates, plans, legal templates, business analysis — should be reviewed before use.

- **Estimates**: AI doesn't know your team's context. Add buffer.
- **Legal**: Review with a qualified attorney before publishing.
- **Business plans**: Validate assumptions with real data.
- **Test cases**: Check correctness before adding to CI.

---

## CLI options

```
--ai                    Append AI insights to audit
--ai-provider <p>       claude | openai | grok | gemini | deepseek
--strict [N]            Exit 1 if score < N (useful in CI)
--json                  JSON output
--pre-push              Strict + minimal output
--exclude <dirs>        Skip directories
--include <dirs>        Audit only these directories
--verbose               Show all files
```

## Run individual modules

```bash
npx tryappstack-audit --loc --security --tests --a11y
```

Available flags: `--loc` `--unused-packages` `--dead-code` `--structure` `--bundle` `--deps` `--complexity` `--security` `--performance` `--best-practices` `--alternatives` `--env` `--git-health` `--tests` `--a11y` `--docs`

---

## 16 audit modules

| Module | What it checks |
|--------|---------------|
| LOC Health | File sizes against framework-aware thresholds |
| Unused Packages | Dependencies that are not imported anywhere |
| Dead Code | Unused components, hooks, and utilities |
| Structure | Naming conventions, barrel files, duplicates, nesting depth |
| Dependencies | Lock file presence, version pinning, TypeScript strict mode |
| Complexity | Hook counts, state, `any` types, `console.log` in production |
| Security | Hardcoded secrets, `.env` exposure, XSS patterns, `eval` |
| Bundle | Heavy dependencies, available lighter alternatives |
| Performance | Missing `memo`/`lazy`, caching patterns, OnPush detection |
| Best Practices | Error boundaries, input validation patterns |
| Alternatives | 40+ package replacement suggestions |
| Environment | CI/CD config, Docker presence, README quality |
| Git Health | Branch count, commit patterns, large tracked files |
| Test Coverage | Test-to-source ratio, test runner detection, untested critical files |
| Accessibility | `alt` attributes, ARIA roles, semantic HTML, skip links |
| Documentation | README completeness, JSDoc coverage, CHANGELOG, Swagger/OpenAPI |

---

## CI/CD

```yaml
# Fail the pipeline if score drops below 70
- run: npx tryappstack-audit --strict 70

# Parse score from JSON output
- run: npx tryappstack-audit --json | tail -1 | jq '.score'
```

---

## Platform support

| Platform | Mode |
|----------|------|
| macOS / Linux | Bash (all 16 modules) |
| Windows + WSL | Bash via WSL (all 16 modules) |
| Windows without WSL | JS engine (9 modules) |
| Docker / CI | Bash (all 16 modules) |

---

## Package size

| | |
|-|-|
| Package | 30 KB |
| Dependencies | 5 |
| Audit modules | 16 |
| AI providers | 5 |
| Commands | 15+ |
| Supported frameworks | 10+ |

---

## Links

- [Website](https://tryappstack.vercel.app/)
- [Changelog](CHANGELOG.md)
- [npm](https://www.npmjs.com/package/tryappstack-audit)
- [GitHub](https://github.com/Dushyant-Khoda/tryappstack-audit)
- [tryappstack boilerplates](https://www.npmjs.com/package/tryappstack)
- [User Guide](docs/guide.md)
- [Using without AI](docs/without-ai.md)
- [Using with AI](docs/with-ai.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add audit modules, submit fixes, or improve commands.

## License

MIT — [Dushyant Khoda](https://github.com/Dushyant-Khoda)

---

<div align="center">

[Star on GitHub](https://github.com/Dushyant-Khoda/tryappstack-audit) · [Report a bug](https://github.com/Dushyant-Khoda/tryappstack-audit/issues) · [Request a feature](https://github.com/Dushyant-Khoda/tryappstack-audit/issues)

</div>
