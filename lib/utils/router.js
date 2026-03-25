/**
 * Smart AI router
 *
 * - Auto-failover: when rate limited (429), silently retries on second provider
 * - Queue mode: buffers messages during rate limit, sends when available
 * - Shows estimated wait time from Retry-After header
 * - Smart routing: fast/cheap queries → Groq/DeepSeek, complex → Claude/GPT
 */

const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");

// ── Complexity classifier ─────────────────────────────────────────────────────

const COMPLEX_KEYWORDS = [
    "architecture", "design", "refactor", "migrate", "scalab",
    "system", "performance", "security", "audit", "review all",
    "explain how", "why does", "compare", "trade-off",
];

const FAST_KEYWORDS = [
    "what is", "define", "list", "quick", "format", "fix typo",
    "rename", "simple", "one-line", "short",
];

/**
 * Classify a query as 'complex' | 'fast' | 'normal'.
 */
function classifyQuery(userContent) {
    const lower = userContent.toLowerCase();
    const charCount = userContent.length;
    const hasCode = (userContent.match(/```/g) || []).length > 1;

    // Long or code-heavy → complex
    if (charCount > 800 || hasCode) return "complex";

    if (FAST_KEYWORDS.some((k) => lower.includes(k))) return "fast";
    if (COMPLEX_KEYWORDS.some((k) => lower.includes(k))) return "complex";

    // Medium length
    if (charCount < 120) return "fast";
    return "normal";
}

/**
 * Pick the optimal provider config based on query complexity.
 *
 * @param {string} complexity - 'fast' | 'normal' | 'complex'
 * @param {object} config - current config (primary)
 * @param {Array} fallbacks - array of { provider, key, model }
 * @returns {object} config to use
 */
function routeByComplexity(complexity, config, fallbacks = []) {
    if (!fallbacks.length || complexity === "normal") return config;

    // For fast queries: prefer cheapest fallback
    if (complexity === "fast") {
        const cheap = fallbacks.find((f) =>
            f.provider === "deepseek" || f.provider === "gemini" || f.model?.includes("mini") || f.model?.includes("flash")
        );
        if (cheap) return { ...config, ...cheap, _routed: "fast" };
    }

    // For complex queries: use primary (assumed to be powerful)
    return config;
}

// ── Rate limit handler ────────────────────────────────────────────────────────

/**
 * Parse Retry-After header value (seconds or HTTP date).
 * Returns wait time in milliseconds.
 */
function parseRetryAfter(headerValue) {
    if (!headerValue) return 5000;
    const secs = parseInt(headerValue);
    if (!isNaN(secs)) return secs * 1000;
    const date = new Date(headerValue);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return 5000;
}

/**
 * Check if an error is a rate limit error.
 */
function isRateLimitError(err) {
    const msg = err.message || "";
    return (
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("Too Many Requests") ||
        msg.includes("quota") ||
        err.status === 429
    );
}

/**
 * Check if an error is a transient/retriable error.
 */
function isRetriableError(err) {
    const msg = err.message || "";
    return (
        isRateLimitError(err) ||
        msg.includes("503") ||
        msg.includes("502") ||
        msg.includes("overloaded") ||
        msg.includes("timeout") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ENOTFOUND")
    );
}

// ── Smart call with failover ──────────────────────────────────────────────────

/**
 * Call AI with automatic failover on rate limit or error.
 *
 * @param {Function} streamAI - the streaming caller
 * @param {Array} messages
 * @param {object} primaryConfig - { provider, key, model, temperature }
 * @param {Array} fallbackConfigs - list of fallback provider configs
 * @param {object} callbacks - { onToken, onInterrupt }
 * @param {object} [opts] - additional options
 */
async function callWithFailover(streamAI, messages, primaryConfig, fallbackConfigs = [], callbacks = {}, opts = {}) {
    const configs = [primaryConfig, ...fallbackConfigs];
    let lastErr = null;

    for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i];
        const isFailover = i > 0;

        if (isFailover) {
            console.log(`\n  ${chalk.yellow("⚡ Failing over to")} ${chalk.bold(cfg.provider)} ${chalk.dim(`(${cfg.model || "default"})`)}`);
        }

        try {
            const result = await streamAI(messages, {
                aiProvider:  cfg.provider,
                aiKey:       cfg.key,
                aiModel:     cfg.model,
                temperature: cfg.temperature || opts.temperature || 0.3,
            }, callbacks);

            if (isFailover) result._usedFailover = cfg.provider;
            return result;

        } catch (err) {
            lastErr = err;

            if (isRateLimitError(err)) {
                const waitMs = parseRetryAfter(err.retryAfter);
                const waitSec = Math.ceil(waitMs / 1000);

                if (i < configs.length - 1) {
                    // Try next provider instead of waiting
                    console.log(`\n  ${chalk.yellow("⚠")} ${cfg.provider} rate limited. Switching provider...`);
                } else {
                    // No more fallbacks — wait and retry
                    console.log(`\n  ${chalk.yellow("⚠")} Rate limited. Retry in ${chalk.bold(waitSec + "s")}...`);
                    await sleep(waitMs);
                    i--; // retry same config
                }
            } else if (isRetriableError(err) && i === configs.length - 1) {
                // Last provider, retriable error — wait briefly and retry once
                console.log(`\n  ${chalk.yellow("⚠")} ${err.message}. Retrying in 3s...`);
                await sleep(3000);
                try {
                    return await streamAI(messages, {
                        aiProvider: cfg.provider, aiKey: cfg.key,
                        aiModel: cfg.model, temperature: cfg.temperature || 0.3,
                    }, callbacks);
                } catch (retryErr) {
                    lastErr = retryErr;
                }
            } else if (!isRetriableError(err)) {
                // Non-retriable: surface immediately
                throw err;
            }
        }
    }

    throw lastErr || new Error("All providers failed");
}

// ── Queue mode ────────────────────────────────────────────────────────────────

class MessageQueue {
    constructor() {
        this._queue = [];
        this._processing = false;
        this._paused = false;
        this._pausedUntil = 0;
    }

    enqueue(item) {
        this._queue.push(item);
    }

    get length() { return this._queue.length; }
    get paused() { return this._paused; }

    pauseFor(ms) {
        this._paused = true;
        this._pausedUntil = Date.now() + ms;
        const secs = Math.ceil(ms / 1000);
        console.log(`\n  ${chalk.yellow("⏸  Queue paused")} for ${secs}s due to rate limit. ${this._queue.length} message(s) queued.`);

        setTimeout(() => {
            this._paused = false;
            console.log(`\n  ${BRAND("▶")} Queue resumed. Processing ${this._queue.length} queued message(s)...`);
        }, ms);
    }

    async drain(processItem) {
        if (this._processing) return;
        this._processing = true;

        while (this._queue.length > 0) {
            if (this._paused) {
                const wait = Math.max(0, this._pausedUntil - Date.now());
                await sleep(wait + 500);
            }
            const item = this._queue.shift();
            if (item) await processItem(item);
        }

        this._processing = false;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Display helpers ───────────────────────────────────────────────────────────

function printRoutingInfo(complexity, config) {
    const label = complexity === "fast" ? chalk.green("fast") : complexity === "complex" ? chalk.yellow("complex") : chalk.dim("normal");
    if (config._routed) {
        console.log(`  ${chalk.dim("⚡ Routed:")} ${label} query → ${chalk.bold(config.provider)} ${chalk.dim(config.model || "")}\n`);
    }
}

module.exports = {
    classifyQuery,
    routeByComplexity,
    parseRetryAfter,
    isRateLimitError,
    isRetriableError,
    callWithFailover,
    MessageQueue,
    printRoutingInfo,
    sleep,
};
