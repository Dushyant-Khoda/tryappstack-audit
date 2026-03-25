/**
 * tas-audit bizplan
 * AI Revenue Analyst — monetization strategies, market trends, tool ROI
 * Thinks like a YC partner + Stripe PM + revenue-focused CTO
 *
 * ⚠️  AI output is a starting point, not financial advice. Always validate.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");
const DISCLAIMER = chalk.dim(
    "\n  ⚠️  AI output is a planning aid — not financial or legal advice. Validate before committing.\n"
);

async function bizplanCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    if (!key) {
        console.log(chalk.yellow("\n  ✗ AI key required for bizplan.\n"));
        console.log("  Configure once: " + BRAND("npx tryappstack-audit ai-setup") + "\n");
        process.exit(1);
    }

    const providerName = getProviderName(opts);
    console.log(`\n  ${chalk.bold("💰 AI Revenue Analyst")} ${chalk.dim(`· ${providerName}`)}`);
    console.log(chalk.dim("  Thinking like: YC partner · Stripe PM · revenue-focused CTO\n"));

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, tech, features, routes, components, models } = scan;
    const apis  = routes.filter((r) => r.type === "api");
    const pages = routes.filter((r) => r.type === "page");

    const aiSpinner = ora({ text: `  ${providerName} is analysing revenue opportunities...`, color: "yellow" }).start();

    // Compact context — minimal tokens
    const ctx = _buildContext(scan);

    const industry = opts.industry || "SaaS / tech product";
    const stage    = opts.stage    || "early stage";

    const prompt = `You are a revenue-focused product strategist with experience at YC, Stripe, and Vercel.
Analyse this ${framework.name} product at ${stage} stage in the ${industry} space.

PROJECT CONTEXT (structured, not raw code):
${ctx}

⚠️ Important: Only analyse based on the structure above. Do not assume features not listed. Mark any uncertain items as "assumed".

Generate a comprehensive business intelligence report with these EXACT sections:

---

## 📊 Product Revenue Assessment
Current monetization potential score (1-10) with justification. What revenue signals exist in the codebase (Stripe? Auth tiers? API rate limits?).

## 💡 Monetization Strategies (ranked by feasibility)
For each strategy:
- Strategy name + type (freemium / usage-based / enterprise / marketplace / etc.)
- Why it fits THIS stack specifically
- Estimated MRR range at 100 / 1,000 / 10,000 users
- Implementation effort: Low / Medium / High
- Time to first revenue

## 🔥 Current Market Trends (next 6 months)
5 trends directly relevant to this ${framework.name} + ${tech.slice(0, 3).join(" + ")} stack.
For each: trend name, why it matters NOW, how to capitalise with minimal code changes.

## 🚀 Next Wave Trends (6-18 months out)
3 emerging trends to build towards NOW before the market is saturated.
For each: opportunity, why early movers win, what to build.

## 🛠 High-ROI Tool Integrations
Tools to add that increase product value AND create revenue opportunities:
| Tool | Monthly Cost | Revenue Opportunity | Effort | ROI Score |
Format as markdown table. Include tools like: analytics, error monitoring, feature flags, payments, AI, support, etc.

## 🏆 Competitor Feature Gaps
Based on the detected stack and features, what are the TOP 5 features that market leaders have that this product likely lacks? Rank by user value.

## 📈 90-Day Revenue Roadmap
Week 1-4: Quick wins
Week 5-8: Core monetization
Week 9-12: Growth levers

---
Be specific to THIS product's stack. No generic SaaS advice. Flag anything assumed with ⚠️.`;

    let result = "";
    try {
        result = await callAI([{ role: "user", content: prompt }], opts);
        aiSpinner.stop();
    } catch (err) {
        aiSpinner.stop();
        console.log(chalk.red("  AI call failed: " + err.message));
        process.exit(1);
    }

    console.log(`\n  ${BRAND.bold("💰 Revenue Intelligence Report")} ${chalk.dim(`· ${providerName}`)}\n`);
    console.log(result.split("\n").map((l) => "  " + l).join("\n"));
    console.log(DISCLAIMER);

    // Save report
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `bizplan-${timestamp}.md`);

    const md = `# 💰 Revenue Intelligence Report — ${scan.name}

> **Framework:** ${framework.name} · **Stage:** ${stage} · **Industry:** ${industry}
> **AI Agent:** ${providerName}
> **Generated:** ${new Date().toISOString().slice(0, 19)}
> ⚠️ *AI output is a planning aid — not financial or legal advice. Always validate before committing.*

---

${result}

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit bizplan\`*
`;

    fs.writeFileSync(outputFile, md);
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
}

function _buildContext(scan) {
    const { framework, tech, features, routes, components, models, envVars } = scan;
    const apis  = routes.filter((r) => r.type === "api").slice(0, 20);
    const pages = routes.filter((r) => r.type === "page").slice(0, 20);

    return [
        `Name: ${scan.name} v${scan.version}`,
        `Framework: ${framework.name} | Language: ${framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `Description: ${scan.description || "not provided"}`,
        `Tech: ${tech.join(", ") || "none detected"}`,
        `Features: ${features.map((f) => f.name + (f.detail ? `(${f.detail})` : "")).join(", ") || "none"}`,
        `Pages (${pages.length}): ${pages.map((r) => r.path).join(", ")}`,
        `API Routes (${apis.length}): ${apis.map((r) => (r.method || "GET") + " " + r.path).join(", ")}`,
        `DB Models (${models.length}): ${models.map((m) => m.name).join(", ")}`,
        `Env vars detected: ${scan.envVars.length} (names only, no values)`,
        `Components: ${scan.components.length} total`,
        `Auth: ${features.some((f) => f.name === "Authentication") ? "YES — " + (features.find((f) => f.name === "Authentication")?.detail || "detected") : "NOT DETECTED"}`,
        `Payments: ${features.some((f) => f.name === "Payments") ? "YES — " + (features.find((f) => f.name === "Payments")?.detail || "detected") : "NOT DETECTED"}`,
    ].join("\n");
}

module.exports = bizplanCommand;
