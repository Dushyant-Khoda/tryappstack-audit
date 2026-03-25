/**
 * tas-audit features
 * AI Business Analyst — feature gap analysis, market comparison, revenue prioritisation
 *
 * ⚠️  AI output should be reviewed. Always validate against real user research.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

async function featuresCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    if (!key) {
        console.log(chalk.yellow("\n  ✗ AI key required for features analysis.\n"));
        console.log("  Configure once: " + BRAND("npx tryappstack-audit ai-setup") + "\n");
        process.exit(1);
    }

    const providerName = getProviderName(opts);
    console.log(`\n  ${chalk.bold("📋 AI Business Analyst")} ${chalk.dim(`· ${providerName}`)}`);
    console.log(chalk.dim("  Thinking like: Senior PM at Notion · Linear · Figma\n"));

    // Gather context
    let productType = opts.type;
    let targetUser  = opts.target;

    if (!opts.yes) {
        const answers = await inquirer.prompt([
            {
                type: "input",
                name: "productType",
                message: "  What type of product is this?",
                default: "SaaS web app",
                when: !productType,
            },
            {
                type: "input",
                name: "targetUser",
                message: "  Who is your primary user?",
                default: "developers / technical founders",
                when: !targetUser,
            },
        ]);
        productType = productType || answers.productType;
        targetUser  = targetUser  || answers.targetUser;
    } else {
        productType = productType || "SaaS web app";
        targetUser  = targetUser  || "developers";
    }

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, tech, features } = scan;
    const apis = scan.routes.filter((r) => r.type === "api");

    const aiSpinner = ora({ text: `  ${providerName} is mapping feature landscape...`, color: "yellow" }).start();

    const ctx = _buildContext(scan, productType, targetUser);

    const prompt = `You are a Senior Product Manager with experience at Notion, Linear, and Figma.
Analyse this ${productType} targeting "${targetUser}".

PROJECT CONTEXT:
${ctx}

⚠️ Only reference features explicitly listed above. Mark assumptions with ⚠️.

Generate a business analyst report with EXACT sections:

---

## ✅ Existing Features (Confirmed from Codebase)
List every feature detected, map each to its business value (retention / acquisition / monetisation / operational).

## 🚨 Critical Missing Features
Features that users of a "${productType}" EXPECT to exist. Absence will cause churn or prevent conversion.
For each: Feature name | Why critical | Complexity (S/M/L/XL) | Business impact

## 💎 High-Value Underrated Features
Features most products skip but users love. Sticky, differentiating, and often viral.
For each: Feature | Why users love it | Revenue link | Build effort

## 📊 Feature Priority Matrix
Format as table:
| Feature | User Value (1-10) | Revenue Impact (1-10) | Effort (S/M/L) | Priority |
Top 10 features to build next, ranked by (Value × Revenue) / Effort.

## 🏁 Competitor Benchmark
Compare this product against 3 likely competitors (based on stack/features).
What each competitor does better. Where this product can leapfrog them.

## 🎯 Features That Drive Virality
3 features that would make users share / recommend this product organically.
Why each creates network effects or word-of-mouth.

## 📅 Feature Roadmap Suggestion
Q1 (now): Must-haves to stop churn
Q2: Growth features
Q3-Q4: Moat features (hard to copy)

---
Be specific to "${productType}" targeting "${targetUser}". No generic PM advice.`;

    let result = "";
    try {
        result = await callAI([{ role: "user", content: prompt }], opts);
        aiSpinner.stop();
    } catch (err) {
        aiSpinner.stop();
        console.log(chalk.red("  AI call failed: " + err.message));
        process.exit(1);
    }

    console.log(`\n  ${BRAND.bold("📋 Feature Intelligence Report")} ${chalk.dim(`· ${providerName}`)}\n`);
    console.log(result.split("\n").map((l) => "  " + l).join("\n"));
    console.log(chalk.dim("\n  ⚠️  AI output is a planning aid. Validate with real user interviews.\n"));

    // Save report
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `features-${timestamp}.md`);

    const md = `# 📋 Feature Intelligence Report — ${scan.name}

> **Product type:** ${productType} · **Target user:** ${targetUser}
> **AI Agent:** ${providerName}
> **Generated:** ${new Date().toISOString().slice(0, 19)}
> ⚠️ *AI output is a planning aid. Always validate with real user research and interviews.*

---

${result}

---

*Next: Run \`npx tryappstack-audit estimate\` to build a sprint timeline from this report.*
*Generated by [tryappstack-audit](https://tryappstack.vercel.app)*
`;

    fs.writeFileSync(outputFile, md);
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile));
    console.log(chalk.dim("  Next step: ") + BRAND("npx tryappstack-audit estimate") + chalk.dim(" → build sprint timeline\n"));
}

function _buildContext(scan, productType, targetUser) {
    const { framework, tech, features, routes, components, models } = scan;
    const apis  = routes.filter((r) => r.type === "api").slice(0, 20);
    const pages = routes.filter((r) => r.type === "page").slice(0, 15);

    return [
        `Product: ${scan.name} · ${productType} for "${targetUser}"`,
        `Framework: ${framework.name} | ${framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `Tech Stack: ${tech.join(", ") || "standard"}`,
        `Existing Features: ${features.map((f) => f.name + (f.detail ? ` (${f.detail})` : "")).join(" | ") || "none detected"}`,
        `Pages (${pages.length}): ${pages.map((r) => r.path).join(", ")}`,
        `API Endpoints (${apis.length}): ${apis.map((r) => (r.method || "GET") + " " + r.path).join(", ")}`,
        `DB Models: ${models.map((m) => m.name).join(", ") || "none detected"}`,
        `Components: ${components.length}`,
        `Auth: ${features.some((f) => f.name === "Authentication") ? features.find((f) => f.name === "Authentication").detail : "none"}`,
        `Payments: ${features.some((f) => f.name === "Payments") ? features.find((f) => f.name === "Payments").detail : "none"}`,
        `Real-time: ${features.some((f) => f.name === "Real-time") ? "yes" : "no"}`,
    ].join("\n");
}

module.exports = featuresCommand;
