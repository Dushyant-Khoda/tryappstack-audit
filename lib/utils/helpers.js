const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const { GENERIC, PREFIX } = require("../constants");

/**
 * Verify we're inside a JS/TS project by checking for package.json.
 */
function ensureInsideProject(dir) {
    const pkgPath = path.resolve(dir, "package.json");
    if (!fs.existsSync(pkgPath)) {
        console.log(chalk.red(`\n${PREFIX.ERROR}${GENERIC.NOT_A_PROJECT}`));
        console.log(chalk.gray(`   Checked: ${dir}\n`));
        process.exit(1);
    }
}

/**
 * Check if bash is available on the system.
 */
function hasBash() {
    const { execSync } = require("child_process");
    if (os.platform() === "win32") return false;
    try {
        execSync("which bash", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if WSL is available (Windows only).
 */
function hasWSL() {
    const { execSync } = require("child_process");
    if (os.platform() !== "win32") return false;
    try {
        execSync("where wsl", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/**
 * Load AI config from ~/.tryappstack/config or env vars.
 */
function loadAIConfig(opts = {}) {
    let provider = opts.aiProvider || "claude";
    let key = opts.aiKey || "";
    let model = opts.aiModel || "";

    // Global config
    const configPath = path.join(os.homedir(), ".tryappstack", "config");
    if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf8");
        const pMatch = content.match(/AI_PROVIDER="(\w+)"/);
        const kMatch = content.match(/AI_KEY="([^"]+)"/);
        const mMatch = content.match(/AI_MODEL="([^"]+)"/);
        if (pMatch && !opts.aiProvider) provider = pMatch[1];
        if (kMatch && !opts.aiKey) key = kMatch[1];
        if (mMatch && !opts.aiModel) model = mMatch[1];
    }

    // Env vars (highest priority after explicit flag)
    if (!key && process.env.OPENAI_API_KEY) { key = process.env.OPENAI_API_KEY; provider = "openai"; }
    if (!key && process.env.ANTHROPIC_API_KEY) { key = process.env.ANTHROPIC_API_KEY; provider = "claude"; }
    if (!key && process.env.XAI_API_KEY) { key = process.env.XAI_API_KEY; provider = "grok"; }
    if (!model && process.env.AI_MODEL) model = process.env.AI_MODEL;

    return { provider, key, model };
}

/**
 * Returns the AI connection status for premium banner display.
 * { connected: bool, provider, model, displayName }
 */
function getAIStatus() {
    const configPath = path.join(os.homedir(), ".tryappstack", "config");
    if (!fs.existsSync(configPath)) return { connected: false };
    try {
        const content = fs.readFileSync(configPath, "utf8");
        const pMatch = content.match(/AI_PROVIDER="(\w+)"/);
        const kMatch = content.match(/AI_KEY="([^"]+)"/);
        const mMatch = content.match(/AI_MODEL="([^"]+)"/);
        if (!pMatch || !kMatch) return { connected: false };
        const provider = pMatch[1];
        const model = mMatch ? mMatch[1] : "";
        const icons = {
            claude: "🟣", anthropic: "🟣",
            openai: "🟢", gpt: "🟢",
            grok: "🔵", xai: "🔵",
            gemini: "🟡", google: "🟡",
            deepseek: "🔴",
        };
        const names = {
            claude: "Claude", anthropic: "Claude",
            openai: "GPT", gpt: "GPT",
            grok: "Grok", xai: "Grok",
            gemini: "Gemini", google: "Gemini",
            deepseek: "DeepSeek",
        };
        return {
            connected: true,
            provider,
            model,
            icon: icons[provider] || "🤖",
            displayName: `${icons[provider] || "🤖"} ${names[provider] || provider}${model ? " · " + model : ""}`,
        };
    } catch { return { connected: false }; }
}

/**
 * Extract scores from a markdown audit report.
 */
function extractScoresFromReport(content) {
    const scores = {};
    const re = /\|\s*[🟢🟡🔴]\s*(.+?)\s*\|\s*\*\*(\d+)\*\*\/100\s*\|/g;
    let m;
    while ((m = re.exec(content))) scores[m[1].trim()] = parseInt(m[2]);
    return scores;
}

/**
 * Print the AI comparison table.
 */
function printAIComparison() {
    const { AI_COMPARISON } = require("../constants");
    console.log("  ┌──────────────────────────────────────────────────────────────┐");
    console.log("  │  " + chalk.bold("Without AI") + "                  │  " + chalk.hex("#c8ff00").bold("With AI ✨") + "                    │");
    console.log("  ├──────────────────────────────────────────────────────────────┤");
    for (let i = 0; i < AI_COMPARISON.WITHOUT.length; i++) {
        const left = (AI_COMPARISON.WITHOUT[i] || "").padEnd(30);
        const right = (AI_COMPARISON.WITH[i] || "").padEnd(27);
        console.log(`  │  ${left}│  ${right}│`);
    }
    console.log("  └──────────────────────────────────────────────────────────────┘");
    console.log("");
    console.log("  " + chalk.dim("Setup AI: ") + chalk.hex("#c8ff00")("npx tas-audit ai-setup"));
    console.log("");
}

/**
 * Find the latest audit report .md file in ./audits/.
 * Returns { file, content } or null if none found.
 */
function getLatestReport(directory) {
    const auditsDir = path.resolve(directory, "audits");
    if (!fs.existsSync(auditsDir)) return null;

    const files = fs
        .readdirSync(auditsDir)
        .filter((f) => f.endsWith(".md") && f.startsWith("audit-"))
        .sort();

    if (files.length === 0) return null;

    const file = path.join(auditsDir, files[files.length - 1]);
    return { file, content: fs.readFileSync(file, "utf8"), filename: files[files.length - 1] };
}

/**
 * Extract project name, framework, overall score from a report.
 */
function extractProjectInfo(content) {
    const project = content.match(/\*\*Project:\*\*\s*(.+)/)?.[1]?.trim() || "Unknown";
    const framework = content.match(/\*\*Framework:\*\*\s*(.+)/)?.[1]?.trim() || "Unknown";
    const scoreMatch = content.match(/\*\*Score:\*\*\s*\*\*(\d+)\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
    const date = content.match(/\*\*Date:\*\*\s*(.+)/)?.[1]?.trim() || "";
    return { project, framework, score, date };
}

/**
 * Strip likely secrets/keys from file content before sending to AI.
 */
function sanitizeForAI(content) {
    return content
        .replace(/(['"`])[A-Za-z0-9_\-]{20,}(['"`])/g, "$1[REDACTED]$2")
        .replace(/\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASS|PWD|API|AUTH)\s*=\s*[^\n]+/g, "[REDACTED]")
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]");
}

module.exports = {
    ensureInsideProject,
    hasBash,
    hasWSL,
    loadAIConfig,
    getAIStatus,
    extractScoresFromReport,
    printAIComparison,
    getLatestReport,
    extractProjectInfo,
    sanitizeForAI,
};
