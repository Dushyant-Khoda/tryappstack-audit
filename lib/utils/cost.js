/**
 * Cost tracking utility for tryappstack-audit team REPL
 * Handles: per-message cost, budget alerts, projection, model comparison
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");

// ── Model pricing (USD per 1M tokens) ────────────────────────────────────────
const MODEL_COSTS = {
    // Claude
    "claude-sonnet-4-20250514":  { input: 3.00,  output: 15.00 },
    "claude-opus-4-20250514":    { input: 15.00, output: 75.00 },
    "claude-haiku-4-20250514":   { input: 0.25,  output: 1.25  },
    // GPT
    "gpt-4o":                    { input: 2.50,  output: 10.00 },
    "gpt-4o-mini":               { input: 0.15,  output: 0.60  },
    "o1-preview":                { input: 15.00, output: 60.00 },
    "gpt-4-turbo":               { input: 10.00, output: 30.00 },
    // Grok
    "grok-3":                    { input: 3.00,  output: 15.00 },
    "grok-3-mini":               { input: 0.30,  output: 0.50  },
    // Gemini
    "gemini-2.0-flash":          { input: 0.10,  output: 0.40  },
    "gemini-1.5-pro":            { input: 1.25,  output: 5.00  },
    "gemini-1.5-flash":          { input: 0.075, output: 0.30  },
    // DeepSeek
    "deepseek-chat":             { input: 0.14,  output: 0.28  },
    "deepseek-reasoner":         { input: 0.55,  output: 2.19  },
};

// ── Token estimation ──────────────────────────────────────────────────────────

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

/**
 * Calculate cost for a model given token counts.
 * @returns {number} cost in USD
 */
function calcCost(model, inputTokens, outputTokens) {
    const pricing = MODEL_COSTS[model];
    if (!pricing) return 0;
    return (inputTokens / 1_000_000) * pricing.input +
           (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Format cost for inline display.
 * e.g. "$0.0023 · 847 tok"
 */
function formatCostLine(cost, inputTokens, outputTokens, latencyMs, ttftMs) {
    const totalTok = inputTokens + outputTokens;
    const costStr = cost < 0.0001
        ? `<$0.0001`
        : `$${cost.toFixed(4)}`;

    let line = `${chalk.dim("↳")} ${chalk.cyan(costStr)} ${chalk.dim("·")} ${chalk.dim(totalTok.toLocaleString() + " tok")}`;

    if (latencyMs) {
        line += ` ${chalk.dim("·")} ${chalk.dim((latencyMs / 1000).toFixed(2) + "s")}`;
    }
    if (ttftMs) {
        line += ` ${chalk.dim("· TTFT " + ttftMs + "ms")}`;
    }

    return line;
}

// ── Usage persistence ─────────────────────────────────────────────────────────

function getUsagePath() {
    return path.join(os.homedir(), ".tryappstack", "usage.json");
}

function loadUsage() {
    const p = getUsagePath();
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return {}; }
}

function saveUsage(usage) {
    const p = getUsagePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(usage, null, 2));
}

/**
 * Record a usage event and return updated totals for today/month.
 */
function recordUsage(cost, tokens) {
    const usage = loadUsage();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    if (!usage[today]) usage[today] = { cost: 0, tokens: 0, messages: 0 };
    if (!usage[month]) usage[month] = { cost: 0, tokens: 0, messages: 0 };

    usage[today].cost     += cost;
    usage[today].tokens   += tokens;
    usage[today].messages += 1;
    usage[month].cost     += cost;
    usage[month].tokens   += tokens;
    usage[month].messages += 1;

    saveUsage(usage);
    return { today: usage[today], month: usage[month] };
}

/**
 * Get current spend totals.
 */
function getSpendTotals() {
    const usage = loadUsage();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    return {
        today: usage[today] || { cost: 0, tokens: 0, messages: 0 },
        month: usage[month] || { cost: 0, tokens: 0, messages: 0 },
    };
}

// ── Budget check ──────────────────────────────────────────────────────────────

/**
 * Check budget limits. Returns { ok, warning, blocked, message }
 */
function checkBudget(budget, projectedCost = 0) {
    if (!budget) return { ok: true };

    const totals = getSpendTotals();
    const results = [];

    if (budget.daily) {
        const after = totals.today.cost + projectedCost;
        const pct = (after / budget.daily) * 100;
        if (after >= budget.daily) {
            return { ok: false, blocked: true, message: `Daily budget cap reached ($${budget.daily.toFixed(2)}). Spent: $${totals.today.cost.toFixed(4)}` };
        }
        if (pct >= 80) {
            results.push(`⚠️  Daily budget ${pct.toFixed(0)}% used ($${totals.today.cost.toFixed(4)} / $${budget.daily.toFixed(2)})`);
        }
    }

    if (budget.monthly) {
        const after = totals.month.cost + projectedCost;
        const pct = (after / budget.monthly) * 100;
        if (after >= budget.monthly) {
            return { ok: false, blocked: true, message: `Monthly budget cap reached ($${budget.monthly.toFixed(2)}). Spent: $${totals.month.cost.toFixed(4)}` };
        }
        if (pct >= 80) {
            results.push(`⚠️  Monthly budget ${pct.toFixed(0)}% used ($${totals.month.cost.toFixed(4)} / $${budget.monthly.toFixed(2)})`);
        }
    }

    return { ok: true, warnings: results };
}

// ── Cost projection ───────────────────────────────────────────────────────────

/**
 * Project monthly spend based on today's average rate.
 */
function projectMonthly() {
    const totals = getSpendTotals();
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();

    if (totals.today.messages === 0) return null;

    // Extrapolate from today's usage
    const dailyRate = totals.today.cost;
    const projection = dailyRate * daysInMonth;
    const monthSoFar = totals.month.cost;
    const remaining = projection - monthSoFar;

    return {
        dailyRate,
        projection,
        monthSoFar,
        daysInMonth,
        dayOfMonth,
        remaining,
    };
}

/**
 * Print a cost summary for the session.
 */
function printCostSummary(sessionCost, sessionTokens, sessionMessages) {
    const totals = getSpendTotals();
    const proj = projectMonthly();

    console.log(`\n  ${chalk.bold("💰 Session Cost Summary")}\n`);
    console.log(`  ${chalk.dim("This session:")}   ${chalk.cyan("$" + sessionCost.toFixed(4))} · ${sessionTokens.toLocaleString()} tokens · ${sessionMessages} messages`);
    console.log(`  ${chalk.dim("Today total:")}    $${totals.today.cost.toFixed(4)} · ${totals.today.messages} messages`);
    console.log(`  ${chalk.dim("This month:")}     $${totals.month.cost.toFixed(4)} · ${totals.month.messages} messages`);

    if (proj) {
        console.log(`  ${chalk.dim("Monthly projection:")} ${BRAND("$" + proj.projection.toFixed(2))} ${chalk.dim("(at today's rate)")}`);
    }
    console.log("");
}

// ── Model comparison ──────────────────────────────────────────────────────────

/**
 * Show cost comparison across key models for a given token count.
 */
function printModelComparison(inputTokens, outputTokens) {
    const models = [
        ["claude-haiku-4-20250514",  "Claude Haiku"],
        ["claude-sonnet-4-20250514", "Claude Sonnet ★"],
        ["claude-opus-4-20250514",   "Claude Opus"],
        ["gpt-4o-mini",              "GPT-4o mini"],
        ["gpt-4o",                   "GPT-4o"],
        ["gemini-2.0-flash",         "Gemini Flash ★"],
        ["deepseek-chat",            "DeepSeek Chat ★"],
        ["deepseek-reasoner",        "DeepSeek R1"],
    ];

    console.log(`\n  ${chalk.bold("Model Cost Comparison")} ${chalk.dim(`· ${inputTokens}in + ${outputTokens}out tokens`)}\n`);
    console.log(`  ${"Model".padEnd(22)} ${"Cost".padStart(8)}`);
    console.log("  " + "─".repeat(32));

    for (const [model, label] of models) {
        const cost = calcCost(model, inputTokens, outputTokens);
        const costStr = cost < 0.0001 ? "<$0.0001" : "$" + cost.toFixed(4);
        const isHighlight = label.includes("★");
        const row = `  ${label.padEnd(22)} ${costStr.padStart(8)}`;
        console.log(isHighlight ? BRAND(row) : chalk.dim(row));
    }
    console.log("");
}

module.exports = {
    MODEL_COSTS,
    estimateTokens,
    calcCost,
    formatCostLine,
    recordUsage,
    getSpendTotals,
    checkBudget,
    projectMonthly,
    printCostSummary,
    printModelComparison,
};
