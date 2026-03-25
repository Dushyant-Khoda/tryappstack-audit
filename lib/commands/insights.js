const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

const CATEGORY_ICON = {
    Security:           "🔐",
    "API Quality":      "🌐",
    "Error Handling":   "⚡",
    "Code Quality":     "📝",
    "Component Quality": "🧩",
    Architecture:       "🏗",
    Config:             "⚙️",
    TypeScript:         "🔷",
    Documentation:      "📚",
};

async function insightsCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    const hasAI = !!key;
    const providerName = hasAI ? getProviderName(opts) : null;

    console.log(
        `\n  ${chalk.bold("🧠 Code Intelligence")} ` +
        (hasAI ? chalk.dim(`· ${providerName}`) : chalk.dim("· static scan only  (run ai-setup to unlock AI analysis)"))
    );

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, issues, features, routes, components, tech } = scan;
    const critical = issues.filter((i) => i.severity === "critical");
    const warnings  = issues.filter((i) => i.severity === "warning");
    const infos     = issues.filter((i) => i.severity === "info");

    // Production-readiness score
    const deductions = critical.length * 15 + warnings.length * 5 + Math.min(infos.length, 10) * 1;
    const score = Math.max(0, Math.min(100, 100 - deductions));
    const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
    const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

    console.log(`\n  ${chalk.bold("Framework:")} ${framework.name}  ${chalk.bold("Files:")} ${scan.scannedFiles}  ${chalk.bold("Routes:")} ${routes.length}  ${chalk.bold("Components:")} ${components.length}\n`);
    console.log(`  ${chalk.bold("Production Readiness:")} ${scoreColor.bold(score + "/100")} (Grade ${grade})`);
    console.log(`  ${chalk.red.bold(critical.length + " critical")} · ${chalk.yellow(warnings.length + " warnings")} · ${chalk.dim(infos.length + " info")}\n`);

    // Display critical
    if (critical.length > 0) {
        console.log(`  ${chalk.red.bold("🚨 Critical  —  fix before shipping")}`);
        for (const issue of critical.slice(0, 12)) {
            const loc = issue.file ? chalk.dim(` [${issue.file}${issue.line ? ":" + issue.line : ""}]`) : "";
            console.log(`  ${chalk.red("✗")} ${issue.message}${loc}`);
        }
        console.log("");
    }

    // Display warnings
    if (warnings.length > 0) {
        console.log(`  ${chalk.yellow.bold("⚠  Warnings")}`);
        for (const issue of warnings.slice(0, 12)) {
            const loc = issue.file ? chalk.dim(` [${issue.file}${issue.line ? ":" + issue.line : ""}]`) : "";
            const icon = CATEGORY_ICON[issue.category] || "•";
            console.log(`  ${chalk.yellow("!")} ${icon} ${issue.message}${loc}`);
        }
        console.log("");
    }

    // Display info (collapsed unless --verbose)
    if (infos.length > 0) {
        if (opts.verbose) {
            console.log(`  ${chalk.dim.bold("ℹ  Info")}`);
            for (const issue of infos.slice(0, 10)) {
                const loc = issue.file ? chalk.dim(` [${issue.file}]`) : "";
                console.log(`  ${chalk.dim("·")} ${issue.message}${loc}`);
                if (issue.examples) {
                    for (const ex of issue.examples) console.log(chalk.dim(`    → ${ex}`));
                }
            }
            console.log("");
        } else {
            console.log(chalk.dim(`  ℹ  ${infos.length} info items hidden — run with --verbose to show\n`));
        }
    }

    // AI enhancement
    let aiSection = "";
    if (hasAI) {
        const aiSpinner = ora({ text: `  Running AI deep analysis (${providerName})...`, color: "yellow" }).start();

        const issuesSummary = [
            ...critical.map((i) => `[CRITICAL] ${i.category}: ${i.message}`),
            ...warnings.map((i) => `[WARNING] ${i.category}: ${i.message}`),
        ].slice(0, 25).join("\n");

        const prompt = `You are a senior engineer at Vercel reviewing a ${framework.name} project called "${scan.name}".

Tech stack: ${tech.join(", ") || "unknown"}
Features: ${features.map((f) => f.name + (f.detail ? " (" + f.detail + ")" : "")).join(", ") || "none detected"}
Routes: ${routes.length} total (${routes.filter((r) => r.type === "api").length} API, ${routes.filter((r) => r.type === "page").length} pages)
Components: ${components.length}${components.filter((c) => c.large).length > 0 ? ` (${components.filter((c) => c.large).length} oversized)` : ""}

Static analysis found:
${issuesSummary || "No issues found"}

Provide a senior engineer's code review in this exact format:

## 🎯 Priority Fixes (Top 5)
Ranked by impact. For each: what to fix, why it matters in production, exact package or pattern to use.

## 🕵️ Hidden Risks
Issues that look minor but cause production outages or security breaches at scale in ${framework.name} apps. Think like an on-call SRE.

## ⚡ Quick Wins (under 30 minutes each)
3 specific changes with highest ROI for the time invested.

## 🏗 Architecture Red Flags
Patterns that will cause pain at 10x the current load or team size.

## 🚀 Production Checklist
5 things this ${framework.name} app MUST have before going live that aren't yet detected.

Be laser-specific. Reference actual issues. No generic "add error handling" advice — say exactly which file/pattern.`;

        try {
            aiSection = await callAI([{ role: "user", content: prompt }], opts);
            aiSpinner.stop();
            console.log(`  ${BRAND.bold("🤖 AI Deep Analysis")} ${chalk.dim(`· ${providerName}`)}\n`);
            console.log(aiSection.split("\n").map((l) => "  " + l).join("\n"));
            console.log("");
        } catch (err) {
            aiSpinner.stop();
            if (!err.noKey) console.log(chalk.dim(`  AI unavailable: ${err.message}\n`));
        }
    } else {
        console.log(
            chalk.dim("  💡 Add AI for: priority ranking, hidden risk detection, production checklist\n") +
            chalk.dim("  Run: ") + BRAND("npx tryappstack-audit ai-setup") + "\n"
        );
    }

    // Save report
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `insights-${timestamp}.md`);
    fs.writeFileSync(outputFile, _buildReport(scan, issues, score, grade, aiSection, providerName));
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
}

function _buildReport(scan, issues, score, grade, aiSection, providerName) {
    const critical = issues.filter((i) => i.severity === "critical");
    const warnings  = issues.filter((i) => i.severity === "warning");
    const infos     = issues.filter((i) => i.severity === "info");

    const byCategory = {};
    for (const issue of issues) {
        (byCategory[issue.category] = byCategory[issue.category] || []).push(issue);
    }

    let md = `# 🧠 Code Intelligence Report — ${scan.name}

> **Framework:** ${scan.framework.name}
> **Production Readiness:** ${score}/100 (Grade ${grade})
> **Files Scanned:** ${scan.scannedFiles}
> **Generated:** ${new Date().toISOString().slice(0, 19)}
${providerName ? `> **AI Agent:** ${providerName}` : ""}

---

## 📊 Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${critical.length} |
| 🟡 Warning | ${warnings.length} |
| 🔵 Info | ${infos.length} |

`;

    if (aiSection) {
        md += `## 🤖 AI Analysis\n\n${aiSection}\n\n---\n\n`;
    }

    md += `## 🔍 All Issues\n\n`;
    for (const [cat, catIssues] of Object.entries(byCategory)) {
        const icon = CATEGORY_ICON[cat] || "•";
        md += `### ${icon} ${cat}\n\n`;
        for (const issue of catIssues) {
            const dot = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
            const loc = issue.file ? ` — \`${issue.file}${issue.line ? ":" + issue.line : ""}\`` : "";
            md += `- ${dot} ${issue.message}${loc}\n`;
            if (issue.examples) {
                for (const ex of issue.examples) md += `  - \`${ex}\`\n`;
            }
        }
        md += "\n";
    }

    md += `---\n\n*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit insights\`*\n`;
    return md;
}

module.exports = insightsCommand;
