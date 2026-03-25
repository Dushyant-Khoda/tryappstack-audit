const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

function badgeCommand(directory) {
    const dir = path.resolve(directory);
    const auditsDir = path.join(dir, "audits");
    const files = fs.existsSync(auditsDir) ? fs.readdirSync(auditsDir).filter((f) => f.endsWith(".md")).sort() : [];
    let score = "?", color = "lightgrey";
    if (files.length > 0) {
        const c = fs.readFileSync(path.join(auditsDir, files[files.length - 1]), "utf8");
        const m = c.match(/\*\*Score:\*\*\s*\*\*(\d+)\/100/);
        if (m) { score = m[1]; const s = parseInt(score); color = s >= 80 ? "brightgreen" : s >= 60 ? "yellow" : "red"; }
    }
    const url = `https://img.shields.io/badge/audit%20score-${score}%2F100-${color}`;
    console.log(`\n  ${chalk.bold("🏷  Audit Badge")}\n`);
    console.log(`  ${chalk.dim("Markdown:")}`);
    console.log(`  ${chalk.hex("#c8ff00")(`[![Audit Score](${url})](./audits/)`)}\n`);
    console.log(`  ${chalk.dim("HTML:")}`);
    console.log(`  ${chalk.dim(`<img src="${url}" alt="Audit Score">`)}\n`);
}

module.exports = badgeCommand;
