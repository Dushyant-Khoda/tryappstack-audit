/**
 * Session management for tas-audit team
 * Handles: save, resume, branch, list sessions
 *
 * Sessions stored in: ~/.tryappstack/sessions/<name>.json
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

const SESSIONS_DIR = path.join(os.homedir(), ".tryappstack", "sessions");
const BRAND = chalk.hex("#c8ff00");

function ensureSessionsDir() {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function sessionPath(name) {
    const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "-");
    return path.join(SESSIONS_DIR, `${safe}.json`);
}

// ── Save ──────────────────────────────────────────────────────────────────────

/**
 * Save current session state.
 */
function saveSession(name, state) {
    ensureSessionsDir();
    const session = {
        name,
        timestamp: new Date().toISOString(),
        member:      state.member,
        provider:    state.provider,
        model:       state.model,
        pinned:      state.pinned || null,
        history:     state.history || [],
        totalCost:   state.totalCost || 0,
        totalTokens: state.totalTokens || 0,
        messages:    state.messages || 0,
        dir:         state.dir || ".",
    };
    fs.writeFileSync(sessionPath(name), JSON.stringify(session, null, 2));
    return sessionPath(name);
}

// ── Resume ────────────────────────────────────────────────────────────────────

/**
 * Load a saved session.
 * Returns the session object or null if not found.
 */
function resumeSession(name) {
    const p = sessionPath(name);
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
        console.log(chalk.red(`  ✗ Failed to load session: ${err.message}`));
        return null;
    }
}

// ── Branch ────────────────────────────────────────────────────────────────────

/**
 * Create a branch (fork) of a session at a specific point.
 * @param {object} state - Current session state
 * @param {string} branchName - Name for the branch
 * @param {number} [atIndex] - Fork at this message index (default: current)
 */
function branchSession(state, branchName, atIndex) {
    const history = atIndex !== undefined
        ? state.history.slice(0, atIndex)
        : [...state.history];

    return saveSession(branchName, {
        ...state,
        history,
        name: branchName,
        _branchedFrom: state.name || "unnamed",
        _branchedAt: atIndex || history.length,
    });
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * List all saved sessions.
 */
function listSessions() {
    ensureSessionsDir();
    const files = fs.readdirSync(SESSIONS_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort((a, b) => {
            const sa = fs.statSync(path.join(SESSIONS_DIR, a)).mtime;
            const sb = fs.statSync(path.join(SESSIONS_DIR, b)).mtime;
            return sb - sa;
        });

    return files.map((f) => {
        try {
            const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), "utf8"));
            return {
                name: s.name,
                member: s.member,
                provider: s.provider,
                model: s.model,
                messages: s.history?.length || 0,
                cost: s.totalCost || 0,
                timestamp: s.timestamp,
                branchedFrom: s._branchedFrom,
            };
        } catch { return null; }
    }).filter(Boolean);
}

// ── Delete ────────────────────────────────────────────────────────────────────

function deleteSession(name) {
    const p = sessionPath(name);
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
    return false;
}

// ── Print sessions ────────────────────────────────────────────────────────────

function printSessions() {
    const sessions = listSessions();
    if (sessions.length === 0) {
        console.log(chalk.dim("  No saved sessions. Use /save-session <name> to save one.\n"));
        return;
    }

    console.log(`\n  ${chalk.bold("Saved Sessions")} ${chalk.dim(`(${sessions.length})`)}\n`);
    for (const s of sessions) {
        const dt = new Date(s.timestamp).toLocaleString();
        const branch = s.branchedFrom ? chalk.dim(` ⎇ from ${s.branchedFrom}`) : "";
        const cost = s.cost > 0 ? chalk.dim(` · $${s.cost.toFixed(4)}`) : "";
        console.log(`  ${BRAND(s.name.padEnd(24))} ${chalk.dim(s.member + " · " + (s.model || s.provider))} ${chalk.dim("· " + s.messages + " msgs")}${cost}${branch}`);
        console.log(`  ${" ".repeat(25)}${chalk.dim(dt)}`);
    }
    console.log("");
}

module.exports = {
    saveSession,
    resumeSession,
    branchSession,
    listSessions,
    deleteSession,
    printSessions,
};
