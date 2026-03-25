/**
 * TAS gitignore guard
 *
 * - Auto-adds sensitive/generated TAS files to .gitignore
 * - Detects if API keys or secrets are present in project config files
 * - Shows a clear warning if credentials are at risk of being committed
 *
 * Rules:
 *   tas-bundle.json  → always ignore (exported bundle, has project context)
 *   .tasrc           → SAFE to track ONLY if it has no "key" field
 *   tas-memory.md    → safe to track (facts only, no credentials)
 *   .tryappstack/    → ignore if accidentally in project dir (global dir)
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");

// Files that should always be in .gitignore if present in the project
const ALWAYS_IGNORE = [
    "tas-bundle.json",       // exported config bundle
    ".tryappstack/",         // global config dir (if somehow in project)
];

// Files that are SAFE to track but should warn if they contain keys
const WARN_IF_KEY = [
    ".tasrc",
];

// Patterns that indicate an API key or secret is present in a JSON file
const SECRET_PATTERNS = [
    /"key"\s*:\s*"[a-zA-Z0-9_\-]{8,}"/,
    /"api_key"\s*:\s*"[a-zA-Z0-9_\-]{8,}"/,
    /"apiKey"\s*:\s*"[a-zA-Z0-9_\-]{8,}"/,
    /"secret"\s*:\s*"[a-zA-Z0-9_\-]{8,}"/,
    /"token"\s*:\s*"[a-zA-Z0-9_\-]{8,}"/,
    /sk-[a-zA-Z0-9]{20,}/,           // OpenAI / DeepSeek style
    /sk-ant-[a-zA-Z0-9\-]{20,}/,     // Anthropic style
    /xai-[a-zA-Z0-9]{20,}/,          // Grok/xAI style
    /AIza[a-zA-Z0-9_\-]{35}/,        // Google API key style
];

// ── .gitignore management ─────────────────────────────────────────────────────

/**
 * Read current .gitignore entries (returns Set of trimmed non-comment lines).
 */
function readGitignore(dir) {
    const giPath = path.join(dir, ".gitignore");
    if (!fs.existsSync(giPath)) return { entries: new Set(), path: giPath, exists: false };
    const lines = fs.readFileSync(giPath, "utf8").split("\n");
    const entries = new Set(lines.map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    return { entries, path: giPath, exists: true };
}

/**
 * Ensure entries are present in .gitignore.
 * Returns { added: string[], alreadyPresent: string[] }
 */
function ensureGitignore(dir, entriesToAdd) {
    const { entries, path: giPath, exists } = readGitignore(dir);
    const added = [];

    for (const entry of entriesToAdd) {
        if (!entries.has(entry)) {
            added.push(entry);
            entries.add(entry);
        }
    }

    if (added.length > 0) {
        const existing = exists ? fs.readFileSync(giPath, "utf8") : "";
        const newBlock = `\n# TAS Audit — auto-added\n${added.join("\n")}\n`;
        fs.writeFileSync(giPath, existing.trimEnd() + newBlock);
    }

    return { added, alreadyPresent: entriesToAdd.filter((e) => !added.includes(e)) };
}

// ── Credential scanner ────────────────────────────────────────────────────────

/**
 * Scan a file for API keys or secret patterns.
 * Returns array of matched patterns (sanitized — shows only first 6 + ***).
 */
function scanForSecrets(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf8");
    const found = [];

    for (const pattern of SECRET_PATTERNS) {
        const m = content.match(pattern);
        if (m) {
            // Sanitize: show only first 6 chars + ***
            const raw = m[0];
            const sanitized = raw.slice(0, Math.min(raw.indexOf(":") + 8, raw.length)) + "***";
            found.push(sanitized);
        }
    }

    return found;
}

/**
 * Scan all WARN_IF_KEY files in a directory for secrets.
 * Returns { file, secrets }[] for any that have issues.
 */
function scanProjectForSecrets(dir) {
    const issues = [];
    for (const file of WARN_IF_KEY) {
        const filePath = path.join(dir, file);
        const secrets = scanForSecrets(filePath);
        if (secrets.length > 0) {
            issues.push({ file, filePath, secrets });
        }
    }
    return issues;
}

// ── Main guard ────────────────────────────────────────────────────────────────

/**
 * Run all guards on startup:
 * 1. Auto-add ALWAYS_IGNORE entries to .gitignore
 * 2. Scan for secrets in tracked config files
 * 3. Print warnings for any issues found
 *
 * Returns { gitignoreAdded, secretIssues }
 */
function runGitignoreGuard(dir) {
    // Only run if this is a git repo or has package.json (i.e. a real project)
    const hasGit = fs.existsSync(path.join(dir, ".git"));
    const hasPkg = fs.existsSync(path.join(dir, "package.json"));
    if (!hasGit && !hasPkg) return { gitignoreAdded: [], secretIssues: [] };

    // 1. Auto-add always-ignore entries
    let gitignoreAdded = [];
    try {
        const result = ensureGitignore(dir, ALWAYS_IGNORE);
        gitignoreAdded = result.added;
    } catch { /* ignore if no write permission */ }

    // 2. Scan for secrets
    const secretIssues = scanProjectForSecrets(dir);

    // 3. Print results
    if (gitignoreAdded.length > 0) {
        console.log(`  ${chalk.dim("🔒 .gitignore:")} ${chalk.dim("Auto-added:")} ${chalk.yellow(gitignoreAdded.join(", "))}`);
    }

    if (secretIssues.length > 0) {
        printSecretWarning(secretIssues, dir);
    }

    return { gitignoreAdded, secretIssues };
}

// ── Display ───────────────────────────────────────────────────────────────────

function printSecretWarning(issues, dir) {
    console.log(`\n  ${chalk.red.bold("⚠  CREDENTIAL EXPOSURE WARNING")}\n`);
    console.log(`  ${chalk.red("API keys or secrets detected in project files.")}`);
    console.log(`  ${chalk.red("These files could expose your credentials if committed to git.\n")}`);

    for (const { file, filePath } of issues) {
        console.log(`  ${chalk.red("✗")} ${chalk.bold(file)} ${chalk.dim(filePath)}`);
    }

    console.log(`\n  ${chalk.yellow("Recommended actions:")}`);
    console.log(`  ${chalk.dim("1.")} Remove the key from the file — use env vars instead:`);
    console.log(`     ${chalk.cyan("export ANTHROPIC_API_KEY=sk-ant-...")}`);
    console.log(`     ${chalk.cyan("export OPENAI_API_KEY=sk-...")}`);
    console.log(`     ${chalk.cyan("export XAI_API_KEY=xai-...")}`);
    console.log(`     ${chalk.cyan("export GEMINI_API_KEY=AIza...")}`);
    console.log(`     ${chalk.cyan("export DEEPSEEK_API_KEY=sk-...")}`);
    console.log(`  ${chalk.dim("2.")} Or run: ${BRAND("tas-audit ai-setup")} — stores key globally in ~/`);
    console.log(`     ${chalk.dim("(never in your project directory)")}`);
    console.log(`\n  ${chalk.dim("Add to .gitignore to suppress this warning if intentional:")}`);
    for (const { file } of issues) {
        console.log(`     ${chalk.dim(file)}`);
    }
    console.log("");
}

/**
 * Print a one-time notice about where TAS stores sensitive data.
 * Call during ai-setup or first run.
 */
function printStoragePolicy() {
    console.log(`\n  ${BRAND.bold("🔒 TAS Security Policy")}\n`);
    const rows = [
        ["API keys",      "~/.tryappstack/config",    "Your home dir — never in project"],
        [".tasrc",        "./  (project root)",        "Safe to git track — no keys stored here"],
        ["tas-memory.md", "./  (project root)",        "Safe to git track — facts only"],
        ["tas-bundle.json","./  (project root)",       "Auto-added to .gitignore on creation"],
        ["Session logs",  "/tmp/tas-audit/",           "OS temp — auto-deleted, never committed"],
        ["Sessions/prompts","~/.tryappstack/",         "Your home dir — never in project"],
    ];

    const colW = [18, 28];
    for (const [what, where, note] of rows) {
        console.log(
            `  ${chalk.dim(what.padEnd(colW[0]))} ${chalk.cyan(where.padEnd(colW[1]))} ${chalk.dim(note)}`
        );
    }
    console.log("");
}

module.exports = {
    ensureGitignore,
    scanForSecrets,
    scanProjectForSecrets,
    runGitignoreGuard,
    printSecretWarning,
    printStoragePolicy,
    ALWAYS_IGNORE,
};
