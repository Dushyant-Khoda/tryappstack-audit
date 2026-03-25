/**
 * tas-audit context
 * Compressed AI Context Generator
 *
 * Generates a single optimised .tas-context.md file that users can attach
 * to ANY AI chat (Claude, ChatGPT, Gemini, etc.) as instant project context.
 *
 * Problem solved vs Claude Code / Cursor:
 *   - Claude Code reads raw files on demand → high token cost, no business context
 *   - Cursor needs indexing and stays in one IDE
 *   - tas-audit context → one structured file, works with any AI, ~90% fewer tokens,
 *     includes business context + architecture + issues + features in one shot
 *
 * No AI key required for generation. AI-enhanced if key is set.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

// Rough token estimator (1 token ≈ 4 chars)
function estimateTokens(str) {
    return Math.ceil(str.length / 4);
}

async function contextCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    const hasAI = !!key;
    const providerName = hasAI ? getProviderName(opts) : null;

    console.log(
        `\n  ${chalk.bold("🧠 AI Context Generator")} ` +
        (hasAI ? chalk.dim(`· ${providerName}`) : chalk.dim("· no AI needed for this command"))
    );
    console.log(chalk.dim("  Builds a portable context file — attach to any AI chat for instant project understanding\n"));

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, tech, features, routes, components, models, envVars, issues } = scan;
    const apis    = routes.filter((r) => r.type === "api");
    const pages   = routes.filter((r) => r.type === "page");
    const critical = issues.filter((i) => i.severity === "critical");
    const warnings = issues.filter((i) => i.severity === "warning");

    // Build the compact context sections
    const contextSections = _buildContextSections(scan, dir);
    const baseTokens = estimateTokens(contextSections);

    // AI enhancement: ask AI to write an executive summary + architecture diagram description
    let aiSummary = "";
    if (hasAI) {
        const aiSpinner = ora({ text: `  ${providerName} writing executive summary...`, color: "yellow" }).start();
        const prompt = `You are a senior engineer writing project documentation.
Analyse this project structure and write an executive summary for use as AI context.

${contextSections}

Write two sections ONLY (be concise — this will be used as AI prompt context):

## Executive Summary (3-4 sentences)
What this product does, what problem it solves, who uses it. Be specific — no filler.

## Architecture in One Paragraph
How the pieces connect: data flow, auth pattern, API structure, database access. Name actual packages.

Keep total response under 200 words. This will be prepended to every AI chat about this codebase.`;

        try {
            aiSummary = await callAI([{ role: "user", content: prompt }], opts);
            aiSpinner.stop();
        } catch (err) {
            aiSpinner.stop();
        }
    }

    // Generate the full context document
    const contextDoc = _buildContextDoc(scan, contextSections, aiSummary, providerName);
    const finalTokens = estimateTokens(contextDoc);

    // Also estimate raw file tokens (to show savings)
    const rawCodeEstimate = scan.scannedFiles * 150; // avg ~600 chars per file scanned
    const savingsPct = Math.round((1 - finalTokens / Math.max(rawCodeEstimate, 1)) * 100);

    // Save
    const outputPath = opts.output
        ? path.resolve(opts.output)
        : path.join(dir, ".tas-context.md");

    fs.writeFileSync(outputPath, contextDoc);

    console.log(`\n  ${chalk.green("✓")} Context file generated → ${chalk.bold(outputPath)}`);
    console.log(`\n  ${chalk.bold("Token efficiency:")}`);
    console.log(`  ${chalk.dim("Raw files (est):")}  ~${rawCodeEstimate.toLocaleString()} tokens`);
    console.log(`  ${chalk.green("This context:")}     ~${finalTokens.toLocaleString()} tokens`);
    console.log(`  ${BRAND.bold("Savings:")}          ~${Math.max(0, savingsPct)}% fewer tokens\n`);

    // Print ready-made usage prompts
    console.log(`  ${chalk.bold("How to use with any AI:")}\n`);

    const usagePrompts = [
        {
            tool: "Claude / ChatGPT",
            prompt: `Attach \`.tas-context.md\` as a file, then ask:\n    "${_getSamplePrompt(scan)}"`,
        },
        {
            tool: "Claude Code / Cursor",
            prompt: `Add to your \`.cursorrules\` or CLAUDE.md:\n    \`See .tas-context.md for full project context\``,
        },
        {
            tool: "Any AI",
            prompt: `Paste the first 100 lines of .tas-context.md before your question\n    to get context-aware answers about this codebase.`,
        },
    ];

    for (const { tool, prompt } of usagePrompts) {
        console.log(`  ${chalk.bold(tool)}`);
        console.log(chalk.dim("  " + prompt) + "\n");
    }

    // Print pre-built supercharged prompts
    console.log(`  ${chalk.bold("⚡ Supercharged prompt starters (paste into any AI + attach context):")}\n`);
    const prompts = _buildSuperchargedPrompts(scan);
    for (const p of prompts) {
        console.log(`  ${chalk.hex("#c8ff00")("→")} ${p.label}`);
        console.log(chalk.dim(`    "${p.prompt.slice(0, 90)}${p.prompt.length > 90 ? "..." : ""}"`));
        console.log("");
    }

    console.log(chalk.dim(`  Full prompts saved in .tas-context.md → "Supercharged Prompts" section\n`));
}

function _buildContextSections(scan) {
    const { framework, tech, features, routes, components, models, envVars, issues } = scan;
    const apis    = routes.filter((r) => r.type === "api");
    const pages   = routes.filter((r) => r.type === "page");
    const critical = issues.filter((i) => i.severity === "critical");
    const warnings = issues.filter((i) => i.severity === "warning");

    return [
        `PROJECT: ${scan.name} v${scan.version}`,
        `DESCRIPTION: ${scan.description || "not provided"}`,
        `FRAMEWORK: ${framework.name} | LANGUAGE: ${framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `STACK: ${tech.join(", ") || "none detected"}`,
        "",
        `FEATURES (${features.length}): ${features.map((f) => f.name + (f.detail ? ` [${f.detail}]` : "")).join(" | ")}`,
        "",
        `PAGES (${pages.length}):`,
        pages.map((r) => `  ${r.path} → ${r.file || "?"}`).join("\n"),
        "",
        `API ROUTES (${apis.length}):`,
        apis.map((r) => `  ${r.method || (r.methods ? r.methods.join(",") : "GET")} ${r.path} → ${r.file || "?"}`).join("\n"),
        "",
        `DB MODELS (${models.length}): ${models.map((m) => m.name + ` [${m.source}]`).join(", ") || "none"}`,
        "",
        `COMPONENTS (${components.length}):`,
        components.slice(0, 20).map((c) => `  ${c.name} (${c.type}, ${c.lines} lines${c.large ? " ⚠️ oversized" : ""})`).join("\n"),
        "",
        `ENV VARS (${envVars.length}): ${envVars.map((e) => e.name).join(", ")}`,
        "(Note: values never included — structure analysis only)",
        "",
        `CODE ISSUES: ${critical.length} critical | ${warnings.length} warnings`,
        critical.slice(0, 5).map((i) => `  CRITICAL [${i.category}]: ${i.message}`).join("\n"),
        warnings.slice(0, 5).map((i) => `  WARNING [${i.category}]: ${i.message}`).join("\n"),
    ].join("\n");
}

function _buildContextDoc(scan, contextSections, aiSummary, providerName) {
    const { framework, tech, features, routes, components, models, envVars, issues, scripts } = scan;
    const apis    = routes.filter((r) => r.type === "api");
    const pages   = routes.filter((r) => r.type === "page");
    const critical = issues.filter((i) => i.severity === "critical");
    const warnings = issues.filter((i) => i.severity === "warning");

    const prompts = _buildSuperchargedPrompts(scan);

    let doc = `# 🧠 AI Context — ${scan.name}

> **Attach this file to any AI chat for instant, accurate project context.**
> Generated by \`npx tryappstack-audit context\` · ${new Date().toISOString().slice(0, 10)}
${providerName ? `> AI-enhanced by ${providerName}` : ""}

---

`;

    if (aiSummary) {
        doc += `${aiSummary}\n\n---\n\n`;
    }

    doc += `## 📦 Project Identity

| | |
|-|-|
| **Name** | \`${scan.name}\` |
| **Version** | ${scan.version} |
| **Framework** | ${framework.name} |
| **Language** | ${framework.isTypeScript ? "TypeScript" : "JavaScript"} |
| **Description** | ${scan.description || "—"} |

## 🛠 Tech Stack

${tech.map((t) => `- ${t}`).join("\n") || "_not detected_"}

## ⚡ Features

${features.map((f) => `- **${f.name}**${f.detail ? ` (${f.detail})` : ""}`).join("\n") || "_none detected_"}

---

## 🗺 All Routes (${routes.length})

### Pages (${pages.length})
${pages.map((r) => `- \`${r.path}\` → \`${r.file || "?"}\``).join("\n") || "_none_"}

### API Endpoints (${apis.length})
${apis.map((r) => `- \`${r.method || (r.methods ? r.methods.join("|") : "GET")} ${r.path}\` → \`${r.file || "?"}\``).join("\n") || "_none_"}

---

## 🧩 Components (${components.length})
${components.map((c) => `- \`${c.name}\` (${c.type}, ${c.lines} lines${c.large ? ", ⚠️ oversized" : ""}${c.hooks && c.hooks.length > 0 ? ", hooks: " + c.hooks.join("+") : ""})`).join("\n") || "_none_"}

---

## 🗄️ Database Models (${models.length})
${models.map((m) => `- \`${m.name}\` [${m.source}]${m.fields && m.fields.length > 0 ? " — " + m.fields.join(", ") : ""}`).join("\n") || "_none detected_"}

---

## ⚙️ Environment Variables (${envVars.length})
> ⚠️ Names only — no values stored or transmitted.

${envVars.map((e) => `- \`${e.name}\`${e.comment ? " — " + e.comment : ""}${e.required ? " *(required)*" : ""}`).join("\n") || "_none_"}

---

## 🚨 Known Issues (${issues.length})

### Critical (${critical.length})
${critical.slice(0, 10).map((i) => `- 🔴 [${i.category}] ${i.message}${i.file ? " — \`" + i.file + (i.line ? ":" + i.line : "") + "\`" : ""}`).join("\n") || "_none_"}

### Warnings (${warnings.length})
${warnings.slice(0, 10).map((i) => `- 🟡 [${i.category}] ${i.message}`).join("\n") || "_none_"}

---

## 🚀 Scripts
\`\`\`bash
${Object.entries(scripts).map(([k, v]) => `npm run ${k.padEnd(15)} # ${v}`).join("\n") || "# none"}
\`\`\`

---

## ⚡ Supercharged Prompts

> Copy any prompt below + attach this file to get precise, context-aware AI answers.

${prompts.map((p, i) => `### ${i + 1}. ${p.label}\n\`\`\`\n${p.prompt}\n\`\`\``).join("\n\n")}

---

## 📊 Raw Context (Compact — for pasting inline)

\`\`\`
${contextSections}
\`\`\`

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · Regenerate: \`npx tryappstack-audit context\`*
*Source code, secrets, and env var values are NEVER included in this file.*
`;

    return doc;
}

function _buildSuperchargedPrompts(scan) {
    const { framework, tech, features, routes, issues } = scan;
    const hasAuth = features.some((f) => f.name === "Authentication");
    const hasPayments = features.some((f) => f.name === "Payments");
    const hasDB = features.some((f) => f.name === "Database ORM");
    const critical = issues.filter((i) => i.severity === "critical");

    return [
        {
            label: "Debug & Fix Critical Issues",
            prompt: `Using the context in .tas-context.md, help me fix the ${critical.length} critical issues found. Start with the highest security risk. For each fix, show the before/after code pattern.`,
        },
        {
            label: "Add a New Feature",
            prompt: `Using .tas-context.md as context: I want to add [FEATURE NAME] to my ${framework.name} app. Given my existing stack (${tech.slice(0, 3).join(", ")}), what's the best approach? Show me the implementation plan, files to create/modify, and code snippets.`,
        },
        hasAuth ? {
            label: "Audit the Auth Flow",
            prompt: `Using .tas-context.md: Review my auth implementation. Check for: session security, token handling, protected routes, role-based access. Point out exact vulnerabilities and fixes.`,
        } : null,
        hasPayments ? {
            label: "Review Payment Security",
            prompt: `Using .tas-context.md: Audit my Stripe payment integration. Check: webhook signature verification, idempotency, error handling, failed payment retry logic. Show any gaps.`,
        } : null,
        hasDB ? {
            label: "Database Query Optimisation",
            prompt: `Using .tas-context.md: Review my database queries for N+1 problems, missing indexes, and slow patterns. Given my ${tech.find((t) => ["Prisma", "Drizzle", "Mongoose", "TypeORM"].includes(t)) || "ORM"} setup, suggest specific optimisations.`,
        } : null,
        {
            label: "Write Tests for Critical Paths",
            prompt: `Using .tas-context.md: Write test cases for the 3 most critical user flows in my ${framework.name} app. Use ${scan.devDependencies.includes("vitest") ? "Vitest" : "Jest"} syntax. Include happy path + error cases.`,
        },
        {
            label: "Refactor for Production Scale",
            prompt: `Using .tas-context.md: My ${framework.name} app needs to scale to 10,000 users. What are the top 5 changes to make NOW? Be specific about which files and patterns to change.`,
        },
        {
            label: "Generate API Documentation",
            prompt: `Using .tas-context.md: Generate OpenAPI/Swagger documentation for all ${routes.filter((r) => r.type === "api").length} API endpoints. Include request/response shapes, auth requirements, and error codes.`,
        },
    ].filter(Boolean);
}

function _getSamplePrompt(scan) {
    const { framework, features } = scan;
    const hasAuth = features.some((f) => f.name === "Authentication");
    if (hasAuth) return `I've attached .tas-context.md. How is auth implemented in this ${framework.name} app and what security gaps exist?`;
    return `I've attached .tas-context.md. What are the top 3 improvements I should make to this ${framework.name} project?`;
}

module.exports = contextCommand;
