/**
 * TAS config loader — .tasrc per-project config + profile manager
 *
 * .tasrc (in project root) overrides global ~/.tryappstack/config
 * Format: JSON  (file: .tasrc)
 *
 * {
 *   "provider": "claude",
 *   "model": "claude-haiku-4-20250514",
 *   "temperature": 0.3,
 *   "pinned": "You are a senior Go developer. Always use idiomatic Go.",
 *   "budget": { "daily": 1.00, "monthly": 20.00 },
 *   "profiles": {
 *     "fast": { "provider": "gemini", "model": "gemini-2.0-flash" },
 *     "powerful": { "provider": "claude", "model": "claude-opus-4-20250514" },
 *     "cheap": { "provider": "deepseek", "model": "deepseek-chat" }
 *   }
 * }
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

const TASRC_FILE = ".tasrc";
const GLOBAL_CONFIG = path.join(os.homedir(), ".tryappstack", "config");
const BRAND = chalk.hex("#c8ff00");

// ── Global config reader ──────────────────────────────────────────────────────

function readGlobalConfig() {
    if (!fs.existsSync(GLOBAL_CONFIG)) return {};
    try {
        const content = fs.readFileSync(GLOBAL_CONFIG, "utf8");
        const provider = content.match(/AI_PROVIDER="(\w+)"/)?.[1] || "claude";
        const key      = content.match(/AI_KEY="([^"]+)"/)?.[1] || "";
        const model    = content.match(/AI_MODEL="([^"]+)"/)?.[1] || "";
        return { provider, key, model };
    } catch { return {}; }
}

// ── .tasrc loader ─────────────────────────────────────────────────────────────

/**
 * Load .tasrc from directory (walk up to find nearest one).
 */
function loadTasRC(dir) {
    let current = path.resolve(dir);
    const root = path.parse(current).root;

    while (current !== root) {
        const rcPath = path.join(current, TASRC_FILE);
        if (fs.existsSync(rcPath)) {
            try {
                const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
                // Warn immediately if a key/secret is stored in the project file
                if (rc.key || rc.api_key || rc.apiKey || rc.secret || rc.token) {
                    console.log(chalk.red(`\n  ⚠  SECURITY: .tasrc at ${rcPath} contains an API key.`));
                    console.log(chalk.red("  ⚠  Remove it and use env vars or 'tas-audit ai-setup' instead.\n"));
                    // Strip the key from the returned config — never use it from a project file
                    delete rc.key; delete rc.api_key; delete rc.apiKey;
                    delete rc.secret; delete rc.token;
                }
                rc._source = rcPath;
                return rc;
            } catch (err) {
                console.log(chalk.yellow(`  ⚠ .tasrc parse error: ${err.message}`));
                return null;
            }
        }
        current = path.dirname(current);
    }
    return null;
}

/**
 * Merge global config + .tasrc + CLI opts (opts has highest priority).
 * Returns the effective config for this session.
 */
function resolveConfig(dir, opts = {}) {
    const global = readGlobalConfig();
    const rc = loadTasRC(dir) || {};

    const merged = {
        provider:    opts.aiProvider || rc.provider || global.provider || "claude",
        key:         opts.aiKey || rc.key || global.key || "",
        model:       opts.aiModel || rc.model || global.model || "",
        temperature: opts.temperature !== undefined ? opts.temperature : (rc.temperature ?? 0.3),
        pinned:      rc.pinned || null,
        budget:      rc.budget || null,
        profiles:    rc.profiles || {},
        rcSource:    rc._source || null,
    };

    // Also check env vars for key
    if (!merged.key && process.env.ANTHROPIC_API_KEY) { merged.key = process.env.ANTHROPIC_API_KEY; merged.provider = merged.provider || "claude"; }
    if (!merged.key && process.env.OPENAI_API_KEY) { merged.key = process.env.OPENAI_API_KEY; merged.provider = merged.provider || "openai"; }
    if (!merged.key && process.env.XAI_API_KEY) { merged.key = process.env.XAI_API_KEY; merged.provider = merged.provider || "grok"; }

    return merged;
}

// ── Profile management ────────────────────────────────────────────────────────

/**
 * Switch to a named profile within a config.
 * Returns the updated config, or null if profile not found.
 */
function applyProfile(config, profileName) {
    if (!config.profiles || !config.profiles[profileName]) {
        return null;
    }
    const profile = config.profiles[profileName];
    return { ...config, ...profile, _activeProfile: profileName };
}

/**
 * List all available profiles.
 */
function listProfiles(config) {
    const profiles = config.profiles || {};
    const names = Object.keys(profiles);
    if (names.length === 0) return [];
    return names.map((name) => ({
        name,
        provider: profiles[name].provider,
        model: profiles[name].model,
    }));
}

// ── .tasrc creator ────────────────────────────────────────────────────────────

/**
 * Create a default .tasrc in the given directory.
 */
function createTasRC(dir, config = {}) {
    const rcPath = path.join(dir, TASRC_FILE);
    // NOTE: API keys are NEVER written here.
    // Keys are stored in ~/.tryappstack/config (global) or env vars only.
    const template = {
        "_note": "API keys are NOT stored here. Use env vars or 'tas-audit ai-setup'.",
        provider: config.provider || "claude",
        model: config.model || "claude-sonnet-4-20250514",
        temperature: config.temperature || 0.3,
        pinned: config.pinned || "",
        budget: { daily: 2.00, monthly: 30.00 },
        profiles: {
            fast:     { provider: "gemini", model: "gemini-2.0-flash" },
            powerful: { provider: "claude", model: "claude-opus-4-20250514" },
            cheap:    { provider: "deepseek", model: "deepseek-chat" },
        },
    };
    fs.writeFileSync(rcPath, JSON.stringify(template, null, 2));
    return rcPath;
}

/**
 * Print current effective config (without showing the key).
 */
function printConfig(config) {
    const icons = { claude: "🟣", openai: "🟢", grok: "🔵", gemini: "🟡", deepseek: "🔴" };
    const icon = icons[config.provider] || "🤖";

    console.log(`\n  ${chalk.bold("Active Config")}\n`);
    console.log(`  ${chalk.dim("Provider:")}    ${icon} ${config.provider}`);
    console.log(`  ${chalk.dim("Model:")}       ${chalk.cyan(config.model || "(default)")}`);
    console.log(`  ${chalk.dim("Temperature:")} ${config.temperature}`);
    if (config.pinned) console.log(`  ${chalk.dim("Pinned:")}      ${chalk.dim(config.pinned.slice(0, 60) + (config.pinned.length > 60 ? "..." : ""))}`);
    if (config.budget) {
        console.log(`  ${chalk.dim("Budget:")}      daily $${config.budget.daily} · monthly $${config.budget.monthly}`);
    }
    if (config._activeProfile) {
        console.log(`  ${chalk.dim("Profile:")}     ${BRAND(config._activeProfile)}`);
    }
    if (config.rcSource) {
        console.log(`  ${chalk.dim("Config from:")} ${chalk.dim(config.rcSource)}`);
    }

    const profiles = listProfiles(config);
    if (profiles.length > 0) {
        console.log(`  ${chalk.dim("Profiles:")}    ${profiles.map((p) => p.name).join(" · ")}`);
    }
    console.log("");
}

module.exports = {
    loadTasRC,
    resolveConfig,
    applyProfile,
    listProfiles,
    createTasRC,
    printConfig,
};
