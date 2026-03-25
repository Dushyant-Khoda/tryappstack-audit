/**
 * show-template — preview sample output for any command before running it
 *
 * Usage:
 *   tas-audit show-template             list available templates
 *   tas-audit show-template audit       show sample audit output
 *   tas-audit show-template insights    show sample insights output
 *   tas-audit show-template team        show sample team REPL session
 *   tas-audit show-template bizplan     show sample bizplan report
 *   ... etc
 */

const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");
const DIM   = chalk.dim;
const BOLD  = chalk.bold;

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = {

    audit: {
        title: "tas-audit",
        description: "16-module code quality scan with scores",
        output: `
  tryappstack-audit  v1.0.0

  Scanning project...
  Framework: Next.js  |  Files: 143  |  Language: TypeScript

  Module               Score
  ──────────────────────────────────────────────────────────────
  LOC Health           ${chalk.green("88")}   Good — 2 oversized files flagged
  Unused Packages      ${chalk.yellow("72")}   3 deps not imported anywhere
  Dead Code            ${chalk.yellow("61")}   6 unused exports found
  Structure            ${chalk.green("85")}   Good
  Dependencies         ${chalk.green("90")}   Lock file present, TS strict on
  Complexity           ${chalk.yellow("78")}   4 components over threshold
  Security             ${chalk.green("94")}   Good
  Bundle               ${chalk.yellow("66")}   2 heavy deps with lighter alternatives
  Performance          ${chalk.green("82")}   Good
  Best Practices       ${chalk.green("88")}   Good
  Alternatives         ${chalk.yellow("71")}   8 substitutions available
  Environment          ${chalk.yellow("75")}   Missing .env.example
  Git Health           ${chalk.green("83")}   Good
  Test Coverage        ${chalk.red("59")}   Low — 38% test-to-source ratio
  Accessibility        ${chalk.green("91")}   Good
  Documentation        ${chalk.yellow("67")}   JSDoc missing on 14 exports

  Overall: ${chalk.green.bold("78/100")}

  Report: audits/audit-2026-03-25.md
`,
    },

    insights: {
        title: "tas-audit insights",
        description: "Deeper scan — security patterns, arch issues, error handling",
        output: `
  Scanning for hidden issues...

  ${chalk.red.bold("Critical  (2)")}

  SQL Injection Risk
  src/api/users.ts:47
    \`SELECT * FROM users WHERE id = \${req.params.id}\`
    Fix: use parameterised queries

  Missing Rate Limiting
  src/app.ts — Express app has no rate limiting middleware
    Affected routes: /api/auth/login, /api/auth/register
    Fix: add express-rate-limit to all auth routes

  ${chalk.yellow.bold("Medium  (3)")}

  Empty catch blocks (3 found)
  src/services/emailService.ts:23
  src/services/paymentService.ts:61
  src/api/webhooks.ts:14
    These swallow errors silently.

  ${chalk.dim("Low  (5)")}

  ...

  Report: audits/insights-2026-03-25.md
`,
    },

    codedocs: {
        title: "tas-audit codedocs",
        description: "Generate PROJECT_DOCS.md — routes, components, exports, deps",
        output: `
  Generating project documentation...

  Routes scanned:    12
  Components found:  34
  Utilities found:   18
  Env vars found:     9

  ✓ PROJECT_DOCS.md written

  Contents:
    - Project overview (framework, language, version)
    - Folder structure with explanations
    - All API routes with methods and file locations
    - All components with prop summaries
    - All exported utilities with signatures
    - Environment variables required
    - Full dependency list

  Open PROJECT_DOCS.md to review.
`,
    },

    context: {
        title: "tas-audit context",
        description: "Generate .tas-context.md — paste into any AI chat",
        output: `
  Building project context...
  ✓ .tas-context.md written  (2,340 tokens)

  Contents:
    Framework: Next.js 14 (App Router)
    Language:  TypeScript
    Files:     143
    Routes:    12
    Components: 34
    Score:     78/100

  Usage:
    Attach .tas-context.md to Claude, ChatGPT, or Gemini.
    Included prompt templates:
      - "Review the authentication flow and find security issues"
      - "Add a new feature: [describe it]"
      - "Write tests for the payment service"
      - "Refactor [component] for production"
      - "Generate API documentation"
`,
    },

    legal: {
        title: "tas-audit legal",
        description: "GDPR / CCPA checklist + ToS and Privacy Policy templates",
        output: `
  Generating compliance report...

  GDPR Checklist
  ✓ Privacy Policy linked in footer
  ✓ Cookie consent banner present
  ✗ No data retention policy found
  ✗ No right-to-deletion endpoint
  ✗ No DPA (Data Processing Agreement) template

  CCPA Checklist
  ✓ Privacy Policy present
  ✗ No "Do Not Sell My Data" link found
  ✗ No data subject request handler

  Security Headers
  ✗ helmet.js not detected in Express setup
  ✗ No Content-Security-Policy header configured
  ✓ HTTPS enforced in production config

  Report includes:
    - Privacy Policy template
    - Terms of Service template
    - Cookie consent implementation guide

  Report: audits/legal-2026-03-25.md
  NOTE: Review with a qualified attorney before publishing.
`,
    },

    team: {
        title: "tas-audit team",
        description: "Interactive AI REPL — pick a persona, ask questions, write code to files",
        output: `
  tryappstack-audit  v1.0.0
  ◆ AI Team  ·  claude · claude-sonnet-4-20250514
  my-project · Next.js · 143 files

  tas-memory.md: 3 facts loaded

  1.  @dev        Senior Developer
  2.  @architect  System Architect
  3.  @security   Security Expert
  4.  @qa         QA Lead
  5.  @pm         Product Manager

  Choose (1-5 or @name): 1

  @dev  (Senior Developer)  is ready
  Type /help for all commands.

  @dev > add input validation to POST /api/users

  @dev  (Senior Developer)  ·  $0.0041  ·  1,847 tok
  Context: [███░░░░░░░] 18%

    I'll add Zod validation to the POST /api/users route.

  Code Changes Detected  (1 file)

  MODIFY  src/app/api/users/route.ts
  + import { z } from 'zod';
  +
  + const schema = z.object({
  +   email: z.string().email(),
  +   name: z.string().min(2).max(100),
  + });
  +
  + // Inside handler:
  + const parsed = schema.safeParse(await req.json());
  + if (!parsed.success) {
  +   return Response.json({ error: parsed.error.format() }, { status: 400 });
  + }

  Apply these changes? (y/n/skip/diff) _
`,
    },

    bizplan: {
        title: "tas-audit bizplan",
        description: "Business analysis — revenue models, roadmap, competitor notes",
        output: `
  Analysing project for business context...

  ${BOLD("Business Plan — my-project")}

  ${DIM("Summary")}
  A Next.js application with payment processing, user auth, and a REST API.
  Current tech quality score: 78/100.

  ${DIM("Revenue Model Options")}

  1. SaaS Subscription (monthly per seat)
     Setup: 3–5 weeks  |  Risk: churn  |  Upside: predictable MRR

  2. Usage-Based Billing (per API call)
     Setup: 2 weeks  |  Risk: unpredictable revenue  |  Upside: scales with usage

  3. One-time License (self-hosted)
     Setup: 1 week  |  Risk: no recurring revenue  |  Upside: enterprise deals

  ${DIM("90-Day Roadmap")}
  Week 1–2:   Fix critical security issues
  Week 3–4:   Add test coverage for payment + auth routes
  Week 5–8:   Build billing infrastructure
  Week 9–12:  Beta launch with 3 design partners

  Report: audits/bizplan-2026-03-25.md
`,
    },

    testplan: {
        title: "tas-audit testplan",
        description: "Test case generation per route and component",
        output: `
  Generating test plan...

  Routes found:    12
  Components found: 34
  Services found:   8

  ${BOLD("Sample — POST /api/auth/login")}

  Unit tests (authService.ts):
  ✓ valid credentials → returns JWT
  ✓ wrong password → throws AuthError
  ✓ unknown email → throws AuthError
  ✓ expired token → throws TokenExpiredError

  Integration tests:
  ✓ POST /api/auth/login 200 — valid body
  ✓ POST /api/auth/login 401 — wrong password
  ✓ POST /api/auth/login 400 — missing email
  ✓ POST /api/auth/login 429 — rate limit exceeded

  E2E scenarios:
  ✓ User can log in and reach dashboard
  ✓ Failed login shows error message
  ✓ Session persists across page refresh

  CI config snippet (GitHub Actions) included.

  Report: audits/testplan-2026-03-25.md
`,
    },

    estimate: {
        title: "tas-audit estimate",
        description: "Sprint planning — story points, timeline, risk register",
        output: `
  How many developers on this project? 3
  Sprint length (days)? 14
  Which findings are in scope? All

  ${BOLD("Sprint Plan")}

  Sprint 1  (Week 1–2)
    Fix SQL injection in users.ts            2 pts
    Add rate limiting to auth routes         1 pt
    Remove 3 unused dependencies             1 pt
    Add .env.example                         0.5 pt

  Sprint 2  (Week 3–4)
    Write tests for auth service             3 pts
    Write tests for payment service          3 pts
    Fix 6 empty catch blocks                 2 pts

  Sprint 3  (Week 5–6)
    Reduce bundle size (replace moment)      2 pts
    Add JSDoc to 14 exported functions       1 pt
    Fix dead code (6 exports)                1 pt

  Total: 18–38 hours  (3 developers, ~2 sprints)
  Confidence: medium (no team velocity data)

  Report: audits/estimate-2026-03-25.md
`,
    },

    brand: {
        title: "tas-audit brand",
        description: "Marketing notes — ICP, positioning, GTM by channel, copy",
        output: `
  Analysing project for marketing context...

  ${BOLD("Brand Notes — my-project")}

  ${DIM("Ideal Customer")}
  Mid-size SaaS teams (5–50 engineers) building B2B tools.
  Pain: manual code reviews miss security issues.
  Goal: ship faster without breaking production.

  ${DIM("Positioning")}
  "The code audit that runs in your terminal, not in your IDE."

  ${DIM("Channels")}
  Product Hunt   — developer-focused launch, strong for CLI tools
  Hacker News    — Show HN post with benchmark data
  Dev.to / X     — short tutorial: "audit your codebase in 30 seconds"

  ${DIM("Landing Page Copy (above the fold)")}
  Headline: Catch what your linter misses.
  Sub:      16-module audit for JS/TS projects. Runs in seconds.

  Report: audits/brand-2026-03-25.md
`,
    },

    "ai-review": {
        title: "tas-audit ai-review <file>",
        description: "Deep code review with before/after suggestions",
        output: `
  Reviewing: src/services/authService.ts

  ${BOLD("Summary")}
  Handles user login, token generation, and password reset.
  128 lines. 4 exported functions.

  ${chalk.red("Issues found  (3)")}

  1. No rate limiting on login attempts (HIGH)
     Line 23 — loginUser() has no brute-force protection
     Fix: add attempt counter with 15-minute lockout

  2. JWT secret falls back to hardcoded string (HIGH)
     Line 8: const SECRET = process.env.JWT_SECRET || 'fallback-secret';
     Fix: throw if JWT_SECRET is not set in production

  3. Password comparison is synchronous (MEDIUM)
     Line 45: return bcrypt.compareSync(password, hash);
     Fix: use bcrypt.compare() (async) to avoid blocking event loop

  ${chalk.green("Before / After")}

  - const SECRET = process.env.JWT_SECRET || 'fallback-secret';
  + const SECRET = process.env.JWT_SECRET;
  + if (!SECRET) throw new Error('JWT_SECRET environment variable is required');
`,
    },

};

// ── List view ─────────────────────────────────────────────────────────────────

function listTemplates() {
    console.log(`\n  ${BRAND.bold("show-template")}  ${DIM("— preview sample output for any command")}\n`);
    console.log(`  ${DIM("Usage:")} ${BRAND("tas-audit show-template <command>")}\n`);

    const entries = Object.entries(TEMPLATES);
    const maxLen = Math.max(...entries.map(([k]) => k.length));

    for (const [name, tmpl] of entries) {
        console.log(`  ${BRAND(name.padEnd(maxLen + 2))} ${DIM(tmpl.description)}`);
    }

    console.log(`\n  ${DIM("Example:")} ${BRAND("tas-audit show-template team")}\n`);
}

// ── Show one template ─────────────────────────────────────────────────────────

function showTemplate(name) {
    if (!name) {
        listTemplates();
        return;
    }

    const tmpl = TEMPLATES[name.toLowerCase()];
    if (!tmpl) {
        console.log(chalk.red(`\n  ✗ No template for "${name}"\n`));
        listTemplates();
        return;
    }

    console.log(`\n  ${BRAND.bold(tmpl.title)}  ${DIM("— " + tmpl.description)}`);
    console.log(`  ${DIM("─".repeat(60))}`);
    console.log(tmpl.output);
    console.log(`  ${DIM("─".repeat(60))}`);
    console.log(`  ${DIM("This is a sample. Actual output depends on your project.")}\n`);
}

module.exports = showTemplate;
