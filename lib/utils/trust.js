/**
 * Trust & hallucination detection
 *
 * - Confidence scoring — model rates its own certainty, shown as a badge
 * - /verify — resends last answer to a second model for fact-check
 * - /disagree — second model argues against the first answer
 * - Flags responses containing version numbers, API names, dates (high hallucination risk)
 */

const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");

// ── Confidence request ────────────────────────────────────────────────────────

const CONFIDENCE_SUFFIX = "\n\n---\nRate your confidence in this response: HIGH / MEDIUM / LOW. One word only on the last line.";

/**
 * Append confidence request to the last user message in a messages array.
 */
function withConfidenceRequest(messages) {
    const copy = messages.map((m) => ({ ...m }));
    const lastUser = [...copy].reverse().find((m) => m.role === "user");
    if (lastUser) lastUser.content += CONFIDENCE_SUFFIX;
    return copy;
}

/**
 * Parse confidence rating from AI response.
 * Returns 'HIGH' | 'MEDIUM' | 'LOW' | null
 */
function parseConfidence(response) {
    const lines = response.trim().split("\n");
    const last = lines[lines.length - 1].trim().toUpperCase();
    if (last === "HIGH" || last === "MEDIUM" || last === "LOW") return last;

    // Fallback: look for confidence mention anywhere in last 3 lines
    const tail = lines.slice(-3).join(" ").toUpperCase();
    if (tail.includes("HIGH"))   return "HIGH";
    if (tail.includes("MEDIUM")) return "MEDIUM";
    if (tail.includes("LOW"))    return "LOW";

    return null;
}

/**
 * Strip the confidence rating line from the response text.
 */
function stripConfidenceLine(response) {
    const lines = response.trim().split("\n");
    const last = lines[lines.length - 1].trim().toUpperCase();
    if (last === "HIGH" || last === "MEDIUM" || last === "LOW") {
        return lines.slice(0, -1).join("\n").replace(/\n---\n$/, "").trimEnd();
    }
    return response;
}

/**
 * Render a confidence badge.
 *
 * HIGH   → 🟢 High confidence
 * MEDIUM → 🟡 Medium confidence
 * LOW    → 🔴 Low confidence — verify before using
 */
function renderConfidenceBadge(level) {
    if (!level) return "";
    const badges = {
        HIGH:   chalk.green("🟢 High confidence"),
        MEDIUM: chalk.yellow("🟡 Medium confidence"),
        LOW:    chalk.red("🔴 Low confidence — verify before using"),
    };
    return "  " + (badges[level] || "");
}

// ── Hallucination risk flags ──────────────────────────────────────────────────

// Patterns that frequently appear in hallucinated content
const HIGH_RISK_PATTERNS = [
    { re: /\bv\d+\.\d+[\.\d]*/g,           label: "version numbers" },
    { re: /\b(2019|2020|2021|2022|2023|2024|2025|2026)\b/g, label: "year references" },
    { re: /\b[A-Z][A-Za-z]+(?:API|SDK|CLI|JS|TS)\b/g,      label: "API/SDK names" },
    { re: /https?:\/\/[^\s)>\]"]+/g,        label: "URLs" },
    { re: /\bsince\s+(?:version|v)\s*[\d.]+/gi, label: "version claims" },
    { re: /\bdeprecated\s+in\s+v?[\d.]+/gi, label: "deprecation claims" },
];

/**
 * Scan response for high-risk hallucination patterns.
 * Returns array of { label, matches }
 */
function flagHighRiskContent(text) {
    const found = [];
    for (const { re, label } of HIGH_RISK_PATTERNS) {
        const matches = [...text.matchAll(new RegExp(re.source, re.flags))].map((m) => m[0]);
        if (matches.length > 0) {
            found.push({ label, matches: [...new Set(matches)].slice(0, 5) });
        }
    }
    return found;
}

/**
 * Render hallucination risk flags as a short inline warning.
 */
function renderRiskFlags(flags) {
    if (!flags.length) return null;
    const items = flags.map((f) => `${f.label}: ${f.matches.join(", ")}`).join(" · ");
    return `  ${chalk.yellow("⚠")} ${chalk.dim("Verify:")} ${chalk.dim(items)}`;
}

// ── /verify ───────────────────────────────────────────────────────────────────

/**
 * Build a fact-check prompt for the given response and question.
 */
function buildVerifyMessages(originalQuestion, originalResponse) {
    return [
        {
            role: "system",
            content: "You are a strict fact-checker. Your job is to verify the factual accuracy of an AI-generated response. Be skeptical. Check for: incorrect version numbers, wrong API names, outdated practices, logical errors, hallucinated links. State clearly what is CORRECT, what is WRONG, and what is UNCERTAIN.",
        },
        {
            role: "user",
            content: `Original question:\n${originalQuestion}\n\nAI response to verify:\n${originalResponse}\n\nFact-check this response. List: ✓ Correct, ✗ Wrong, ? Uncertain.`,
        },
    ];
}

// ── /disagree ────────────────────────────────────────────────────────────────

/**
 * Build a "devil's advocate" prompt to argue against the last response.
 */
function buildDisagreeMessages(originalQuestion, originalResponse) {
    return [
        {
            role: "system",
            content: "You are a senior engineer playing devil's advocate. Your job is to find problems with the proposed solution. Be constructively critical. Look for: edge cases missed, security issues, scalability problems, better alternatives, incorrect assumptions.",
        },
        {
            role: "user",
            content: `A developer asked:\n${originalQuestion}\n\nThey received this answer:\n${originalResponse}\n\nArgue against this answer. What's wrong with it? What would you do differently? Be specific.`,
        },
    ];
}

// ── Display helpers ───────────────────────────────────────────────────────────

function printVerifyHeader(provider) {
    console.log(`\n  ${chalk.cyan("🔍 Fact-checking with")} ${chalk.bold(provider)}...\n`);
}

function printDisagreeHeader(provider) {
    console.log(`\n  ${chalk.red("🔴 Devil's advocate")} ${chalk.dim("(")}${chalk.bold(provider)}${chalk.dim(")")}...\n`);
}

module.exports = {
    withConfidenceRequest,
    parseConfidence,
    stripConfidenceLine,
    renderConfidenceBadge,
    flagHighRiskContent,
    renderRiskFlags,
    buildVerifyMessages,
    buildDisagreeMessages,
    printVerifyHeader,
    printDisagreeHeader,
};
