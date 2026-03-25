const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

async function codeDocsCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    const hasAI = !!key;
    const providerName = hasAI ? getProviderName(opts) : null;

    console.log(
        `\n  ${chalk.bold("📖 Project Docs Generator")} ` +
        (hasAI ? chalk.dim(`· ${providerName}`) : chalk.dim("· basic mode  (run ai-setup for AI-enhanced docs)"))
    );

    const spinner = ora({ text: "  Scanning project structure...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, routes, components, features, envVars, models, tech } = scan;
    const pages = routes.filter((r) => r.type === "page");
    const apis  = routes.filter((r) => r.type === "api");

    console.log(chalk.dim(
        `  Discovered: ${routes.length} routes · ${components.length} components · ` +
        `${features.length} features · ${envVars.length} env vars · ${models.length} models · ${scan.scannedFiles} files\n`
    ));

    // AI architecture analysis
    let aiAnalysis = "";
    if (hasAI) {
        const aiSpinner = ora({ text: `  AI is analysing your architecture (${providerName})...`, color: "yellow" }).start();

        const summary = {
            name: scan.name,
            version: scan.version,
            description: scan.description,
            framework: framework.name,
            language: framework.isTypeScript ? "TypeScript" : "JavaScript",
            tech,
            features: features.map((f) => f.name + (f.detail ? " (" + f.detail + ")" : "")),
            pages: pages.slice(0, 20).map((r) => r.path),
            apiEndpoints: apis.slice(0, 25).map((r) => ({ method: r.method || (r.methods ? r.methods.join(",") : "GET"), path: r.path })),
            components: components.slice(0, 20).map((c) => ({ name: c.name, type: c.type, lines: c.lines })),
            models: models.map((m) => ({ name: m.name, source: m.source })),
            envVars: envVars.map((e) => e.name),
            scripts: Object.keys(scan.scripts),
        };

        const prompt = `You are a technical documentation expert writing docs for a ${framework.name} project called "${scan.name}".

Project summary:
${JSON.stringify(summary, null, 2)}

Write the following sections. Be specific to this project's actual stack. No generic boilerplate.

## 🏗 Architecture Overview
Explain the overall architecture pattern (e.g. feature-based, layered, MVC, islands). How the ${framework.name} pieces connect. Be specific.

## 🌊 Request / Data Flow
Step-by-step: user action → frontend → API → database → response. Include auth flow if applicable. Use a numbered list.

## 🔐 Security Model
How authentication and authorization are implemented. What's protected and how. Any gaps.

## 📈 Scalability Notes
What components will bottleneck under load. What caching/queuing is or should be in place. What horizontal scaling looks like.

## 🚀 Deployment Guide
How to deploy this specific ${framework.name} + ${tech.slice(0, 3).join(" + ")} stack to production. Include platform-specific notes (Vercel, Railway, Fly.io, AWS, etc.).

## 💡 Onboarding — Key Things to Know
5 non-obvious facts a new developer MUST know to be productive in this codebase immediately.

Be concise and expert. Reference real package names. No filler text.`;

        try {
            aiAnalysis = await callAI([{ role: "user", content: prompt }], opts);
            aiSpinner.stop();
        } catch (err) {
            aiSpinner.stop();
            if (!err.noKey) console.log(chalk.dim(`  AI analysis unavailable: ${err.message}`));
        }
    }

    // Build the documentation
    const doc = _buildDocs(scan, aiAnalysis, providerName);

    const outputPath = opts.output
        ? path.resolve(opts.output)
        : path.join(dir, "PROJECT_DOCS.md");

    fs.writeFileSync(outputPath, doc);

    console.log("  " + chalk.green("✓") + " " + BRAND.bold("PROJECT_DOCS.md") + " → " + chalk.dim(outputPath));
    console.log(
        chalk.dim(`\n  ${pages.length} pages · ${apis.length} API routes · ` +
        `${components.length} components · ${envVars.length} env vars · ${models.length} models\n`)
    );
}

function _buildDocs(scan, aiAnalysis, providerName) {
    const { framework, routes, components, features, envVars, models, tech } = scan;
    const pages = routes.filter((r) => r.type === "page");
    const apis  = routes.filter((r) => r.type === "api");
    const largeComponents = components.filter((c) => c.large);

    let doc = `# 📖 Project Documentation — ${scan.name}

> **Auto-generated by [tryappstack-audit](https://tryappstack.vercel.app)**
${providerName ? `> **AI-Enhanced:** ${providerName}\n` : ""}>  **Generated:** ${new Date().toISOString().slice(0, 19)}
> Run \`npx tryappstack-audit codedocs\` to regenerate

---

## 🏗 Project Overview

| Property | Value |
|----------|-------|
| **Name** | \`${scan.name}\` |
| **Version** | ${scan.version} |
| **Framework** | ${framework.name} |
| **Language** | ${framework.isTypeScript ? "TypeScript" : "JavaScript"} |
${scan.description ? `| **Description** | ${scan.description} |\n` : ""}| **Total Routes** | ${routes.length} (${pages.length} pages · ${apis.length} API) |
| **Components** | ${components.length}${largeComponents.length > 0 ? ` ⚠️ ${largeComponents.length} oversized` : ""} |
| **Env Variables** | ${envVars.length} |
| **DB Models** | ${models.length} |

`;

    // Tech stack
    if (tech.length > 0) {
        doc += `## 🛠 Tech Stack\n\n${tech.map((t) => `- ${t}`).join("\n")}\n\n`;
    }

    // Features
    if (features.length > 0) {
        doc += `## ⚡ Features\n\n${features.map((f) => `- ${f.icon || "✅"} **${f.name}**${f.detail ? ` (${f.detail})` : ""}`).join("\n")}\n\n`;
    }

    doc += `---\n\n`;

    // Pages
    if (pages.length > 0) {
        doc += `## 📄 Pages (${pages.length})\n\n`;
        doc += `| Route | File |\n|-------|------|\n`;
        for (const r of pages) {
            doc += `| \`${r.path}\` | \`${r.file || "—"}\` |\n`;
        }
        doc += "\n";
    }

    // API endpoints
    if (apis.length > 0) {
        doc += `## 🌐 API Endpoints (${apis.length})\n\n`;
        doc += `| Method | Route | File |\n|--------|-------|------|\n`;
        for (const r of apis) {
            const methods = r.methods ? r.methods.join(", ") : r.method || "GET";
            doc += `| \`${methods}\` | \`${r.path}\` | \`${r.file || "—"}\` |\n`;
        }
        doc += "\n";
    }

    doc += `---\n\n`;

    // Components
    if (components.length > 0) {
        doc += `## 🧩 Components (${components.length})\n\n`;
        doc += `| Component | Type | Lines | Hooks | Notes |\n|-----------|------|-------|-------|-------|\n`;
        for (const c of components) {
            const hooksStr = c.hooks && c.hooks.length > 0 ? c.hooks.join(", ") : "—";
            const notes = [];
            if (c.large) notes.push("⚠️ oversized");
            if (c.hasDirectFetch) notes.push("⚡ direct fetch");
            if (c.hasMemo) notes.push("✅ memoized");
            doc += `| \`${c.name}\` | ${c.type} | ${c.lines} | ${hooksStr} | ${notes.join(", ") || "—"} |\n`;
        }
        doc += "\n";
        if (largeComponents.length > 0) {
            doc += `> ⚠️ **Oversized components** (>300 lines): ${largeComponents.map((c) => `\`${c.name}\``).join(", ")} — consider splitting\n\n`;
        }
    }

    // DB models
    if (models.length > 0) {
        doc += `---\n\n## 🗄️ Database Models (${models.length})\n\n`;
        doc += `| Model | ORM | Key Fields |\n|-------|-----|------------|\n`;
        for (const m of models) {
            const fields = m.fields && m.fields.length > 0 ? m.fields.slice(0, 6).join(", ") : "—";
            doc += `| \`${m.name}\` | ${m.source} | ${fields} |\n`;
        }
        doc += "\n";
    }

    // Env vars
    if (envVars.length > 0) {
        doc += `---\n\n## ⚙️ Environment Variables (${envVars.length})\n\n`;
        doc += `| Variable | Required | Description |\n|----------|----------|-------------|\n`;
        for (const e of envVars) {
            const req = e.required ? "✅ Yes" : "⚪ Optional";
            const desc = e.comment || (e.example ? `e.g. \`${e.example}\`` : "—");
            doc += `| \`${e.name}\` | ${req} | ${desc} |\n`;
        }
        doc += "\n";
    }

    // Scripts
    const scriptEntries = Object.entries(scan.scripts);
    if (scriptEntries.length > 0) {
        doc += `---\n\n## 🚀 Available Scripts\n\n\`\`\`bash\n`;
        for (const [name, cmd] of scriptEntries) {
            doc += `npm run ${name.padEnd(15)} # ${cmd}\n`;
        }
        doc += "```\n\n";
    }

    // Dependencies summary
    if (scan.dependencies.length > 0) {
        doc += `---\n\n## 📦 Dependencies (${scan.dependencies.length} prod · ${scan.devDependencies.length} dev)\n\n`;
        doc += `<details>\n<summary>Show all dependencies</summary>\n\n`;
        doc += `**Production:** ${scan.dependencies.join(", ")}\n\n`;
        doc += `**Dev:** ${scan.devDependencies.join(", ")}\n\n`;
        doc += `</details>\n\n`;
    }

    // AI analysis
    if (aiAnalysis) {
        doc += `---\n\n## 🤖 AI Architecture Analysis\n\n${aiAnalysis}\n\n`;
    }

    doc += `---\n\n*Auto-generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit codedocs\`*\n*Regenerate anytime — this file is safe to commit*\n`;

    return doc;
}

module.exports = codeDocsCommand;
