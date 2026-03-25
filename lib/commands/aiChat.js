const fs = require("fs");
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");
const { callAI, getProviderName } = require("../ai/runner");
const { getLatestReport, extractProjectInfo, extractScoresFromReport } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

async function aiChatCommand(directory, opts) {
    const dir = path.resolve(directory);

    const report = getLatestReport(dir);
    if (!report) {
        console.log(chalk.red("\n  ✗ No audit reports found in ./audits/"));
        console.log(chalk.dim("  Run an audit first: ") + BRAND("npx tryappstack-audit"));
        process.exit(1);
    }

    const { project, framework, score } = extractProjectInfo(report.content);
    const scores = extractScoresFromReport(report.content);

    const scoreLines = Object.entries(scores)
        .sort((a, b) => a[1] - b[1])
        .map(([mod, s]) => `${mod}: ${s}/100`)
        .join(", ");

    const provider = getProviderName(opts);

    console.log(`\n  ${chalk.bold("💬 AI Chat")} ${chalk.dim(`· ${provider}`)}`);
    console.log(chalk.dim(`  Project: ${project} · Framework: ${framework} · Score: ${score ?? "??"}/100`));
    console.log(chalk.dim(`  Based on: ${report.filename}`));
    console.log(chalk.dim("  Type your question. Commands: /exit /clear /save /report\n"));
    console.log("  " + chalk.dim("─".repeat(58)) + "\n");

    // Seed the conversation with audit context as system
    const systemContent = `You are a code quality expert and senior ${framework} engineer. 
You are reviewing the audit results of a project called "${project}" (${framework}).

Audit scores: ${scoreLines}

Full audit report excerpt:
${report.content.slice(0, 3000)}

Your role:
- Answer questions about this specific project's audit results
- Give actionable, specific advice for ${framework}
- Reference specific scores and modules when relevant
- Be concise but thorough
- Suggest concrete code examples when asked

IMPORTANT: Never reveal the full report content unless asked. Keep responses focused and practical.`;

    const messages = [
        { role: "system", content: systemContent },
    ];

    // Warm up with greeting
    const greetingPrompt = `Briefly introduce yourself and summarize the top 3 most critical issues found in this ${framework} project based on the audit scores. Keep it under 100 words.`;
    messages.push({ role: "user", content: greetingPrompt });

    try {
        const greeting = await callAI(messages, opts);
        messages.push({ role: "assistant", content: greeting });
        console.log("  " + chalk.hex("#c8ff00").bold("AI:") + "\n");
        console.log(greeting.split("\n").map((l) => "  " + l).join("\n"));
        console.log("");
    } catch (err) {
        if (err.noKey) {
            console.log(chalk.yellow("  ⚠ AI not configured."));
            console.log(chalk.dim("  Run: ") + BRAND("npx tryappstack-audit ai-setup"));
        } else {
            console.log(chalk.red(`  ✗ AI error: ${err.message}`));
        }
        process.exit(1);
    }

    // Chat history for optional save
    const chatLog = [];

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: process.stdin.isTTY,
    });

    const ask = () => {
        rl.question("  " + chalk.bold("You:") + " ", async (input) => {
            const trimmed = input.trim();

            if (!trimmed) { ask(); return; }

            // Commands
            if (trimmed === "/exit" || trimmed === "exit" || trimmed === "quit") {
                console.log(chalk.dim("\n  Goodbye! Run ") + BRAND("npx tryappstack-audit") + chalk.dim(" for a fresh audit.\n"));
                rl.close();
                return;
            }

            if (trimmed === "/clear") {
                console.clear();
                console.log(`\n  ${chalk.bold("💬 AI Chat")} ${chalk.dim(`· ${provider} · ${project}`)}\n`);
                ask();
                return;
            }

            if (trimmed === "/report") {
                console.log("\n" + report.content.split("\n").slice(0, 40).map((l) => "  " + l).join("\n"));
                console.log(chalk.dim("\n  [showing first 40 lines]\n"));
                ask();
                return;
            }

            if (trimmed === "/save") {
                const timestamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
                const outputDir = path.join(dir, "audits");
                fs.mkdirSync(outputDir, { recursive: true });
                const outputFile = path.join(outputDir, `chat-${timestamp}.md`);
                const content = `# 💬 AI Chat Session — ${project}\n\n> **Generated:** ${new Date().toISOString().slice(0, 19)}\n> **AI Agent:** ${provider}\n\n---\n\n${chatLog.map((m) => `**${m.role === "user" ? "You" : "AI"}:**\n\n${m.content}\n`).join("\n---\n\n")}`;
                fs.writeFileSync(outputFile, content);
                console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
                ask();
                return;
            }

            // Regular message
            messages.push({ role: "user", content: trimmed });
            chatLog.push({ role: "user", content: trimmed });

            process.stdout.write("\n  " + chalk.hex("#c8ff00").bold("AI:") + " ");

            try {
                const response = await callAI(messages, opts);
                messages.push({ role: "assistant", content: response });
                chatLog.push({ role: "assistant", content: response });
                console.log("\n");
                console.log(response.split("\n").map((l) => "  " + l).join("\n"));
                console.log("");
            } catch (err) {
                console.log(chalk.red(`\n  Error: ${err.message}\n`));
            }

            ask();
        });
    };

    ask();
}

module.exports = aiChatCommand;
