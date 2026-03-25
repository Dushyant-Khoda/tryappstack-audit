/**
 * Project memory — tas-memory.md
 *
 * A plain-text file in the project root (or ~/.tryappstack/memory/<slug>.md)
 * that gets auto-injected into every AI session.
 *
 * - /remember "fact" → appends to memory
 * - /memory          → shows current memory
 * - /forget <line>   → removes a specific fact
 * - Auto-injected into system prompt on every AI call
 * - Works with any provider — same tas-memory.md across Claude, GPT, Gemini
 * - Git-trackable (stored in project root as tas-memory.md)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

const MEMORY_FILE = "tas-memory.md";
const BRAND = chalk.hex("#c8ff00");

// ── Paths ─────────────────────────────────────────────────────────────────────

function getMemoryPath(dir) {
    // Prefer project-local memory file (git-trackable)
    const local = path.join(dir, MEMORY_FILE);
    if (fs.existsSync(local)) return local;

    // Fall back to global memory keyed by project name
    const pkg = path.join(dir, "package.json");
    let slug = "default";
    if (fs.existsSync(pkg)) {
        try { slug = JSON.parse(fs.readFileSync(pkg, "utf8")).name?.replace(/[^a-z0-9-]/g, "-") || "default"; }
        catch { /* ignore */ }
    }
    return path.join(os.homedir(), ".tryappstack", "memory", `${slug}.md`);
}

// ── Read / Write ──────────────────────────────────────────────────────────────

function loadMemory(dir) {
    const p = getMemoryPath(dir);
    if (!fs.existsSync(p)) return null;
    try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function saveMemory(dir, content) {
    const p = getMemoryPath(dir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
}

// ── Remember ──────────────────────────────────────────────────────────────────

/**
 * Append a fact to memory.
 * Creates the file with a template if it doesn't exist.
 */
function remember(dir, fact) {
    const p = getMemoryPath(dir);
    let content = "";

    if (fs.existsSync(p)) {
        content = fs.readFileSync(p, "utf8");
    } else {
        // Create with template
        const pkg = path.join(dir, "package.json");
        let name = "this project";
        try { name = JSON.parse(fs.readFileSync(pkg, "utf8")).name || name; } catch { /* ignore */ }
        content = `# TAS Memory — ${name}\n\n## Key Facts\n\n## Architecture\n\n## Conventions\n\n## Decisions\n\n`;
        fs.mkdirSync(path.dirname(p), { recursive: true });
    }

    const ts = new Date().toISOString().slice(0, 10);
    const entry = `- ${fact}  _(${ts})_\n`;

    // Append under "## Key Facts" if it exists, otherwise append at end
    if (content.includes("## Key Facts")) {
        content = content.replace(
            /(## Key Facts\n)/,
            `$1${entry}`
        );
    } else {
        content += `\n${entry}`;
    }

    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
}

/**
 * Remove a line from memory by partial match.
 */
function forget(dir, match) {
    const p = getMemoryPath(dir);
    if (!fs.existsSync(p)) return false;

    const lines = fs.readFileSync(p, "utf8").split("\n");
    const filtered = lines.filter((l) => !l.toLowerCase().includes(match.toLowerCase()));

    if (filtered.length === lines.length) return false; // nothing removed

    fs.writeFileSync(p, filtered.join("\n"));
    return true;
}

// ── Inject into system prompt ─────────────────────────────────────────────────

/**
 * Returns the memory content formatted as a system prompt injection.
 * Returns null if no memory exists.
 */
function getMemoryInjection(dir) {
    const content = loadMemory(dir);
    if (!content || !content.trim()) return null;

    // Strip markdown headers for conciser injection, keep facts
    const compact = content
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"))
        .join("\n")
        .trim();

    if (!compact) return null;

    return `\nTAS PROJECT MEMORY (always respect these facts and decisions):\n${compact}\n`;
}

/**
 * Inject memory into a messages array by appending to the system message.
 */
function injectMemoryIntoMessages(messages, dir) {
    const injection = getMemoryInjection(dir);
    if (!injection) return messages;

    return messages.map((msg) => {
        if (msg.role === "system") {
            return { ...msg, content: msg.content + injection };
        }
        return msg;
    });
}

// ── Display ───────────────────────────────────────────────────────────────────

function printMemory(dir) {
    const p = getMemoryPath(dir);
    const content = loadMemory(dir);

    if (!content || !content.trim()) {
        console.log(chalk.dim(`\n  No memory yet. Use /remember "fact" to add one.\n`));
        console.log(chalk.dim(`  Will be created at: ${p}\n`));
        return;
    }

    console.log(`\n  ${BRAND.bold("📌 TAS Memory")} ${chalk.dim(p)}\n`);
    const lines = content.split("\n");
    for (const line of lines) {
        if (line.startsWith("# ")) {
            console.log(`  ${chalk.bold(line)}`);
        } else if (line.startsWith("## ")) {
            console.log(`\n  ${chalk.cyan(line)}`);
        } else if (line.startsWith("- ")) {
            console.log(`  ${chalk.dim("•")} ${line.slice(2)}`);
        } else if (line.trim()) {
            console.log(`  ${chalk.dim(line)}`);
        }
    }
    console.log("");
}

/**
 * Export memory + prompts + provider config as a shareable bundle (minus API keys).
 */
function exportBundle(dir, config, prompts = []) {
    const memory = loadMemory(dir) || "";
    // SECURITY: never include API keys, tokens, or secrets in the bundle.
    // The bundle is designed to be shared safely with teammates.
    const { key, api_key, apiKey, secret, token, ...safeConfig } = config; // eslint-disable-line no-unused-vars
    const bundle = {
        _note: "Share this file safely — no API keys are included.",
        version: "1.0",
        exported: new Date().toISOString(),
        project: path.basename(dir),
        provider: safeConfig.provider,
        model: safeConfig.model,
        temperature: safeConfig.temperature,
        profiles: safeConfig.profiles || {},
        memory,
        prompts,
    };
    const bundlePath = path.join(dir, "tas-bundle.json");
    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
    return bundlePath;
}

/**
 * Import a bundle (restores memory + prompts, skips API keys).
 */
function importBundle(bundlePath, dir) {
    const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
    if (bundle.memory) saveMemory(dir, bundle.memory);
    return bundle;
}

module.exports = {
    getMemoryPath,
    loadMemory,
    saveMemory,
    remember,
    forget,
    getMemoryInjection,
    injectMemoryIntoMessages,
    printMemory,
    exportBundle,
    importBundle,
};
