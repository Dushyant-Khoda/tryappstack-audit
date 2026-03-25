/**
 * Local search — full search across all past conversations
 *
 * - /star — bookmark any message
 * - /search <query> — search all indexed content
 * - Auto-extracts and indexes code blocks separately
 * - /digest — weekly digest of starred responses
 * - /cost-tags — cost breakdown per /tag label
 *
 * Index stored at: ~/.tryappstack/search-index.json
 * Starred at:      ~/.tryappstack/starred.json
 * Tags at:         ~/.tryappstack/tags.json
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

const BRAND = chalk.hex("#c8ff00");

const BASE    = path.join(os.homedir(), ".tryappstack");
const IDX     = path.join(BASE, "search-index.json");
const STARRED = path.join(BASE, "starred.json");
const TAGS    = path.join(BASE, "tags.json");

function ensureBase() { fs.mkdirSync(BASE, { recursive: true }); }

function load(file) {
    if (!fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}

function save(file, data) {
    ensureBase();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Code block extractor ──────────────────────────────────────────────────────

function extractCodeBlocks(text) {
    const re = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    const blocks = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        blocks.push({ lang: m[1] || "text", code: m[2].trim() });
    }
    return blocks;
}

// ── Index ─────────────────────────────────────────────────────────────────────

/**
 * Add a message to the search index.
 */
function indexMessage(sessionName, role, content, meta = {}) {
    const idx = load(IDX);
    const codeBlocks = role === "assistant" ? extractCodeBlocks(content) : [];

    idx.push({
        id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        session: sessionName || "unnamed",
        role,
        content: content.slice(0, 2000),    // cap for index size
        codeBlocks,
        ts: new Date().toISOString(),
        tag: meta.tag || null,
        cost: meta.cost || 0,
    });

    // Keep index lean: last 2000 entries
    if (idx.length > 2000) idx.splice(0, idx.length - 2000);
    save(IDX, idx);
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Simple fuzzy search across the index.
 * @returns {Array} top N matches, sorted by relevance
 */
function search(query, limit = 10) {
    const idx = load(IDX);
    if (!idx.length) return [];

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const scored = idx.map((entry) => {
        const haystack = (entry.content + " " + entry.codeBlocks.map((b) => b.code).join(" ")).toLowerCase();
        const score = terms.reduce((s, t) => {
            const count = (haystack.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
            return s + count;
        }, 0);
        return { ...entry, score };
    });

    return scored
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function printSearchResults(results, query) {
    if (!results.length) {
        console.log(chalk.dim(`\n  No results for "${query}"\n`));
        return;
    }
    console.log(`\n  ${BRAND.bold(`Search: "${query}"`)} ${chalk.dim(`(${results.length} results)`)}\n`);
    for (const r of results) {
        const dt = new Date(r.ts).toLocaleDateString();
        const preview = r.content.replace(/\n+/g, " ").slice(0, 90);
        const codeInfo = r.codeBlocks.length ? chalk.dim(` [${r.codeBlocks.length} code block(s)]`) : "";
        console.log(`  ${chalk.dim(r.session)} ${chalk.dim(dt)}  ${chalk.dim(r.role === "assistant" ? "AI" : "you")}`);
        console.log(`  ${preview}${codeInfo}\n`);
    }
}

// ── Star / Bookmark ───────────────────────────────────────────────────────────

function starMessage(content, sessionName, meta = {}) {
    const starred = load(STARRED);
    const entry = {
        id: Date.now(),
        session: sessionName || "unnamed",
        content: content.slice(0, 3000),
        codeBlocks: extractCodeBlocks(content),
        ts: new Date().toISOString(),
        tag: meta.tag || null,
    };
    starred.unshift(entry);
    // Keep last 500 stars
    if (starred.length > 500) starred.length = 500;
    save(STARRED, starred);
    return entry.id;
}

function getStarred(limit = 20) {
    return load(STARRED).slice(0, limit);
}

function printStarred(limit = 10) {
    const starred = getStarred(limit);
    if (!starred.length) {
        console.log(chalk.dim("\n  No starred messages. Use /star after a good response.\n"));
        return;
    }
    console.log(`\n  ${BRAND.bold("⭐ Starred Messages")} ${chalk.dim(`(${starred.length} total, showing ${Math.min(starred.length, limit)})`)}\n`);
    for (const s of starred) {
        const dt = new Date(s.ts).toLocaleDateString();
        const preview = s.content.replace(/\n+/g, " ").slice(0, 80);
        const code = s.codeBlocks.length ? chalk.dim(` · ${s.codeBlocks.length} code snippet(s)`) : "";
        const tag = s.tag ? chalk.cyan(` [${s.tag}]`) : "";
        console.log(`  ${chalk.dim("#" + s.id)} ${chalk.dim(dt)} ${chalk.dim(s.session)}${tag}`);
        console.log(`  ${preview}${code}\n`);
    }
}

// ── Weekly digest ─────────────────────────────────────────────────────────────

function weeklyDigest() {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const starred = load(STARRED).filter((s) => new Date(s.ts).getTime() > oneWeekAgo);
    return starred.slice(0, 5);
}

function printWeeklyDigest() {
    const items = weeklyDigest();
    if (!items.length) {
        console.log(chalk.dim("\n  No starred messages this week.\n"));
        return;
    }
    console.log(`\n  ${BRAND.bold("📋 Weekly Digest")} ${chalk.dim("— your top starred responses this week")}\n`);
    for (const s of items) {
        const dt = new Date(s.ts).toLocaleDateString();
        const preview = s.content.replace(/\n+/g, " ").slice(0, 100);
        const code = s.codeBlocks.length ? chalk.dim(` · ${s.codeBlocks.length} code blocks`) : "";
        console.log(`  ${chalk.dim(dt)} ${chalk.dim(s.session)}`);
        console.log(`  ${preview}${code}\n`);
        if (s.codeBlocks.length > 0) {
            const b = s.codeBlocks[0];
            console.log(`  ${chalk.dim("```" + b.lang)}`);
            b.code.split("\n").slice(0, 5).forEach((l) => console.log(`  ${chalk.dim(l)}`));
            if (b.code.split("\n").length > 5) console.log(chalk.dim("  ..."));
            console.log(`  ${chalk.dim("```")}\n`);
        }
    }
}

// ── Cost tags ─────────────────────────────────────────────────────────────────

function recordTagCost(tag, cost, tokens) {
    const tags = (() => { try { return JSON.parse(fs.readFileSync(TAGS, "utf8")); } catch { return {}; } })();
    if (!tags[tag]) tags[tag] = { cost: 0, tokens: 0, count: 0 };
    tags[tag].cost   += cost;
    tags[tag].tokens += tokens;
    tags[tag].count  += 1;
    ensureBase();
    fs.writeFileSync(TAGS, JSON.stringify(tags, null, 2));
}

function printCostTags() {
    const tags = (() => { try { return JSON.parse(fs.readFileSync(TAGS, "utf8")); } catch { return {}; } })();
    const keys = Object.keys(tags);
    if (!keys.length) {
        console.log(chalk.dim("\n  No tagged exchanges yet. Use /tag <label> before sending a message.\n"));
        return;
    }

    console.log(`\n  ${BRAND.bold("💰 Cost by Tag")}\n`);
    const sorted = keys.sort((a, b) => tags[b].cost - tags[a].cost);
    const maxCost = tags[sorted[0]].cost;

    for (const tag of sorted) {
        const t = tags[tag];
        const pct = maxCost > 0 ? Math.round((t.cost / maxCost) * 16) : 0;
        const bar = "█".repeat(pct) + "░".repeat(16 - pct);
        const avgCost = t.count > 0 ? t.cost / t.count : 0;
        console.log(`  ${BRAND(tag.padEnd(20))} ${chalk.dim(bar)} $${t.cost.toFixed(4)} ${chalk.dim(`· ${t.count} msgs · avg $${avgCost.toFixed(4)}`)}`);
    }
    console.log("");
}

module.exports = {
    indexMessage,
    extractCodeBlocks,
    search,
    printSearchResults,
    starMessage,
    getStarred,
    printStarred,
    weeklyDigest,
    printWeeklyDigest,
    recordTagCost,
    printCostTags,
};
