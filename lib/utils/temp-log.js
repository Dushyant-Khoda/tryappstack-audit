/**
 * Session logger — npm-style error handling
 *
 * Everything verbose goes to a temp file in os.tmpdir() — always writable,
 * no permissions required, OS cleans it up automatically.
 *
 * Terminal only sees what matters: status, cost, short errors.
 * On error: "See full log: /tmp/tas-audit/session-XXX.log"
 * On clean exit: file deleted immediately. On error: kept (last 5 max).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

// os.tmpdir() = /tmp on Linux/macOS, %TEMP% on Windows — always writable without sudo
const LOGS_DIR = path.join(os.tmpdir(), "tas-audit");
const MAX_KEPT_LOGS = 5;

let _logPath = null;
let _hadError = false;
let _logStream = null;

// ── Init ──────────────────────────────────────────────────────────────────────

function initSessionLog() {
    fs.mkdirSync(LOGS_DIR, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    _logPath = path.join(LOGS_DIR, `session-${ts}.log`);
    _logStream = fs.createWriteStream(_logPath, { flags: "a" });

    // Write header
    _logStream.write(`# tas-audit session log\n# Started: ${new Date().toISOString()}\n# PID: ${process.pid}\n\n`);

    // Prune old clean logs (keep last MAX_KEPT_LOGS)
    _pruneOldLogs();

    return _logPath;
}

function getLogPath() {
    return _logPath;
}

// ── Logging ───────────────────────────────────────────────────────────────────

/**
 * Write verbose content to log file only (not terminal).
 */
function logVerbose(label, content) {
    if (!_logStream) return;
    const ts = new Date().toISOString();
    _logStream.write(`\n[${ts}] ${label}\n${"─".repeat(60)}\n${content}\n`);
}

/**
 * Log an error to file and print short summary to terminal.
 * @param {Error|string} err
 * @param {string} [context] - What was happening when error occurred
 */
function logError(err, context = "") {
    _hadError = true;
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack || "" : "";

    if (_logStream) {
        const ts = new Date().toISOString();
        _logStream.write(`\n[${ts}] ERROR ${context ? "(" + context + ")" : ""}\n${"─".repeat(60)}\n${stack || msg}\n`);
    }

    // Terminal: short message + log reference
    console.error(`\n  ${chalk.red("✗")} ${msg}`);
    if (_logPath) {
        console.error(`  ${chalk.dim("Full log: " + _logPath)}\n`);
    }
}

/**
 * Log an AI request/response pair to the log file.
 */
function logAITurn(messages, response, meta = {}) {
    if (!_logStream) return;
    const ts = new Date().toISOString();
    const inputSnippet = messages.map((m) => `[${m.role}] ${m.content.slice(0, 200)}`).join("\n");
    _logStream.write(
        `\n[${ts}] AI TURN\n${"─".repeat(60)}\n` +
        `Provider: ${meta.provider || "?"} | Model: ${meta.model || "?"} | ` +
        `Tokens: ${meta.inputTokens || "?"}in + ${meta.outputTokens || "?"}out | ` +
        `Cost: $${meta.cost?.toFixed(5) || "?"} | Latency: ${meta.latencyMs || "?"}ms | TTFT: ${meta.ttft || "?"}ms\n\n` +
        `INPUT:\n${inputSnippet}\n\n` +
        `OUTPUT:\n${response}\n`
    );
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function closeSessionLog(sessionSummary = null) {
    if (!_logStream) return;

    const ts = new Date().toISOString();
    if (sessionSummary) {
        _logStream.write(`\n[${ts}] SESSION END\n${"─".repeat(60)}\n${JSON.stringify(sessionSummary, null, 2)}\n`);
    }
    _logStream.end();
    _logStream = null;

    // If no errors, delete the log file
    if (!_hadError && _logPath && fs.existsSync(_logPath)) {
        try { fs.unlinkSync(_logPath); } catch { /* ignore */ }
        _logPath = null;
    }
}

function _pruneOldLogs() {
    try {
        const files = fs.readdirSync(LOGS_DIR)
            .filter((f) => f.startsWith("session-") && f.endsWith(".log"))
            .map((f) => ({ name: f, mtime: fs.statSync(path.join(LOGS_DIR, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);

        // Delete all beyond MAX_KEPT_LOGS
        for (const f of files.slice(MAX_KEPT_LOGS)) {
            try { fs.unlinkSync(path.join(LOGS_DIR, f.name)); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

// ── Process-level error handler ───────────────────────────────────────────────

/**
 * Install global uncaught error handler that logs to file + shows clean terminal message.
 * Call once at startup.
 */
function installGlobalErrorHandler() {
    process.on("uncaughtException", (err) => {
        logError(err, "uncaughtException");
        process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
        logError(reason instanceof Error ? reason : new Error(String(reason)), "unhandledRejection");
        // Don't exit — just log it
    });

    process.on("exit", () => {
        if (_logStream) {
            _logStream.end();
        }
    });
}

module.exports = {
    initSessionLog,
    getLogPath,
    logVerbose,
    logError,
    logAITurn,
    closeSessionLog,
    installGlobalErrorHandler,
};
