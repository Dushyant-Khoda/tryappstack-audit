# Using tryappstack-audit without an AI key

Everything on this page works with no API key, no subscription, and no network connection. These commands run entirely on your machine using static analysis.

---

## Table of Contents

1. [Quick start](#quick-start)
2. [Main audit](#main-audit)
3. [insights — deeper scan](#insights)
4. [codedocs — project documentation](#codedocs)
5. [context — portable AI context file](#context)
6. [legal — compliance checklist](#legal)
7. [watch — live re-audit](#watch)
8. [trend — score history](#trend)
9. [compare — diff two reports](#compare)
10. [hook — pre-push gate](#hook)
11. [fix — auto-fix common issues](#fix)
12. [CI/CD integration](#cicd)
13. [Sample outputs](#sample-outputs)

---

## Quick start

```bash
cd your-project
npx tryappstack-audit
```

First run takes 5–10 seconds on most projects. Output goes to your terminal and a markdown file in `audits/`.

---

## Main audit

```bash
tas-audit
tas-audit --verbose          # show every file scanned
tas-audit --json             # machine-readable output
tas-audit --strict 75        # exit 1 if score < 75
tas-audit --exclude dist,build,coverage
tas-audit --include src,lib
```

Scans 16 modules and writes a scored report to `audits/audit-YYYY-MM-DD.md`.

**Run specific modules only:**

```bash
tas-audit --security --tests --a11y
```

All module flags: `--loc` `--unused-packages` `--dead-code` `--structure` `--bundle` `--deps` `--complexity` `--security` `--performance` `--best-practices` `--alternatives` `--env` `--git-health` `--tests` `--a11y` `--docs`

**When to run it:**

- Before a pull request — catch regressions
- After adding new dependencies — check for unused or heavy packages
- After a sprint — track score trend over time
- In CI — block merge on score drop

---

## insights

```bash
tas-audit insights
```

A deeper scan focused on issues that static type checkers and linters typically miss. Writes to `audits/insights-YYYY-MM-DD.md`.

**What it checks that `tas-audit` does not:**

- SQL injection via template literals (`` `SELECT * FROM users WHERE id = ${req.params.id}` ``)
- `dangerouslySetInnerHTML` without DOMPurify
- Express routes without authentication middleware
- API handlers with no input validation
- Async functions where errors are silently caught and discarded
- `console.log` calls containing object references that expose structure in production
- Hardcoded localhost URLs that will break in staging

**When to run it:**

Before deploying to production. Before a security review. When adding new API routes.

---

## codedocs

```bash
tas-audit codedocs
```

Generates `PROJECT_DOCS.md` in your project root. Covers:

- Project overview (name, framework, language, version)
- Folder structure with explanations
- All route definitions (Express, Next.js, Fastify, NestJS)
- All React/Vue/Angular components with props summary
- All exported utilities and their signatures
- Environment variables required
- Dependency list with versions

**When to run it:**

When onboarding a new developer. Before a handoff. When writing a technical spec. The output is plain markdown — include it in your repo or paste it into Notion/Confluence.

---

## context

```bash
tas-audit context
tas-audit context --output custom-name.md
```

Generates `.tas-context.md` — a compact, structured summary designed to be attached to any AI chat tool.

**What it contains:**

- Framework, language, Node version
- Full folder structure (summarised, not raw)
- Route list
- Component list with line counts
- All `package.json` dependencies (prod only)
- Current audit scores
- Ready-to-use prompt templates

**How to use it:**

1. Run `tas-audit context`
2. Open `.tas-context.md`
3. Copy the contents into Claude.ai, ChatGPT, or Gemini before your question
4. The AI now knows your project stack without you re-explaining it

A typical context file is 1,500–2,500 tokens. Pasting raw source files for the same purpose typically costs 30,000–80,000 tokens.

---

## legal

```bash
tas-audit legal
```

Generates a compliance checklist to `audits/legal-YYYY-MM-DD.md`. Covers:

- GDPR checklist (consent, data retention, right to deletion, DPA)
- CCPA checklist (California Consumer Privacy Act)
- Cookie consent patterns
- Privacy policy minimum requirements
- Terms of Service minimum requirements
- HTTPS and security header checklist

This is a static checklist — it does not analyse your code for compliance. Use it as a starting point. Have a qualified attorney review before publishing any legal documents.

---

## watch

```bash
tas-audit watch
tas-audit watch --exclude dist
```

Runs the full audit and re-runs it automatically whenever a file changes. Useful during active development to catch regressions immediately.

---

## trend

```bash
tas-audit trend
```

Reads all reports in `audits/` and plots a score history chart in the terminal. Useful for tracking whether quality is improving or degrading over time.

```
  Score trend for my-project

  100 |
   90 |          *
   80 |      *       *
   70 | *                 *
   60 |                       *
       Mar 1  Mar 8  Mar 15  Mar 22  Mar 25
```

---

## compare

```bash
tas-audit compare audits/audit-2026-03-01.md audits/audit-2026-03-25.md
```

Diffs two audit reports and shows what changed:

```
  Changes between Mar 1 and Mar 25

  Module            Before    After     Change
  ─────────────────────────────────────────────
  Security            72        91       +19
  Unused Packages     68        84       +16
  Dead Code           55        55         0
  Test Coverage       71        65        -6
  Overall             69        79       +10
```

---

## hook

```bash
tas-audit hook
```

Installs a pre-push git hook that runs `tas-audit --strict 60 --pre-push` before every `git push`. The push is blocked if the score is below 60.

To remove it: delete `.git/hooks/pre-push`.

To change the threshold: edit `.git/hooks/pre-push` and change the number.

---

## fix

```bash
tas-audit fix
```

Applies a small set of safe automatic fixes:

- Adds missing barrel `index.js` files in component directories
- Adds `.env.example` if `.env` exists but no example file does
- Adds `engines` field to `package.json` if missing
- Removes `console.log` entries from production-facing files (with confirmation)

Each fix is shown with a prompt before applying. Nothing is applied silently.

---

## CI/CD

**Block merge if score drops:**

```yaml
# GitHub Actions
- name: Code quality gate
  run: npx tryappstack-audit --strict 70
```

**Run specific modules in CI:**

```yaml
- name: Security check
  run: npx tryappstack-audit --security --strict 80

- name: Full audit
  run: npx tryappstack-audit --strict 65
```

**Parse score programmatically:**

```yaml
- name: Get score
  run: |
    SCORE=$(npx tryappstack-audit --json | tail -1 | jq '.score')
    echo "Score: $SCORE"
    if [ "$SCORE" -lt 70 ]; then exit 1; fi
```

**GitLab CI:**

```yaml
audit:
  script:
    - npx tryappstack-audit --strict 70 --json
  artifacts:
    paths:
      - audits/
```

---

## Sample outputs

### Main audit terminal output

```
  tryappstack-audit  v1.0.0

  Scanning project...
  Framework: Next.js  |  Files: 143  |  Language: TypeScript

  Module               Score   Status
  ─────────────────────────────────────────────────────────
  LOC Health           88      Good — 2 oversized files
  Unused Packages      72      3 deps not imported anywhere
  Dead Code            61      6 unused exports found
  Structure            85      Good
  Dependencies         90      Good — lock file present
  Complexity           78      4 components over threshold
  Security             94      Good
  Bundle               66      2 heavy deps with alternatives
  Performance          82      Good
  Best Practices       88      Good
  Alternatives         71      8 lighter alternatives available
  Environment          75      Missing .env.example
  Git Health           83      Good
  Test Coverage        59      Low — 38% test-to-source ratio
  Accessibility        91      Good
  Documentation        67      JSDoc missing on 14 exports

  Overall: 78/100  (C+)

  Report: audits/audit-2026-03-25.md
```

### Audit report (inside audits/audit-YYYY-MM-DD.md)

```markdown
# Audit Report — my-project
Generated: 2026-03-25  |  Framework: Next.js  |  Score: 78/100

## Scorecard

| Module          | Score  |
|-----------------|--------|
| LOC Health      | 88     |
| Unused Packages | 72     |
| Dead Code       | 61     |
| Security        | 94     |
| Test Coverage   | 59     |
| ...             | ...    |
| **Overall**     | **78** |

## Unused Packages
- `lodash` — no import found in 143 files
- `moment` — consider `date-fns` (5x smaller)
- `uuid` — use `crypto.randomUUID()` instead (Node built-in)

## Dead Code
- `src/components/OldModal.tsx` — exported but never imported
- `src/utils/legacyHelpers.ts` — 3 exported functions with no imports
- `src/hooks/useDeprecatedAuth.ts` — not imported anywhere

## Test Coverage
- 38% test-to-source ratio (target: 60%+)
- Untested: src/api/payments.ts, src/api/auth.ts
- No test runner detected in CI config

## Security
- Good — no hardcoded secrets found
- Good — no eval() usage
- Warning: src/api/users.ts line 47 — consider input validation
```

### insights report excerpt

```markdown
# Insights — my-project
Generated: 2026-03-25

## Critical

### SQL Injection Risk
src/api/users.ts:47
  `const result = await db.query(\`SELECT * FROM users WHERE id = ${req.params.id}\`)`
  Fix: use parameterised queries — db.query('SELECT * FROM users WHERE id = $1', [req.params.id])

### Missing Rate Limiting
src/app.ts — Express app has no rate limiting middleware
  Endpoints affected: /api/auth/login, /api/auth/register, /api/users
  Fix: npm install express-rate-limit, add to all auth routes

## Medium

### Empty catch blocks (3 found)
src/services/emailService.ts:23 — catch(e) {}
src/services/paymentService.ts:61 — catch(err) {}
src/api/webhooks.ts:14 — catch(error) {}
  These swallow errors silently. At minimum, log them.
```

### context file excerpt

```markdown
# Project Context — my-project

Framework: Next.js 14 (App Router)  
Language: TypeScript  
Node: 20.x  

## Routes (12)
GET  /api/users         src/app/api/users/route.ts
POST /api/auth/login    src/app/api/auth/login/route.ts
...

## Components (34)
UserCard     src/components/UserCard.tsx      87 lines
AuthForm     src/components/AuthForm.tsx      142 lines
...

## Dependencies
next@14.2.3, react@18.3.1, typescript@5.4.2 ...

## Audit Scores
Overall: 78/100 | Security: 94 | Tests: 59 | Dead Code: 61

## Quick prompts
Use any of these with this context:
- "Review the authentication flow and find security issues"
- "Add input validation to all API routes"
- "Write tests for the payment service"
```

---

## What the free tier does not do

- It does not write or modify any of your files (except generating reports to `audits/`)
- It does not make network requests
- It does not read your environment variable values
- It does not suggest fixes inline — it lists issues and you fix them

For AI-assisted fixing, code generation, and analysis, see [with-ai.md](./with-ai.md).
