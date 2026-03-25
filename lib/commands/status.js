/**
 * status — quick project health check
 *
 * Shows:
 *   - Package version
 *   - AI provider + model (key masked)
 *   - Pre-push hook installed?
 *   - Last audit score + date
 *   - tas-memory.md exists?
 *   - .tasrc exists?
 *   - audits/ directory count
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const chalk = require("chalk");
const pkg   = require("../../package.json");

const BRAND = chalk.hex("#c8ff00");
const DIM   = chalk.dim;
const OK    = chalk.green("✓");
const WARN  = chalk.yellow("!");
const FAIL  = chalk.red("✗");

function statusCommand(dir) {
    const projectDir = path.resolve(dir || ".");

    console.log(`\n  ${BRAND.bold("tryappstack-audit")}  ${DIM("v" + pkg.version)}\n`);

    // ── AI config ─────────────────────────────────────────────────────────────
    const configPath = path.join(os.homedir(), ".tryappstack", "config");
    let aiProvider = null;
    let aiModel    = null;
    let aiKey      = null;

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, "utf8");
            aiProvider = raw.match(/AI_PROVIDER="(\w+)"/)?.[1] || null;
            aiModel    = raw.match(/AI_MODEL="([^"]+)"/)?.[1]  || null;
            aiKey      = raw.match(/AI_KEY="([^"]+)"/)?.[1]    || null;
        } catch { /* ignore */ }
    }

    if (aiProvider && aiKey) {
        const maskedKey = aiKey.slice(0, 6) + "..." + aiKey.slice(-4);
        console.log(`  ${OK}  AI configured`);
        console.log(`     ${DIM("Provider:")} ${chalk.cyan(aiProvider)}  ${DIM("Model:")} ${chalk.cyan(aiModel || "default")}`);
        console.log(`     ${DIM("Key:")} ${DIM(maskedKey)}`);
    } else {
        console.log(`  ${WARN}  AI not configured`);
        console.log(`     ${DIM("Run:")} ${BRAND("tas-audit ai-setup")}`);
    }

    // ── .tasrc ────────────────────────────────────────────────────────────────
    const tasrcPath = path.join(projectDir, ".tasrc");
    if (fs.existsSync(tasrcPath)) {
        try {
            const rc = JSON.parse(fs.readFileSync(tasrcPath, "utf8"));
            const rcProvider = rc.provider || "(default)";
            const rcModel    = rc.model    || "(default)";
            console.log(`\n  ${OK}  .tasrc found`);
            console.log(`     ${DIM("Provider:")} ${chalk.cyan(rcProvider)}  ${DIM("Model:")} ${chalk.cyan(rcModel)}`);
            if (rc.budget) {
                console.log(`     ${DIM("Budget:")} daily $${rc.budget.daily} · monthly $${rc.budget.monthly}`);
            }
            if (rc.profiles && Object.keys(rc.profiles).length > 0) {
                console.log(`     ${DIM("Profiles:")} ${Object.keys(rc.profiles).join(" · ")}`);
            }
        } catch {
            console.log(`\n  ${WARN}  .tasrc found but could not be parsed (check JSON syntax)`);
        }
    } else {
        console.log(`\n  ${DIM("–")}  No .tasrc in this project`);
        console.log(`     ${DIM("Create one:")} ${BRAND("tas-audit team")} then ${BRAND("/init-config")}`);
    }

    // ── tas-memory.md ─────────────────────────────────────────────────────────
    const memPath = path.join(projectDir, "tas-memory.md");
    if (fs.existsSync(memPath)) {
        const memContent = fs.readFileSync(memPath, "utf8");
        const factCount  = memContent.split("\n").filter((l) => l.trim().startsWith("-")).length;
        console.log(`\n  ${OK}  tas-memory.md found  ${DIM("(" + factCount + " facts)")}`);
    } else {
        console.log(`\n  ${DIM("–")}  No tas-memory.md  ${DIM("(use /remember inside team REPL to create one)")}`);
    }

    // ── Pre-push hook ─────────────────────────────────────────────────────────
    const hookPath = path.join(projectDir, ".git", "hooks", "pre-push");
    if (fs.existsSync(hookPath)) {
        const hookContent = fs.readFileSync(hookPath, "utf8");
        const hasTas = hookContent.includes("tryappstack-audit") || hookContent.includes("tas-audit");
        if (hasTas) {
            console.log(`\n  ${OK}  Pre-push hook installed`);
        } else {
            console.log(`\n  ${WARN}  .git/hooks/pre-push exists but does not reference tas-audit`);
        }
    } else {
        console.log(`\n  ${DIM("–")}  No pre-push hook  ${DIM("(run tas-audit hook to install one)")}`);
    }

    // ── Last audit report ──────────────────────────────────────────────────────
    const auditsDir = path.join(projectDir, "audits");
    if (fs.existsSync(auditsDir)) {
        const reports = fs.readdirSync(auditsDir)
            .filter((f) => f.startsWith("audit-") && f.endsWith(".md"))
            .sort()
            .reverse();

        if (reports.length > 0) {
            const latest = reports[0];
            const latestPath = path.join(auditsDir, latest);
            let score = null;
            try {
                const content = fs.readFileSync(latestPath, "utf8");
                const m = content.match(/Overall[^\d]*(\d{1,3})\/100/);
                if (m) score = parseInt(m[1]);
            } catch { /* ignore */ }

            const scoreStr = score !== null
                ? (score >= 80 ? chalk.green(score + "/100") : score >= 60 ? chalk.yellow(score + "/100") : chalk.red(score + "/100"))
                : DIM("(score not found)");

            console.log(`\n  ${OK}  Last audit: ${chalk.cyan(latest.replace("audit-", "").replace(".md", ""))}  Score: ${scoreStr}`);
            console.log(`     ${DIM(reports.length + " report(s) in audits/")}`);
        } else {
            console.log(`\n  ${DIM("–")}  audits/ exists but no audit reports found`);
            console.log(`     ${DIM("Run:")} ${BRAND("tas-audit")}`);
        }
    } else {
        console.log(`\n  ${WARN}  No audits/ directory found`);
        console.log(`     ${DIM("Run:")} ${BRAND("tas-audit init")} then ${BRAND("tas-audit")}`);
    }

    // ── Quick actions ─────────────────────────────────────────────────────────
    console.log(`\n  ${DIM("─".repeat(52))}`);
    console.log(`  ${DIM("Quick actions:")}`);
    if (!aiProvider) console.log(`    ${BRAND("tas-audit ai-setup")}        set up AI provider`);
    console.log(`    ${BRAND("tas-audit")}                 run the audit`);
    console.log(`    ${BRAND("tas-audit team")}            open AI team REPL`);
    console.log(`    ${BRAND("tas-audit show-template")}   preview command output`);
    console.log(`    ${BRAND("tas-audit help")}            full command reference`);
    console.log("");
}

module.exports = statusCommand;
