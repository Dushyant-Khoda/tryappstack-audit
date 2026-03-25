/**
 * Context window management
 *
 * - Visual meter that turns red when filling up
 * - Auto-summarize old messages to compress context (preserves meaning)
 * - Memory anchors — /anchor facts that survive compression
 * - Warn before overflow, not after it silently breaks
 */

const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");

// ── Model context limits (tokens) ─────────────────────────────────────────────

const CONTEXT_LIMITS = {
    // Claude
    "claude-sonnet-4-20250514": 200_000,
    "claude-opus-4-20250514":   200_000,
    "claude-haiku-4-20250514":  200_000,
    // OpenAI
    "gpt-4o":                   128_000,
    "gpt-4o-mini":              128_000,
    "o1-preview":               128_000,
    "gpt-4-turbo":              128_000,
    // Grok
    "grok-3":                   131_072,
    "grok-3-mini":              131_072,
    // Gemini
    "gemini-2.0-flash":       1_048_576,
    "gemini-1.5-pro":         1_048_576,
    "gemini-1.5-flash":       1_000_000,
    // DeepSeek
    "deepseek-chat":             64_000,
    "deepseek-reasoner":         64_000,
};

const DEFAULT_LIMIT = 100_000;

// Thresholds
const WARN_AT  = 0.75; // 75% → yellow warning
const COMPRESS_AT = 0.85; // 85% → auto-compress
const BLOCK_AT = 0.95; // 95% → hard warn before sending

// ── Token estimation ──────────────────────────────────────────────────────────

function countTokens(text) {
    return Math.ceil(text.length / 4);
}

function countMessagesTokens(messages) {
    return messages.reduce((sum, m) => sum + countTokens(m.content || ""), 0);
}

function getContextLimit(model) {
    return CONTEXT_LIMITS[model] || DEFAULT_LIMIT;
}

// ── Context usage ─────────────────────────────────────────────────────────────

/**
 * Returns { used, limit, pct, status: 'ok'|'warn'|'compress'|'danger' }
 */
function getContextUsage(messages, model) {
    const used  = countMessagesTokens(messages);
    const limit = getContextLimit(model);
    const pct   = used / limit;

    let status = "ok";
    if (pct >= BLOCK_AT)    status = "danger";
    else if (pct >= COMPRESS_AT) status = "compress";
    else if (pct >= WARN_AT) status = "warn";

    return { used, limit, pct, status };
}

// ── Visual meter ──────────────────────────────────────────────────────────────

/**
 * Render a context window meter inline.
 *
 * ok:      Context: [████░░░░░░] 40%
 * warn:    Context: [████████░░] 78%  ⚠
 * danger:  Context: [██████████] 96%  🔴 auto-compressing...
 */
function renderContextMeter(usage) {
    const { used, limit, pct, status } = usage;
    const BAR_WIDTH = 10;
    const filled = Math.round(pct * BAR_WIDTH);
    const empty  = BAR_WIDTH - filled;

    const bar  = "█".repeat(filled) + "░".repeat(empty);
    const pctStr = `${Math.round(pct * 100)}%`;
    const tokStr = `${(used / 1000).toFixed(0)}k/${(limit / 1000).toFixed(0)}k tok`;

    let color;
    let suffix = "";
    if (status === "danger") {
        color = chalk.red;
        suffix = chalk.red("  🔴 overflow risk");
    } else if (status === "compress") {
        color = chalk.yellow;
        suffix = chalk.yellow("  ⚠ compressing...");
    } else if (status === "warn") {
        color = chalk.yellow;
        suffix = chalk.yellow("  ⚠");
    } else {
        color = BRAND;
    }

    return `  ${chalk.dim("Context:")} ${color("[" + bar + "]")} ${color(pctStr)} ${chalk.dim(tokStr)}${suffix}`;
}

// ── Compression ───────────────────────────────────────────────────────────────

/**
 * Compresses a message array by summarizing the oldest half.
 * Keeps: system message, memory anchors, last N messages untouched.
 * Uses a simple extractive summary (no AI needed) for speed.
 *
 * @param {Array} messages
 * @param {Array} anchors - always-kept facts
 * @param {number} keepRecent - number of recent messages to always keep
 * @returns {{ messages: Array, compressed: boolean, savedTokens: number }}
 */
function compressContext(messages, anchors = [], keepRecent = 6) {
    const systemMsgs = messages.filter((m) => m.role === "system");
    const convoMsgs  = messages.filter((m) => m.role !== "system");

    if (convoMsgs.length <= keepRecent + 2) {
        return { messages, compressed: false, savedTokens: 0 };
    }

    const toCompress = convoMsgs.slice(0, convoMsgs.length - keepRecent);
    const toKeep     = convoMsgs.slice(convoMsgs.length - keepRecent);

    const originalTokens = countMessagesTokens(toCompress);

    // Extractive summary: take first sentence of each message + code block headers
    const summaryLines = [];
    for (const msg of toCompress) {
        const firstLine = msg.content.split("\n")[0].slice(0, 120);
        const hasCode   = msg.content.includes("```");
        const role      = msg.role === "user" ? "User" : "AI";
        summaryLines.push(`${role}: ${firstLine}${hasCode ? " [+code]" : ""}`);
    }

    // Add anchors into the summary
    if (anchors.length > 0) {
        summaryLines.unshift("ANCHORED FACTS: " + anchors.join(" | "));
    }

    const summaryContent = `[COMPRESSED HISTORY — ${toCompress.length} messages]\n${summaryLines.join("\n")}`;
    const summaryMsg = { role: "user", content: summaryContent };

    const newMessages = [...systemMsgs, summaryMsg, ...toKeep];
    const savedTokens = originalTokens - countTokens(summaryContent);

    return { messages: newMessages, compressed: true, savedTokens: Math.max(0, savedTokens) };
}

/**
 * AI-powered compression — calls AI to summarize old messages.
 * Returns the summarized message content.
 */
async function aiCompressContext(messages, callAI, opts) {
    const convoMsgs  = messages.filter((m) => m.role !== "system");
    if (convoMsgs.length < 4) return null;

    const toCompress = convoMsgs.slice(0, Math.floor(convoMsgs.length / 2));
    const transcript = toCompress
        .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 800)}`)
        .join("\n\n");

    const summaryMessages = [
        {
            role: "system",
            content: "You are a context compressor. Summarize the conversation below into a compact paragraph that preserves: key decisions, code patterns discussed, technical constraints, and any explicit facts. Be factual and dense. Max 300 words.",
        },
        { role: "user", content: `Summarize this conversation:\n\n${transcript}` },
    ];

    try {
        const summary = await callAI(summaryMessages, opts);
        return `[AI SUMMARY of ${toCompress.length} earlier messages]\n${summary}`;
    } catch {
        return null;
    }
}

// ── Anchors ───────────────────────────────────────────────────────────────────

/**
 * Parse /anchor commands from user input.
 * Returns the anchor text or null.
 */
function parseAnchor(input) {
    const m = input.match(/^\/(?:anchor|remember-ctx)\s+["']?(.+?)["']?$/);
    return m ? m[1].trim() : null;
}

/**
 * Format anchors for display.
 */
function printAnchors(anchors) {
    if (!anchors.length) {
        console.log(chalk.dim("  No context anchors set. Use /anchor \"fact\" to add one.\n"));
        return;
    }
    console.log(`\n  ${BRAND.bold("⚓ Context Anchors")}\n`);
    anchors.forEach((a, i) => console.log(`  ${chalk.dim((i + 1) + ".")} ${a}`));
    console.log("");
}

module.exports = {
    CONTEXT_LIMITS,
    getContextLimit,
    countTokens,
    countMessagesTokens,
    getContextUsage,
    renderContextMeter,
    compressContext,
    aiCompressContext,
    parseAnchor,
    printAnchors,
    WARN_AT,
    COMPRESS_AT,
    BLOCK_AT,
};
