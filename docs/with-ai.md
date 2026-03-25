# Using tryappstack-audit with an AI key

This page covers every AI-powered feature. You need an API key from one of the supported providers: Claude (Anthropic), GPT-4o (OpenAI), Grok (xAI), Gemini (Google), or DeepSeek.

---

## Table of Contents

1. [Setup](#setup)
2. [team — the REPL](#team)
3. [Slash commands reference](#slash-commands)
4. [Memory across sessions](#memory)
5. [bizplan — business analysis](#bizplan)
6. [features — feature gap analysis](#features)
7. [estimate — sprint planning](#estimate)
8. [testplan — test cases](#testplan)
9. [brand — marketing](#brand)
10. [legal — compliance templates](#legal)
11. [insights — AI-enhanced scan](#insights)
12. [codedocs — AI architecture docs](#codedocs)
13. [ai-plan — sprint fix plan](#ai-plan)
14. [ai-chat — codebase Q&A](#ai-chat)
15. [ai-estimate — tech debt hours](#ai-estimate)
16. [ai-review — code review](#ai-review)
17. [Cost and model selection](#cost)
18. [Sample outputs](#sample-outputs)

---

## Setup

```bash
tas-audit ai-setup
```

Choose your provider and model using the arrow keys. Paste your API key when prompted. The key is saved to `~/.tryappstack/config` with `chmod 600`. It is never written to any project file.

**Where to get a key:**

| Provider | URL |
|----------|-----|
| Claude | https://console.anthropic.com |
| OpenAI | https://platform.openai.com/api-keys |
| Grok | https://console.x.ai |
| Gemini | https://aistudio.google.com/apikey |
| DeepSeek | https://platform.deepseek.com |

Run `ai-setup` again at any time to change provider or model.

**Using environment variables instead:**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export XAI_API_KEY=xai-...
export GEMINI_API_KEY=AIza...
export DEEPSEEK_API_KEY=sk-...

tas-audit team --ai-provider claude
```

---

## team

```bash
tas-audit team
tas-audit team --resume my-session
tas-audit team --ai-model claude-opus-4-20250514
tas-audit team --temperature 0.1
tas-audit team --dry-run
```

Opens an interactive REPL with an AI persona of your choice. The AI reads your project structure before the first message — you do not need to explain your stack.

**Choosing a persona:**

```
  1.  @dev        Senior Developer
  2.  @architect  System Architect
  3.  @security   Security Expert
  4.  @qa         QA Lead
  5.  @pm         Product Manager

  Choose (1-5 or @name): 1
```

You can switch personas mid-session by typing `@architect` or `@qa` as your message.

**When the AI proposes code:**

The REPL detects code blocks that contain file paths and offers to write them:

```
  Code Changes Detected  (2 files)

  CREATE  src/middleware/rateLimit.ts
  MODIFY  src/app.ts

  Apply these changes? (y/n/skip/diff) diff
```

- `y` — write to disk
- `n` — skip
- `diff` — show a line diff before deciding

**Including a specific file:**

```
@file src/services/auth.ts
```

Loads the file into your next message. Useful when you want the AI to see implementation details.

**Ctrl+C mid-response:**

If a response is streaming and you want to stop and redirect, press Ctrl+C. You can then send a follow-up or use `/retry` with different wording.

---

## Slash commands

Type `/` in the REPL and press Tab to see available commands. Type the first few letters and press Tab to complete.

### Context and memory

| Command | What it does |
|---------|-------------|
| `/context` | Show the project summary sent to the AI |
| `/clear` | Clear conversation history (keeps memory) |
| `/compress` | Summarise older messages to free context space |
| `/remember "fact"` | Save a fact to `tas-memory.md` — persists across sessions |
| `/memory` | Show contents of `tas-memory.md` |
| `/forget <text>` | Remove a matching line from `tas-memory.md` |
| `/anchor "fact"` | Pin a fact that survives context compression |
| `/anchors` | List all anchored facts |

### Trust and verification

| Command | What it does |
|---------|-------------|
| `/confidence` | Toggle confidence badge on every response |
| `/verify` | Ask the AI to fact-check its last response |
| `/disagree` | Ask the AI to argue against its last answer |

### Search and bookmarks

| Command | What it does |
|---------|-------------|
| `/star` | Bookmark the last response |
| `/starred` | Show all bookmarks |
| `/search <query>` | Search text across all past sessions |
| `/digest` | Top 5 starred responses from the last 7 days |

### Cost and routing

| Command | What it does |
|---------|-------------|
| `/cost` | Show session cost so far |
| `/tag <label>` | Label the next exchange for cost reporting |
| `/cost-tags` | Cost breakdown by label |
| `/budget daily=1 monthly=20` | Set daily and monthly spend limits |
| `/benchmark` | Show cost of last exchange across all models |
| `/smart-route` | Auto-route cheap vs careful based on query complexity |
| `/failover <provider> <key>` | Add a fallback provider for rate limit errors |

### Injection

| Command | What it does |
|---------|-------------|
| `/fetch <url>` | Load a URL's content into your next message |
| `/image <path>` | Load an image for vision-capable models |
| `/pin "instruction"` | Prepend an instruction to every request |
| `/unpin` | Remove the pinned instruction |

### Prompts and sessions

| Command | What it does |
|---------|-------------|
| `/save <name>` | Save current input as a reusable prompt |
| `/load <name>` | Load a saved prompt |
| `/prompts` | List saved prompts |
| `/export <name>` | Export prompts as a YAML file |
| `/import <file>` | Import a prompt pack |
| `/bundle` | Export memory + prompts + config to `tas-bundle.json` |
| `/save-session <name>` | Save the full conversation to disk |
| `/sessions` | List saved sessions |
| `/resume <name>` | Load a saved session |
| `/branch <name>` | Fork the session at the current point |

### Control

| Command | What it does |
|---------|-------------|
| `/retry` | Retry the last prompt |
| `/retry --temp=0.9` | Retry with a different temperature |
| `/dry-run` | Preview the full prompt without sending |
| `/use <profile>` | Switch to a `.tasrc` profile |
| `/config` | Show active provider, model, temperature |
| `/init-config` | Create `.tasrc` in the project root |
| `/security` | Check for exposed credentials, show storage policy |
| `/members` | List available personas |
| `/benchmark` | Compare cost across models |
| `/help` | Full command list |

---

## Memory

The AI forgets everything between sessions by default. `tas-memory.md` solves this.

```
@dev > /remember "We use PostgreSQL 15 with Prisma ORM"
  ✓ Saved to tas-memory.md

@dev > /remember "Auth is JWT, 24h expiry, stored in httpOnly cookies"
  ✓ Saved to tas-memory.md

@dev > /remember "API prefix is /v2 — all responses follow { data, error, meta }"
  ✓ Saved to tas-memory.md
```

`tas-memory.md` is injected into every session automatically. The AI reads it before your first message. Edit it directly in any editor. Commit it to git — it contains no credentials.

**Anchors** survive context compression (when long sessions get summarised):

```
/anchor "We never use class components — all React code uses hooks"
/anchor "No direct DB calls in controllers — always go through the service layer"
```

---

## bizplan

```bash
tas-audit bizplan
```

Reads your project structure and audit results, then produces a business analysis report. Output saved to `audits/bizplan-YYYY-MM-DD.md`.

**What it covers:**

- Project summary for a non-technical reader
- Current monetisation assessment
- 3 revenue model options with trade-offs
- Competitor positioning based on your tech stack
- 90-day roadmap with milestones
- Key risks by category

**When to use it:** When preparing a pitch deck, an investor update, or a strategy document. Start with this output and edit — do not publish it as-is.

---

## features

```bash
tas-audit features
```

Analyses what your project currently does and produces a feature gap report. Output saved to `audits/features-YYYY-MM-DD.md`.

**What it covers:**

- Current feature set (inferred from routes, components, dependencies)
- Feature gaps against comparable products
- Priority matrix (effort vs impact)
- Features that typically drive user growth in this category
- Features to cut or defer

---

## estimate

```bash
tas-audit estimate
```

Interactive Q&A about your team and timeline, then generates a sprint plan.

**Questions asked:**

- How many developers?
- What is your sprint length?
- What is your target release date?
- Which audit findings are in scope?

**Output includes:**

- Story points per module fix
- Sprint-by-sprint breakdown
- Risk register
- Total estimated hours with confidence range

---

## testplan

```bash
tas-audit testplan
```

Reads your routes, components, and services, then generates test cases. Output saved to `audits/testplan-YYYY-MM-DD.md`.

**What it generates:**

- Unit test cases per utility and service
- Integration test cases per API route
- E2E test scenarios for critical user flows
- CI config snippet (GitHub Actions or GitLab CI)
- Jest/Vitest/Playwright setup notes based on your current test runner

Review all generated test cases before adding to CI. AI-generated tests sometimes miss edge cases or make incorrect assertions about your business logic.

---

## brand

```bash
tas-audit brand
```

Reads your project and produces a marketing notes document. Output saved to `audits/brand-YYYY-MM-DD.md`.

**What it covers:**

- Ideal customer profile based on your tech stack and features
- Positioning statement
- Key differentiators vs comparable tools
- Channel recommendations (where your users are)
- Copy for landing page, Product Hunt, Twitter/X, LinkedIn
- Launch checklist

---

## legal

```bash
tas-audit legal
```

With an AI key, produces more complete output than the static version. Includes:

- Full GDPR compliance checklist with pass/fail for detectable items
- CCPA compliance checklist
- Privacy Policy template (fill-in-the-blanks format)
- Terms of Service template
- Cookie consent implementation guide
- Data Processing Agreement notes

Not legal advice. Have a qualified attorney review before publishing.

---

## insights

```bash
tas-audit insights
```

With an AI key, adds a section after the static findings:

- Prioritised fix list (most critical first)
- Estimated fix time per issue
- Code snippets showing the fix, not just the problem
- Production readiness checklist

---

## codedocs

```bash
tas-audit codedocs
```

With an AI key, adds after the static documentation:

- Architecture analysis — what pattern is being used and whether it is consistent
- Data flow diagram (text-based)
- Deployment guide for your detected stack
- Onboarding guide for new developers

---

## ai-plan

```bash
tas-audit ai-plan
```

Takes the latest audit report from `audits/` and generates a 2-week sprint plan focused on fixing the issues found. Output saved to `audits/ai-plan-YYYY-MM-DD.md`.

---

## ai-chat

```bash
tas-audit ai-chat
```

A simpler AI chat than the full `team` REPL. No personas, no file writing. Ask questions about your codebase and get answers based on the project context.

Good for quick questions:
- "Why is my test coverage score low?"
- "Which unused packages are safe to remove?"
- "What does the complexity score measure?"

---

## ai-estimate

```bash
tas-audit ai-estimate
```

Estimates the hours required to address every issue in the latest audit report. Breaks it down by module and gives a total range.

Output format:

```
  Module              Issues   Hours (low–high)
  ─────────────────────────────────────────────
  Dead Code           6        2–4h
  Unused Packages     3        0.5–1h
  Test Coverage       Low      8–16h
  Security            2        1–3h
  ─────────────────────────────────────────────
  Total               18–38h
```

---

## ai-review

```bash
tas-audit ai-review src/services/auth.ts
tas-audit ai-review src/api/payments.ts
```

Deep review of a single file. Returns:

- Summary of what the file does
- Issues found (security, performance, correctness)
- Before/after code for each suggested change
- Questions the reviewer would ask in a code review

---

## Cost

Every response in the `team` REPL shows the cost:

```
  @dev  (Senior Developer)  ·  $0.0034  ·  1,240 tok
```

**Session total:**

```
/cost
```

**Compare models:**

```
/benchmark
```

Shows what the last exchange would have cost on each model:

```
  Model                    Cost      Tokens
  ─────────────────────────────────────────
  deepseek-chat            $0.0002   1,240
  gemini-2.0-flash         $0.0005   1,240
  gpt-4o-mini              $0.0008   1,240
  claude-haiku-4           $0.0012   1,240
  gpt-4o                   $0.0037   1,240     <- current
  claude-sonnet-4          $0.0041   1,240
  claude-opus-4            $0.0165   1,240
```

**Set a budget:**

In `.tasrc`:
```json
{
  "budget": { "daily": 1.00, "monthly": 20.00 }
}
```

Or inside the REPL:
```
/budget daily=1 monthly=20
```

When you approach the limit, the REPL warns. When you hit it, it stops sending.

**Tag exchanges for reporting:**

```
/tag auth-refactor
```

After this, the next exchange is labelled `auth-refactor`. Run `/cost-tags` at the end of a session to see a cost breakdown by label. Useful when billing client work or tracking where time is going.

---

## Sample outputs

### team REPL — session start

```
  tryappstack-audit  v1.0.0
  ◆ AI Team  · Claude · claude-sonnet-4-20250514
  my-project · Next.js · 143 files

  Config: /my-project/.tasrc (.tasrc)
  tas-memory.md: 3 facts loaded · /memory to view · /remember to add

  1.  @dev        Senior Developer
  2.  @architect  System Architect
  3.  @security   Security Expert
  4.  @qa         QA Lead
  5.  @pm         Product Manager

  Choose (1-5 or @name): 1

  @dev  (Senior Developer)  is ready

  Type /help for all commands. Ctrl+C mid-response to interrupt.

  @dev > _
```

### team REPL — after a response

```
  @dev > add input validation to the POST /api/users route

  @dev  (Senior Developer)  ·  $0.0041  ·  1,847 tok
  Context: [███░░░░░░░] 18%

  [AI response with code...]

  Code Changes Detected  (1 file)

  MODIFY  src/app/api/users/route.ts
  + import { z } from 'zod';
  + const schema = z.object({
  +   email: z.string().email(),
  +   name: z.string().min(2).max(100),
  + });
  ...

  Apply these changes? (y/n/skip/diff) y
  ✓ Modified: src/app/api/users/route.ts
```

### bizplan excerpt

```markdown
# Business Plan — my-project
Generated: 2026-03-25

## Summary
my-project is a Next.js application with 12 API routes, user authentication,
and payment processing via Stripe. Current tech debt score is 78/100.

## Revenue Model Options

### 1. SaaS Subscription
Charge monthly per seat or per usage tier.
Estimated setup: 3–5 weeks
Risk: churn — requires strong retention

### 2. Usage-Based Billing
Charge per API call or transaction processed.
Estimated setup: 2 weeks
Risk: unpredictable revenue

### 3. One-time License
Charge upfront for self-hosted deployment.
Best for: enterprise or compliance-heavy markets
Risk: high initial sales friction

## 90-Day Roadmap

Week 1–2:  Fix security issues (SQL injection, missing rate limiting)
Week 3–4:  Add missing tests to payment and auth routes
Week 5–8:  Build usage tracking and billing infrastructure
Week 9–12: Launch beta with 3 design partners
```

### testplan excerpt

```markdown
# Test Plan — my-project
Generated: 2026-03-25

## Unit Tests

### src/services/authService.ts

| Test | Input | Expected |
|------|-------|----------|
| login — valid credentials | { email: "a@b.com", password: "valid" } | Returns JWT token |
| login — wrong password | { email: "a@b.com", password: "wrong" } | Throws AuthError |
| login — unknown email | { email: "x@y.com", password: "any" } | Throws AuthError |
| generateToken — valid user | User object | JWT string, expires in 24h |
| verifyToken — valid token | Valid JWT | Decoded payload |
| verifyToken — expired | Expired JWT | Throws TokenExpiredError |

## E2E Scenarios

### User registration flow
1. Visit /register
2. Fill email and password
3. Submit form
4. Expect redirect to /dashboard
5. Expect welcome email sent

### Password reset flow
1. Visit /forgot-password
2. Enter registered email
3. Check email for reset link
4. Click link, enter new password
5. Expect successful login with new password
```

---

## What the AI does not do

- It does not read your actual environment variable values, only the key names from `.env.example`
- It does not access the internet during a `team` session (unless you use `/fetch <url>`)
- It does not remember anything between sessions unless you use `tas-memory.md`
- It does not automatically apply code changes — you confirm each one
- It can produce incorrect code. Review everything before running it in production.

For the no-AI features, see [without-ai.md](./without-ai.md).
