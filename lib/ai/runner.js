/**
 * Node.js AI runner for tryappstack-audit.
 * Supports: Claude · GPT-4o · Grok · Gemini · DeepSeek
 * Uses built-in https — zero extra dependencies.
 */

const https = require("https");
const { loadAIConfig } = require("../utils/helpers");

// ── HTTP utility ──────────────────────────────────────────────────────────────

function httpsPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = JSON.stringify(body);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
                ...headers,
            },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${data.slice(0, 300)}`)); }
            });
        });

        req.on("error", reject);
        req.setTimeout(45000, () => {
            req.destroy();
            reject(new Error("AI request timed out after 45s"));
        });
        req.write(postData);
        req.end();
    });
}

// ── Provider callers ──────────────────────────────────────────────────────────

async function callClaude(messages, key, model) {
    const sysMsg = messages.find((m) => m.role === "system");
    const convMsgs = messages.filter((m) => m.role !== "system");

    const body = {
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: convMsgs,
    };
    if (sysMsg) body.system = sysMsg.content;

    const data = await httpsPost(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        body
    );
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error(data?.error?.message || "Empty response from Claude");
    return text;
}

async function callOpenAI(messages, key, model) {
    const m = model || "gpt-4o";
    // o1 models don't support system messages or temperature
    const isO1 = m.startsWith("o1");
    const payload = isO1
        ? { model: m, messages: messages.filter((msg) => msg.role !== "system"), max_completion_tokens: 4000 }
        : { model: m, messages, max_tokens: 4000, temperature: 0.3 };
    const data = await httpsPost(
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${key}` },
        payload
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(data?.error?.message || "Empty response from OpenAI");
    return text;
}

async function callGrok(messages, key, model) {
    const data = await httpsPost(
        "https://api.x.ai/v1/chat/completions",
        { Authorization: `Bearer ${key}` },
        { model: model || "grok-3", messages, max_tokens: 4000, temperature: 0.3 }
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(data?.error?.message || "Empty response from Grok");
    return text;
}

async function callGemini(messages, key, model) {
    const m = model || "gemini-2.0-flash";
    const combined = messages
        .map((msg) => `${msg.role === "user" ? "Human" : "Model"}: ${msg.content}`)
        .join("\n\n");

    const data = await httpsPost(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
        {},
        {
            contents: [{ parts: [{ text: combined }] }],
            generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
        }
    );
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(data?.error?.message || "Empty response from Gemini");
    return text;
}

async function callDeepSeek(messages, key, model) {
    const data = await httpsPost(
        "https://api.deepseek.com/chat/completions",
        { Authorization: `Bearer ${key}` },
        { model: model || "deepseek-chat", messages, max_tokens: 4000, temperature: 0.3 }
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(data?.error?.message || "Empty response from DeepSeek");
    return text;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call the configured AI provider.
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {object} opts  - optional override { aiProvider, aiKey }
 * @returns {Promise<string>}
 */
async function callAI(messages, opts = {}) {
    const { provider, key, model } = loadAIConfig(opts);
    const temperature = opts.temperature ?? 0.3;

    if (!key) {
        const err = new Error("NO_AI_KEY");
        err.noKey = true;
        throw err;
    }

    switch (provider) {
        case "claude":
        case "anthropic":
            return callClaude(messages, key, model, temperature);
        case "openai":
        case "gpt":
            return callOpenAI(messages, key, model, temperature);
        case "grok":
        case "xai":
            return callGrok(messages, key, model, temperature);
        case "gemini":
        case "google":
            return callGemini(messages, key, model, temperature);
        case "deepseek":
            return callDeepSeek(messages, key, model, temperature);
        default:
            return callClaude(messages, key, model, temperature);
    }
}

/**
 * Get the configured provider name (for display).
 */
function getProviderName(opts = {}) {
    const { provider, model } = loadAIConfig(opts);
    const names = {
        claude: "🟣 Claude", anthropic: "🟣 Claude",
        openai: "🟢 GPT",    gpt: "🟢 GPT",
        grok: "🔵 Grok",    xai: "🔵 Grok",
        gemini: "🟡 Gemini", google: "🟡 Gemini",
        deepseek: "🔴 DeepSeek",
    };
    const base = names[provider] || "🟣 Claude";
    return model ? `${base} · ${model}` : base;
}

module.exports = { callAI, getProviderName };
