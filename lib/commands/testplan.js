/**
 * tas-audit testplan
 * AI Tester — generates test strategy, test cases per route/component, CI recommendations
 *
 * ⚠️  AI-generated test cases. Review for correctness before using in production.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

async function testplanCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    if (!key) {
        console.log(chalk.yellow("\n  ✗ AI key required for test plan generation.\n"));
        console.log("  Configure once: " + BRAND("npx tryappstack-audit ai-setup") + "\n");
        process.exit(1);
    }

    const providerName = getProviderName(opts);
    console.log(`\n  ${chalk.bold("🧪 AI Tester")} ${chalk.dim(`· ${providerName}`)}`);
    console.log(chalk.dim("  Thinking like: QA Lead at Stripe · GitHub · Vercel\n"));

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, tech, features, routes, components, models } = scan;
    const apis  = routes.filter((r) => r.type === "api");
    const pages = routes.filter((r) => r.type === "page");

    const hasAuth     = features.some((f) => f.name === "Authentication");
    const hasPayments = features.some((f) => f.name === "Payments");
    const hasDB       = features.some((f) => f.name === "Database ORM");
    const hasRealtime = features.some((f) => f.name === "Real-time");

    // Detect existing test setup
    const hasVitest    = scan.devDependencies.includes("vitest");
    const hasJest      = scan.devDependencies.includes("jest");
    const hasPlaywright= scan.devDependencies.includes("@playwright/test");
    const hasCypress   = scan.devDependencies.includes("cypress");
    const hasTestLib   = scan.devDependencies.includes("@testing-library/react");
    const hasNoTests   = !hasVitest && !hasJest && !hasPlaywright && !hasCypress;

    const aiSpinner = ora({ text: `  ${providerName} is writing test cases...`, color: "yellow" }).start();

    const ctx = [
        `Framework: ${framework.name} | ${framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `Tech: ${tech.join(", ")}`,
        `Features: ${features.map((f) => f.name).join(", ")}`,
        `API Routes (${apis.length}): ${apis.slice(0, 20).map((r) => (r.method || "GET") + " " + r.path).join(", ")}`,
        `Pages (${pages.length}): ${pages.slice(0, 15).map((r) => r.path).join(", ")}`,
        `Components (${components.length}): ${components.slice(0, 15).map((c) => c.name).join(", ")}`,
        `DB Models: ${models.map((m) => m.name).join(", ") || "none"}`,
        `Existing tests: ${hasVitest ? "Vitest" : hasJest ? "Jest" : "NONE"} | E2E: ${hasPlaywright ? "Playwright" : hasCypress ? "Cypress" : "NONE"}`,
        `Auth: ${hasAuth ? "yes" : "no"} | Payments: ${hasPayments ? "yes" : "no"} | Real-time: ${hasRealtime ? "yes" : "no"}`,
        `Critical code issues: ${scan.issues.filter((i) => i.severity === "critical").length}`,
    ].join("\n");

    const testFramework = hasVitest ? "Vitest" : hasJest ? "Jest" : framework.isNextJs ? "Jest/Vitest" : "Jest";
    const e2eFramework  = hasPlaywright ? "Playwright" : hasCypress ? "Cypress" : "Playwright (recommended)";

    const prompt = `You are a QA Lead with experience at Stripe, GitHub, and Vercel.
Generate a comprehensive test plan for this ${framework.name} application.

PROJECT CONTEXT:
${ctx}

Generate a test plan with EXACT sections:

---

## 🎯 Testing Strategy Overview
Current test coverage score (0-100%) based on what's detected.
Recommended test pyramid for this stack: % unit / % integration / % e2e.
Priority areas: what to test FIRST based on business risk.

## 🔴 Critical Path Test Cases (Test These First)
The flows that, if broken, kill the product. For each flow:
**Flow name**
- Step 1: [action] → Expected: [result]
- Step 2: ...
- Edge cases: ...
${hasAuth ? `\nInclude: Auth flow (login, logout, session expiry, refresh token)` : ""}
${hasPayments ? `\nInclude: Payment flow (checkout, success, failure, webhook)` : ""}

## 🧪 Unit Tests — ${testFramework}
For each of the top 10 components/utilities that need tests:
\`\`\`typescript
// ComponentName.test.ts
describe('ComponentName', () => {
  it('should [behaviour]', () => {
    // Arrange
    // Act  
    // Assert
  });
  it('should handle [edge case]', () => { ... });
});
\`\`\`

## 🔗 Integration Tests — API Routes
For each API endpoint (up to 10 most important):
| Endpoint | Method | Test: Happy Path | Test: Error cases | Auth required |
|----------|--------|------------------|-------------------|---------------|

## 🌐 E2E Tests — ${e2eFramework}
Top 5 user journeys as E2E test scenarios:
\`\`\`typescript
// e2e/journey-name.spec.ts
test('User can [complete journey]', async ({ page }) => {
  // steps
});
\`\`\`

## 🔐 Security Test Cases
Tests specifically for: auth bypass, input injection, rate limiting, CORS, data exposure.
${scan.issues.filter((i) => i.severity === "critical").length > 0 ? "Focus on the " + scan.issues.filter((i) => i.severity === "critical").length + " critical issues already found." : ""}

## ⚡ Performance Benchmarks
3 performance tests to add. Thresholds appropriate for ${framework.name}:
- Page load targets
- API response time targets  
- DB query time targets

## 🚀 CI/CD Test Configuration
Exact config snippet for GitHub Actions (or the detected CI) to run:
1. Unit tests on every PR
2. E2E tests on merge to main
3. Performance tests on release

${hasNoTests ? "\n## ⚠️ PRIORITY: No Tests Detected\nStep-by-step guide to add testing from zero, specific to " + framework.name + " + " + tech.slice(0, 2).join(" + ") + "." : ""}

---
⚠️ AI-generated test cases — review for accuracy before production use.`;

    let result = "";
    try {
        result = await callAI([{ role: "user", content: prompt }], opts);
        aiSpinner.stop();
    } catch (err) {
        aiSpinner.stop();
        console.log(chalk.red("  AI call failed: " + err.message));
        process.exit(1);
    }

    console.log(`\n  ${BRAND.bold("🧪 Test Plan")} ${chalk.dim(`· ${providerName}`)}\n`);
    console.log(result.split("\n").map((l) => "  " + l).join("\n"));
    console.log(chalk.dim("\n  ⚠️  Review all test cases for accuracy before adding to production CI.\n"));

    // Save
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `testplan-${timestamp}.md`);

    const md = `# 🧪 Test Plan — ${scan.name}

> **Framework:** ${framework.name} · **Unit:** ${testFramework} · **E2E:** ${e2eFramework}
> **AI Agent:** ${providerName}
> **Generated:** ${new Date().toISOString().slice(0, 19)}
> ⚠️ *AI-generated test cases. Review for correctness before using in CI/CD.*

---

${result}

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit testplan\`*
`;

    fs.writeFileSync(outputFile, md);
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
}

module.exports = testplanCommand;
