# tryappstack-audit — User Guide

This guide covers everything from first install to daily use. Read it start to finish the first time, then use it as a reference.

---

## Table of Contents

1. [Installation](#installation)
2. [First run — no AI key needed](#first-run)
3. [Understanding the audit report](#understanding-the-report)
4. [Setting up AI](#setting-up-ai)
5. [The team REPL](#the-team-repl)
6. [Memory and context across sessions](#memory-and-context)
7. [Session management](#session-management)
8. [Cost tracking](#cost-tracking)
9. [Per-project config (.tasrc)](#per-project-config)
10. [The context command](#the-context-command)
11. [CI/CD integration](#cicd-integration)
12. [All commands reference](#all-commands-reference)
13. [Security and credential storage](#security)
14. [Troubleshooting](#troubleshooting)

---

## Installation

```bash
# Run without installing (recommended for first try)
npx tryappstack-audit

# Or install globally (optional — npx works too)
npm install -g tryappstack-audit

# Preview sample output for any command before running it
tas-audit show-template              # list all templates
tas-audit show-template audit        # see what the audit output looks like
tas-audit show-template team         # see what the REPL looks like
tas-audit show-template bizplan      # see a sample business plan report

# Run static audit
tas-audit
tryappstack-audit
```

Requirements: Node.js 16+. Bash recommended for full 16-module support (macOS, Linux, WSL on Windows). Windows without WSL runs 9 modules via the JS engine.

---

## First run

Run this inside any JS or TS project:

```bash
tas-audit
```

No AI key needed. It scans your project across 16 modules and writes a scored report to `audits/`.

What you see in the terminal:

```
  tryappstack-audit  v1.0.0

  Scanning project...
  Framework: Next.js  |  Files: 143  |  Language: TypeScript

  Score   Module              Status
  ────────────────────────────────────────
  88/100  LOC Health          Good
  72/100  Unused Packages     2 unused deps found
  61/100  Dead Code           4 unused components
  95/100  Security            Good
  ...

  Overall: 79/100

  Report saved: audits/audit-2026-03-25.md
```

Run it again after making changes — scores are saved to `audits/` so you can compare over time.

**Other no-key commands worth running first:**

```bash
tas-audit insights        # deeper scan — security patterns, arch issues
tas-audit codedocs        # generate PROJECT_DOCS.md
tas-audit context         # build .tas-context.md (useful for any AI chat)
```

---

## Understanding the report

The report scores 16 modules from 0–100. Each module covers a specific area:

| Score range | Meaning |
|-------------|---------|
| 90–100 | No significant issues |
| 70–89 | Minor issues, low priority |
| 50–69 | Issues worth fixing in the next sprint |
| Below 50 | Should be addressed before shipping |

The overall score is a weighted average. Security and best practices have higher weight than alternatives or documentation.

Each module lists specific files and line numbers where issues were found. The report is plain markdown — open it in any editor.

**Module quick reference:**

- **LOC Health** — flags files that are too large. Thresholds vary by framework (a 400-line Next.js page component is different from a 400-line utility).
- **Unused Packages** — compares `package.json` against actual import statements. Does not catch dynamic requires.
- **Dead Code** — finds exported functions, components, and hooks with no detected import anywhere in the project.
- **Structure** — checks naming conventions, barrel file consistency, duplicate file names, folder nesting depth.
- **Dependencies** — checks for a lock file, version pinning, TypeScript strict mode in `tsconfig.json`.
- **Complexity** — counts `useEffect` hooks per component, state variables, `any` types, `console.log` left in production code.
- **Security** — looks for hardcoded secrets, `.env` file exposure, `dangerouslySetInnerHTML` without sanitisation, `eval()`, SQL injection via template literals.
- **Bundle** — flags heavy dependencies and lists lighter alternatives for each.
- **Performance** — checks for missing `React.memo`, `lazy`, `Suspense`, Angular OnPush, caching headers.
- **Best Practices** — error boundaries, form validation, input sanitisation patterns.
- **Alternatives** — suggests replacing 40+ packages with lighter or more maintained options.
- **Environment** — CI/CD config presence, Dockerfile, `.env.example`, README quality.
- **Git Health** — stale branches, infrequent commits, large files tracked in git.
- **Test Coverage** — ratio of test files to source files, test runner detection, checks for untested route handlers and critical utilities.
- **Accessibility** — `alt` attributes on images, ARIA roles, semantic HTML elements, skip links.
- **Documentation** — README completeness, JSDoc on exported functions, CHANGELOG presence, Swagger/OpenAPI spec.

---

## Setting up AI

```bash
tas-audit ai-setup
```

You will be prompted to:
1. Choose a provider — Claude, OpenAI, Grok, Gemini, or DeepSeek
2. Choose a model from the list
3. Paste your API key

The key is saved to `~/.tryappstack/config` with `chmod 600`. It is never written to your project directory.

**Which provider to pick:**

If you have access to Claude, use `claude-sonnet-4` — it writes clean, idiomatic code and follows project context well. For cost-sensitive usage, `deepseek-chat` gives good results at a fraction of the price. For fast iteration, `gemini-2.0-flash` or `gpt-4o-mini` work well.

You can change provider and model at any time by running `ai-setup` again.

**Using environment variables instead:**

If you prefer not to use `ai-setup`, set one of these before running any AI command:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export XAI_API_KEY=xai-...
export GEMINI_API_KEY=AIza...
export DEEPSEEK_API_KEY=sk-...
```

Pass the provider explicitly:

```bash
tas-audit team --ai-provider claude
```

---

## The team REPL

```bash
tas-audit team
```

This is the main AI command. It:
1. Scans your project and builds a structured context (2,000–4,000 tokens typically)
2. Asks you to pick a team member
3. Opens a REPL where that AI persona reads your project structure and responds

**Picking a team member:**

```
  1.  @dev        Senior Developer
  2.  @architect  System Architect
  3.  @security   Security Expert
  4.  @qa         QA Lead
  5.  @pm         Product Manager

  Choose (1-5 or @name):
```

You can switch personas mid-session by typing `@security` or `@qa` as your input.

**Writing a good prompt:**

Be specific about what you want. The AI has your project context — it knows your stack, your folder structure, your dependencies. You do not need to re-explain these things.

Good:
```
create a rate limiting middleware for the Express API, 
100 requests per 15 minutes, return 429 with a Retry-After header
```

Less useful:
```
help me with rate limiting
```

**When the AI suggests code changes:**

The REPL detects code blocks in responses that contain file paths. When it finds them:

```
  Code Changes Detected  (2 files)

  CREATE  src/middleware/rateLimit.ts
  MODIFY  src/app.ts

  Apply these changes? (y/n/skip/diff)
```

- `y` — write the files to disk
- `n` — skip all
- `skip` — move on without applying
- `diff` — show a line diff before deciding

The AI will only write to paths it specifies. It does not read or overwrite files silently.

**Including a file in context:**

```
@file src/controllers/auth.ts
```

This loads the file contents into the next message. Useful when you want the AI to see specific implementation details.

**Pinning an instruction:**

```
/pin "Always use the repository pattern. No direct DB calls in controllers."
```

This instruction is prepended to every message for the rest of the session.

---

## Memory and context across sessions

### Project memory (tas-memory.md)

The biggest problem with AI coding assistants is that they forget things between sessions. You tell them your database is PostgreSQL, your auth uses JWT, your API prefix is `/v2` — and next session you have to tell them again.

`tas-memory.md` solves this. It lives in your project root and is automatically injected into every AI session.

```bash
# Inside the team REPL
/remember "We use PostgreSQL 15, not MySQL"
/remember "Auth uses JWT with 24h expiry, stored in httpOnly cookies"
/remember "API prefix is /v2, all endpoints return { data, error, meta }"
```

Each fact is appended to `tas-memory.md` with a date stamp. On the next session, the AI reads it first.

View what is stored:
```
/memory
```

Remove a fact:
```
/forget "not MySQL"
```

`tas-memory.md` is a plain markdown file. You can edit it directly in any editor. Commit it to git — it is safe (no credentials, just project facts).

### Context window meter

When you are in a long session, the REPL shows a meter:

```
  Context: [████████░░] 78%  (78k/100k tok)
```

At 85%, it asks if you want to compress. Compression summarises older messages while keeping the recent ones and any `/anchor` facts intact.

### Anchoring important facts

If there is something the AI must always remember even after compression:

```
/anchor "We never use class components. All React code uses hooks."
```

Anchors survive context compression. View them with `/anchors`.

---

## Session management

Save the current conversation to disk:

```bash
/save-session auth-refactor
```

List saved sessions:

```bash
/sessions
```

Resume a session by name:

```bash
tas-audit team --resume auth-refactor
# or inside the REPL:
/resume auth-refactor
```

Fork a session at the current point to try a different approach:

```bash
/branch auth-refactor-v2
```

The branch starts from the current message history. Changes in the branch do not affect the original.

---

## Cost tracking

The REPL shows cost after each response:

```
  @dev  (Senior Developer)  ·  $0.0034  ·  1,240 tok
```

**Session total:**

```
/cost
```

**Tag exchanges for reporting:**

```
/tag auth-refactor
```

After the `/tag` command, the next exchange is labelled. Run `/cost-tags` to see a breakdown by label at the end of a session.

**Budget limits:**

Set in `.tasrc`:

```json
{
  "budget": { "daily": 1.00, "monthly": 20.00 }
}
```

When you approach the limit, the REPL warns you. When you hit it, it blocks sending until the next day or month.

**Model comparison:**

```
/benchmark
```

Shows the cost of your last exchange across all supported models so you can see if switching would save money.

---

## Per-project config

`.tasrc` is a JSON file in your project root that overrides your global AI setup for that project. It is safe to commit to git because it never contains API keys.

Create it inside the REPL:

```
/init-config
```

Or create it manually:

```json
{
  "_note": "API keys are NOT stored here. Use env vars or 'tas-audit ai-setup'.",
  "provider": "claude",
  "model": "claude-sonnet-4-20250514",
  "temperature": 0.2,
  "pinned": "You are working on a fintech API. Be conservative with error handling.",
  "budget": { "daily": 2.00, "monthly": 30.00 },
  "profiles": {
    "fast": { "provider": "gemini", "model": "gemini-2.0-flash" },
    "careful": { "provider": "claude", "model": "claude-opus-4-20250514" },
    "cheap": { "provider": "deepseek", "model": "deepseek-chat" }
  }
}
```

Switch profiles inside the REPL:

```
/use fast
/use careful
```

**Priority order for config:**

CLI flags override `.tasrc` which overrides `~/.tryappstack/config` which falls back to env vars.

---

## The context command

```bash
tas-audit context
```

Generates `.tas-context.md` — a compact, structured summary of your codebase. Use it with any AI tool outside of this CLI.

**What it contains:**
- Project name, framework, language
- Folder structure summary
- Route list (Express, Next.js, etc.)
- Component list with line counts
- Dependency list (prod only)
- Current audit scores
- Ready-to-use prompt templates

**How to use it with Claude.ai, ChatGPT, or Gemini:**

1. Run `tas-audit context`
2. Open `.tas-context.md`
3. Copy the contents and paste into the AI chat before your question
4. The AI now knows your stack without you explaining it

The context file is typically 1,500–3,000 tokens — much less than pasting raw source files.

---

## CI/CD integration

**Block merge if score drops below a threshold:**

```yaml
# GitHub Actions
- name: Audit
  run: npx tryappstack-audit --strict 70
```

Exit code is 1 if score is below the threshold. Add `--json` for machine-readable output.

**Parse score in pipeline:**

```yaml
- name: Get audit score
  run: |
    SCORE=$(npx tryappstack-audit --json | tail -1 | jq '.score')
    echo "Audit score: $SCORE"
```

**Pre-push git hook:**

```bash
tas-audit hook
```

Installs a pre-push hook that runs `tas-audit --strict 60 --pre-push`. The push is blocked if the score is below 60. Remove it by deleting `.git/hooks/pre-push`.

**Run specific modules only in CI:**

```yaml
- run: npx tryappstack-audit --security --tests --strict 80
```

---

## All commands reference

### Audit commands

| Command | Description |
|---------|-------------|
| `tas-audit` | Run full 16-module audit |
| `tas-audit --ai` | Run audit and append AI insights |
| `tas-audit --strict 70` | Exit 1 if score < 70 |
| `tas-audit --json` | JSON output |
| `tas-audit --verbose` | Show all files scanned |
| `tas-audit --exclude node_modules,dist` | Skip directories |
| `tas-audit compare a.md b.md` | Diff two audit reports |
| `tas-audit trend` | Show score history chart |
| `tas-audit watch` | Re-audit on file save |

### Setup commands

| Command | Description |
|---------|-------------|
| `tas-audit init` | Create audits dir, config, .gitignore entries |
| `tas-audit ai-setup` | Save AI provider + key |
| `tas-audit hook` | Install pre-push git hook |
| `tas-audit doctor` | Check system dependencies |
| `tas-audit badge` | Generate Shields.io badge |

### Report commands (free)

| Command | Description |
|---------|-------------|
| `tas-audit insights` | Hidden issues report |
| `tas-audit codedocs` | Project documentation |
| `tas-audit context` | Portable AI context file |
| `tas-audit legal` | Static compliance checklist |

### AI commands (key required)

| Command | Description |
|---------|-------------|
| `tas-audit team` | Interactive REPL |
| `tas-audit bizplan` | Business and revenue analysis |
| `tas-audit features` | Feature gap analysis |
| `tas-audit estimate` | Sprint plan and story points |
| `tas-audit testplan` | Test case generation |
| `tas-audit brand` | Marketing copy and GTM notes |
| `tas-audit legal` | Full compliance + ToS template |
| `tas-audit ai-plan` | Sprint fix plan from audit |
| `tas-audit ai-chat` | Ask anything about your codebase |
| `tas-audit ai-estimate` | Tech debt in hours |
| `tas-audit ai-review <file>` | Deep code review |

### team REPL slash commands

| Command | Description |
|---------|-------------|
| `/help` | Full slash command list |
| `/context` | Show project context sent to AI |
| `/clear` | Clear conversation history |
| `/members` | List available team members |
| **Memory** | |
| `/remember "fact"` | Save to tas-memory.md |
| `/memory` | Show tas-memory.md |
| `/forget <text>` | Remove a fact |
| `/anchor "fact"` | Pin fact that survives compression |
| `/anchors` | List anchors |
| `/compress` | Compress older messages manually |
| **Trust** | |
| `/confidence` | Toggle confidence badge |
| `/verify` | Fact-check last response |
| `/disagree` | Ask AI to argue against its answer |
| **Search** | |
| `/star` | Bookmark last response |
| `/starred` | Show bookmarks |
| `/search <query>` | Search past responses |
| `/digest` | Top 5 starred from last 7 days |
| **Cost** | |
| `/cost` | Session cost so far |
| `/tag <label>` | Label next exchange |
| `/cost-tags` | Cost breakdown by label |
| `/budget daily=1 monthly=20` | Set budget limits |
| `/benchmark` | Cost comparison across models |
| **Injection** | |
| `/fetch <url>` | Load URL content into context |
| `/image <path>` | Load image for vision models |
| `/pin "instruction"` | Prepend to every request |
| `/unpin` | Remove pinned instruction |
| **Prompts and sessions** | |
| `/save <name>` | Save current input as reusable prompt |
| `/load <name>` | Load a saved prompt |
| `/prompts` | List saved prompts |
| `/export <name>` | Export prompts as YAML |
| `/bundle` | Export memory + prompts + config (no keys) |
| `/save-session <name>` | Save session to disk |
| `/sessions` | List saved sessions |
| `/resume <name>` | Resume a session |
| `/branch <name>` | Fork session at current point |
| **Control** | |
| `/retry` | Retry last prompt |
| `/retry --temp=0.9` | Retry with different temperature |
| `/dry-run` | Preview prompt without sending |
| `/use <profile>` | Switch to a .tasrc profile |
| `/config` | Show active config |
| `/init-config` | Create .tasrc in project |
| `/security` | Check for exposed credentials |
| `/smart-route` | Route cheap vs careful by complexity |
| `/failover <provider> <key>` | Add fallback provider |

---

## Security

**Where credentials are stored:**

| What | Location | In git? |
|------|----------|---------|
| API key | `~/.tryappstack/config` | No — home directory |
| `.tasrc` | Project root | Yes — no keys stored here |
| `tas-memory.md` | Project root | Yes — facts only |
| `tas-bundle.json` | Project root | No — auto-added to .gitignore |
| Session logs | `/tmp/tas-audit/` | No — OS temp dir |
| Sessions, prompts | `~/.tryappstack/` | No — home directory |

**The tool auto-adds `tas-bundle.json` to your `.gitignore`** when you first run `tas-audit team` in a git repository. You will see a line like:

```
  .gitignore: Auto-added: tas-bundle.json
```

**If you accidentally put a key in `.tasrc`:**

The tool detects this at startup and prints a warning. The key is stripped from the loaded config — it is not used. Remove the key from `.tasrc` and use `tas-audit ai-setup` or an environment variable instead.

Check the current security status at any time:

```
/security
```

---

## Troubleshooting

**`command not found: tas-audit`**

```bash
npm install -g tryappstack-audit
# or use npx:
npx tryappstack-audit
```

**`AI key required` error**

Run `tas-audit ai-setup` or set the environment variable for your provider:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Only 9 modules running instead of 16 (Windows)**

Install WSL and run from a WSL terminal. The remaining 7 modules use bash scripts.

**Score seems wrong after fixing issues**

Delete the `audits/` folder and re-run. Old reports are not overwritten unless you use `--force`.

**The AI wrote code but it has a bug**

This happens. Use `/retry` to try again, or use `/retry --temp=0.2` for more conservative output. The `/verify` command asks the AI to check its own last response. Always review generated code before running it.

**Rate limit errors**

Add a fallback provider inside the REPL:
```
/failover deepseek sk-your-key deepseek-chat
```

When the primary provider hits a rate limit, the next request goes to the fallback automatically.

**Session log location**

Verbose logs go to `/tmp/tas-audit/session-*.log`. On normal exit they are deleted. If there was an error, the log is kept so you can read the full trace. The path is printed in the terminal when an error occurs.

**`.tasrc` parse error**

Check for trailing commas or comments — `.tasrc` is strict JSON. Use a JSON validator.

---

## Common workflows

### Starting a new project

```bash
cd my-project
tas-audit init           # set up audits dir and hooks
tas-audit                # baseline score
tas-audit context        # build context file
tas-audit team           # open REPL with project context loaded
```

### Before a code review

```bash
tas-audit --strict 75    # fail if score dropped since last run
tas-audit insights       # check for new security or arch issues
```

### Sharing project context with a teammate

```bash
# Inside the team REPL
/bundle
```

Send `tas-bundle.json` to your teammate. They can import it:

```
/import tas-bundle.json
```

This restores your `tas-memory.md` facts and saved prompts. Provider config is shared but API keys are not included.

### Switching models mid-session

```bash
# Add profiles to .tasrc first, then inside the REPL:
/use fast      # switches to gemini-2.0-flash
/use careful   # switches to claude-opus-4
```

### Debugging an AI response you don't trust

```
/confidence     # ask AI to rate its own confidence
/verify         # run a second pass to fact-check
/disagree       # ask AI to find problems with its own answer
```

---

## Further reading

- [README](../README.md) — overview and quick start
- [Using without AI](./without-ai.md) — all static commands with sample outputs
- [Using with AI](./with-ai.md) — all AI commands, slash commands, sample outputs
- [CHANGELOG](../CHANGELOG.md) — version history
- [CONTRIBUTING](../CONTRIBUTING.md) — how to add modules or fix issues
- [SECURITY](../SECURITY.md) — responsible disclosure
