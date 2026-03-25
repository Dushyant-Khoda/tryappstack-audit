const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { extractScoresFromReport } = require("../utils/helpers");

function compareCommand(file1, file2) {
    for (const f of [file1, file2]) { if (!fs.existsSync(f)) { console.log(chalk.red(`  ✗ Not found: ${f}`)); process.exit(1); } }
    const s1 = extractScoresFromReport(fs.readFileSync(file1, "utf8"));
    const s2 = extractScoresFromReport(fs.readFileSync(file2, "utf8"));
    console.log(`\n  ${chalk.bold("📊 Audit Comparison")}`);
    console.log(chalk.dim(`  ${path.basename(file1)} → ${path.basename(file2)}\n`));
    const all = [...new Set([...Object.keys(s1), ...Object.keys(s2)])].sort();
    for (const mod of all) {
        const a = s1[mod] || 0, b = s2[mod] || 0, d = b - a;
        const arrow = d > 0 ? chalk.green(`↑ +${d}`) : d < 0 ? chalk.red(`↓ ${d}`) : chalk.dim("= 0");
        console.log(`  ${mod.padEnd(20)} ${String(a).padStart(3)} → ${String(b).padStart(3)}  ${arrow}`);
    }
    const avg1 = Object.values(s1).reduce((a, b) => a + b, 0) / (Object.keys(s1).length || 1);
    const avg2 = Object.values(s2).reduce((a, b) => a + b, 0) / (Object.keys(s2).length || 1);
    const td = Math.round(avg2 - avg1);
    console.log(`\n  ${chalk.bold(`Overall: ${Math.round(avg1)} → ${Math.round(avg2)}`)} ${td > 0 ? chalk.green.bold(`↑ +${td}`) : td < 0 ? chalk.red.bold(`↓ ${td}`) : chalk.dim("No change")}\n`);
}

module.exports = compareCommand;
