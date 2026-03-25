const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { extractScoresFromReport } = require("../utils/helpers");

function trendCommand(directory) {
    const dir = path.resolve(directory);
    const auditsDir = path.join(dir, "audits");
    if (!fs.existsSync(auditsDir)) { console.log(chalk.yellow("\n  ⚠ No audits/ directory.\n")); process.exit(1); }
    const files = fs.readdirSync(auditsDir).filter((f) => f.endsWith(".md") && f.startsWith("audit-")).sort();
    if (files.length < 1) { console.log(chalk.yellow("\n  ⚠ No audit reports found.\n")); process.exit(1); }
    console.log(`\n  ${chalk.bold("📈 Score Trend")} ${chalk.dim(`(${files.length} reports)`)}\n`);
    let prev = null;
    for (const f of files) {
        const content = fs.readFileSync(path.join(auditsDir, f), "utf8");
        const m = content.match(/\*\*Score:\*\*\s*\*\*(\d+)\/100/);
        if (!m) continue;
        const score = parseInt(m[1]);
        const date = (f.match(/audit-(\d{4}-\d{2}-\d{2})/) || [, f])[1];
        const bar = "█".repeat(Math.round((score / 100) * 30)) + "░".repeat(30 - Math.round((score / 100) * 30));
        const sc = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
        const diff = prev !== null ? score - prev : 0;
        const arrow = diff > 0 ? chalk.green(` ↑+${diff}`) : diff < 0 ? chalk.red(` ↓${diff}`) : chalk.dim(" =");
        console.log(`  ${chalk.dim(date)}  ${sc(bar)}  ${sc.bold(String(score).padStart(3))}${arrow}`);
        prev = score;
    }
    console.log("");
}

module.exports = trendCommand;
