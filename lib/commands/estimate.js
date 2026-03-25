/**
 * tas-audit estimate
 * AI Project Manager — interactive sprint timeline with Q&A
 *
 * ⚠️  Estimates are AI-generated. Add 20-30% buffer for unknowns.
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

async function estimateCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    if (!key) {
        console.log(chalk.yellow("\n  ✗ AI key required for estimation.\n"));
        console.log("  Configure once: " + BRAND("npx tryappstack-audit ai-setup") + "\n");
        process.exit(1);
    }

    const providerName = getProviderName(opts);
    console.log(`\n  ${chalk.bold("📅 AI Project Manager")} ${chalk.dim(`· ${providerName}`)}`);
    console.log(chalk.dim("  Thinking like: Engineering Manager at Linear · Atlassian\n"));

    // ── Interactive Q&A ─────────────────────────────────────────────────────
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "teamSize",
            message: "  How many developers on this project?",
            default: "2",
            validate: (v) => (parseInt(v) > 0 ? true : "Enter a number > 0"),
        },
        {
            type: "list",
            name: "seniority",
            message: "  Average team seniority?",
            choices: ["Junior (0-2 yrs)", "Mid (2-5 yrs)", "Senior (5+ yrs)", "Mixed"],
            default: "Mid (2-5 yrs)",
        },
        {
            type: "input",
            name: "hoursPerWeek",
            message: "  Hours per developer per week?",
            default: "40",
            validate: (v) => (parseInt(v) > 0 && parseInt(v) <= 80 ? true : "Enter 1-80"),
        },
        {
            type: "input",
            name: "features",
            message: "  What features do you want to estimate? (comma-separated, or 'all' for full audit fixes)",
            default: "all",
        },
        {
            type: "list",
            name: "methodology",
            message: "  Development methodology?",
            choices: ["Scrum (2-week sprints)", "Kanban (continuous)", "Shape Up (6-week cycles)", "Custom"],
            default: "Scrum (2-week sprints)",
        },
        {
            type: "input",
            name: "riskTolerance",
            message: "  Buffer for unknowns? (percentage, e.g. 30)",
            default: "25",
            validate: (v) => (parseInt(v) >= 0 && parseInt(v) <= 100 ? true : "Enter 0-100"),
        },
    ]);

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, tech, features: detectedFeatures, routes, components, models } = scan;
    const featureList = answers.features === "all"
        ? detectedFeatures.map((f) => f.name).join(", ") + " + audit fixes"
        : answers.features;

    const aiSpinner = ora({ text: `  ${providerName} is building sprint plan...`, color: "yellow" }).start();

    const velocityFactor = _getVelocityFactor(answers.seniority, parseInt(answers.teamSize));
    const sprintHours = parseInt(answers.teamSize) * parseInt(answers.hoursPerWeek) * 2; // 2-week sprint
    const bufferMultiplier = 1 + parseInt(answers.riskTolerance) / 100;

    const ctx = [
        `Project: ${scan.name} | Framework: ${framework.name} | ${framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `Tech: ${tech.join(", ")}`,
        `Existing features: ${detectedFeatures.map((f) => f.name).join(", ")}`,
        `Routes: ${routes.length} | Components: ${components.length} | DB Models: ${models.length}`,
        `Code issues found: ${scan.issues.filter((i) => i.severity === "critical").length} critical, ${scan.issues.filter((i) => i.severity === "warning").length} warnings`,
    ].join("\n");

    const prompt = `You are a senior engineering manager with expertise in estimation and sprint planning.

PROJECT CONTEXT:
${ctx}

TEAM PARAMETERS:
- Team size: ${answers.teamSize} developer(s)
- Seniority: ${answers.seniority}
- Hours/week/dev: ${answers.hoursPerWeek}
- Methodology: ${answers.methodology}
- Buffer: ${answers.riskTolerance}% for unknowns
- Sprint capacity: ~${sprintHours} developer-hours per sprint (before buffer)

FEATURES TO ESTIMATE:
${featureList}

Generate a precise project estimation report with EXACT sections:

---

## 📊 Estimation Summary
Total story points | Total hours (raw) | Total hours (with ${answers.riskTolerance}% buffer) | Calendar weeks | Calendar months
Risk level: Low / Medium / High with justification.

## 🃏 Story Point Breakdown
For every feature/item in the list:
| Feature / Task | Story Points | Hours (raw) | Hours (buffered) | Complexity | Dependencies |
Use Fibonacci: 1, 2, 3, 5, 8, 13, 21

## 📅 Sprint Plan
For ${answers.methodology} with ${answers.teamSize} dev(s) at ${answers.hoursPerWeek}h/wk:
Sprint 1 (Week 1-2): [tasks + story points]
Sprint 2 (Week 3-4): [tasks + story points]
... continue until done.

## ⚠️ Risk Register
Top 5 risks that could blow the timeline. For each: probability (H/M/L), impact (H/M/L), mitigation.

## 🔑 Critical Path
Which tasks MUST be done first because others depend on them. What blocks the entire project.

## 💰 Cost Estimate
Based on seniority level, approximate cost range at market rates:
- Junior rate: $40-60/hr
- Mid rate: $80-120/hr  
- Senior rate: $150-200/hr
Show total cost range for the project.

## 🏁 Definition of Done
Per feature: what "done" actually means (acceptance criteria template).

---
⚠️ These are estimates. Add buffer for PR reviews, QA, deployment, and unexpected complexity.`;

    let result = "";
    try {
        result = await callAI([{ role: "user", content: prompt }], opts);
        aiSpinner.stop();
    } catch (err) {
        aiSpinner.stop();
        console.log(chalk.red("  AI call failed: " + err.message));
        process.exit(1);
    }

    console.log(`\n  ${BRAND.bold("📅 Sprint Estimation Report")} ${chalk.dim(`· ${providerName}`)}\n`);
    console.log(result.split("\n").map((l) => "  " + l).join("\n"));
    console.log(chalk.dim("\n  ⚠️  Add 20-30% buffer for reviews, QA, unexpected complexity. Estimates are AI-generated.\n"));

    // Save
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `estimate-${timestamp}.md`);

    const md = `# 📅 Sprint Estimation Report — ${scan.name}

> **Team:** ${answers.teamSize} dev(s) · ${answers.seniority} · ${answers.hoursPerWeek}h/wk
> **Methodology:** ${answers.methodology} · **Buffer:** ${answers.riskTolerance}%
> **Features:** ${featureList}
> **AI Agent:** ${providerName}
> **Generated:** ${new Date().toISOString().slice(0, 19)}
> ⚠️ *These are AI-generated estimates. Add buffer for reviews, QA, and unknowns. Validate with your team.*

---

${result}

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit estimate\`*
`;

    fs.writeFileSync(outputFile, md);
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
}

function _getVelocityFactor(seniority, teamSize) {
    const base = seniority.includes("Junior") ? 0.6 : seniority.includes("Senior") ? 1.0 : 0.8;
    const teamFactor = teamSize === 1 ? 1.0 : teamSize <= 3 ? 0.9 : 0.75; // coordination overhead
    return base * teamFactor;
}

module.exports = estimateCommand;
