/**
 * tas-audit brand
 * AI Marketing Strategist — ICP, GTM, ready-made prompts for AI tools
 *
 * ⚠️  AI-generated strategy. Validate with real market research.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

async function brandCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    if (!key) {
        console.log(chalk.yellow("\n  ✗ AI key required for brand strategy.\n"));
        console.log("  Configure once: " + BRAND("npx tryappstack-audit ai-setup") + "\n");
        process.exit(1);
    }

    const providerName = getProviderName(opts);
    console.log(`\n  ${chalk.bold("🎯 AI Marketing Strategist")} ${chalk.dim(`· ${providerName}`)}`);
    console.log(chalk.dim("  Thinking like: CMO at Linear · Loom · Vercel\n"));

    // Gather context
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "productDesc",
            message: "  In one sentence, what does your product do?",
            validate: (v) => v.trim().length > 5 || "Please describe your product",
        },
        {
            type: "input",
            name: "targetAudience",
            message: "  Who is your primary audience? (e.g. 'indie hackers', 'enterprise dev teams')",
            default: "developers and technical founders",
        },
        {
            type: "input",
            name: "competitors",
            message: "  Top 2-3 competitors (comma-separated, or leave blank)",
            default: "",
        },
        {
            type: "list",
            name: "stage",
            message: "  Where are you in the journey?",
            choices: ["Pre-launch", "Just launched", "Early traction", "Growing", "Scaling"],
            default: "Just launched",
        },
        {
            type: "checkbox",
            name: "channels",
            message: "  Which channels will you focus on?",
            choices: ["Twitter/X", "LinkedIn", "Product Hunt", "Dev.to / Hashnode", "YouTube", "Reddit", "Newsletter", "Cold outreach", "SEO / Blog"],
            default: ["Twitter/X", "Product Hunt"],
        },
    ]);

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    spinner.stop();

    const { framework, tech, features } = scan;

    const aiSpinner = ora({ text: `  ${providerName} is building your brand kit...`, color: "yellow" }).start();

    const ctx = [
        `Product: ${scan.name} — "${answers.productDesc}"`,
        `Framework: ${framework.name} | Tech: ${tech.slice(0, 5).join(", ")}`,
        `Features: ${features.map((f) => f.name).join(", ")}`,
        `Audience: ${answers.targetAudience}`,
        `Stage: ${answers.stage}`,
        `Competitors: ${answers.competitors || "not specified"}`,
        `Channels: ${answers.channels.join(", ")}`,
    ].join("\n");

    const prompt = `You are a world-class CMO with experience building brand strategies for Linear, Loom, and Vercel.
Build a complete brand and go-to-market kit for this product.

PRODUCT CONTEXT:
${ctx}

Generate a brand kit with EXACT sections:

---

## 🎯 Ideal Customer Profile (ICP)
**Primary persona:** Name, role, company size, pain points, goals, where they hang out online.
**Secondary persona:** (if applicable)
**Anti-persona:** Who is NOT your customer (save on wasted marketing spend).

## 💬 Positioning Statement
One-liner: "[Product] is the [category] for [audience] who want to [outcome] without [pain]."
3 alternatives ranked by resonance.

## ✨ Value Proposition
**Headline:** (< 8 words)
**Sub-headline:** (< 20 words)
**3 core benefits:** (specific, not generic)
**Proof points:** What data / metrics / features back up each benefit?

## 🗺 Go-to-Market Strategy — ${answers.stage}
For each selected channel (${answers.channels.join(", ")}):
- Specific tactic for THIS product (not generic)
- Content angle that will resonate
- Expected outcome and timeline
- Resources needed

## 🚀 Ready-Made AI Prompts
Prompts optimised for Claude/ChatGPT. Copy-paste directly:

### Landing Page Hero Copy
\`\`\`
Prompt: Write a landing page hero section for [paste this]: ${answers.productDesc}
Target audience: ${answers.targetAudience}
Tone: [developer-friendly / professional / playful]
Include: Headline, subheadline, 3 bullet benefits, CTA button text.
Competitor differentiation: [better than ${answers.competitors || "alternatives"} because...]
\`\`\`

### Product Hunt Launch Post
\`\`\`
Prompt: Write a Product Hunt launch post for ${scan.name}.
Tagline (< 60 chars): ...
Description (< 260 chars): ...
First comment (maker note, 150-200 words): ...
Key features to highlight: ${features.slice(0, 3).map((f) => f.name).join(", ")}
\`\`\`

### Twitter/X Thread
\`\`\`
Prompt: Write a 7-tweet thread launching ${scan.name} to ${answers.targetAudience}.
Tweet 1: Hook (problem statement)
Tweet 2-5: Solution / demo / features
Tweet 6: Social proof / numbers
Tweet 7: CTA with link
Style: conversational, technical, no cringe
\`\`\`

### Cold Outreach to Investors (Pre-seed / Seed)
\`\`\`
Prompt: Write a 150-word cold email to a seed-stage investor.
Product: ${answers.productDesc}
Traction: [add your metrics]
Ask: intro call
Tone: direct, no fluff, founder energy
\`\`\`

### SEO Blog Post Outline
\`\`\`
Prompt: Create an SEO blog post outline targeting developers searching for [pain point this solves].
Product: ${scan.name} — ${answers.productDesc}
Target keyword: [best alternative to ${answers.competitors || "manual approach"}]
Structure: Problem → Solution → Tutorial → CTA
Include: code examples using ${framework.name}
\`\`\`

### App Store / Directory Description
\`\`\`
Prompt: Write a 150-word product description for ${scan.name} for use on:
- npm registry
- GitHub README tagline  
- Product directories (G2, Capterra, Indie Hackers)
Audience: ${answers.targetAudience}
Core value: ${answers.productDesc}
\`\`\`

## 🏆 Competitive Differentiation
vs. ${answers.competitors || "alternatives"}:
- What you do better (be specific)
- What they do better (be honest — helps you position)
- Your unique angle (the thing only you can claim)

## 📊 Launch Checklist — ${answers.stage}
Week 1 actions ranked by impact. Specific to ${answers.channels.join(", ")}.

---
⚠️ AI-generated strategy. Test with real users. Iterate fast.`;

    let result = "";
    try {
        result = await callAI([{ role: "user", content: prompt }], opts);
        aiSpinner.stop();
    } catch (err) {
        aiSpinner.stop();
        console.log(chalk.red("  AI call failed: " + err.message));
        process.exit(1);
    }

    console.log(`\n  ${BRAND.bold("🎯 Brand & GTM Kit")} ${chalk.dim(`· ${providerName}`)}\n`);
    console.log(result.split("\n").map((l) => "  " + l).join("\n"));
    console.log(chalk.dim("\n  ⚠️  AI-generated strategy. Validate with real user research and A/B testing.\n"));

    // Save
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `brand-${timestamp}.md`);

    const md = `# 🎯 Brand & GTM Kit — ${scan.name}

> **Product:** ${answers.productDesc}
> **Audience:** ${answers.targetAudience} · **Stage:** ${answers.stage}
> **Channels:** ${answers.channels.join(", ")}
> **AI Agent:** ${providerName}
> **Generated:** ${new Date().toISOString().slice(0, 19)}
> ⚠️ *AI-generated strategy. Test with real users. Iterate fast.*

---

${result}

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit brand\`*
`;

    fs.writeFileSync(outputFile, md);
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
}

module.exports = brandCommand;
