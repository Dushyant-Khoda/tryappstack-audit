/**
 * Streaming AI runner with Ctrl+C interruption support.
 * Supports: Claude (Anthropic SSE) · OpenAI-compatible (OpenAI, Grok, DeepSeek)
 * Falls back to non-streaming for Gemini.
 *
 * Returns: { text, inputTokens, outputTokens, ttft, totalMs, interrupted }
 */

const https = require("https");
const { loadAIConfig } = require("../utils/helpers");

// ── SSE chunk parsers ─────────────────────────────────────────────────────────

function extractClaudeChunk(parsed) {
    if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
        return { text: parsed.delta.text || "" };
    }
    if (parsed.type === "message_delta" && parsed.usage) {
        return { outputTokens: parsed.usage.output_tokens };
    }
    if (parsed.type === "message_start" && parsed.message?.usage) {
        return { inputTokens: parsed.message.usage.input_tokens };
    }
    return {};
}

function extractOpenAIChunk(parsed) {
    const content = parsed.choices?.[0]?.delta?.content;
    return content ? { text: content } : {};
}

// ── Streaming HTTP request ────────────────────────────────────────────────────

function streamRequest(url, headers, body, callbacks, abortRef) {
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

        const result = {
            text: "",
            inputTokens: 0,
            outputTokens: 0,
            ttft: null,
            totalMs: 0,
            interrupted: false,
        };

        const startTime = Date.now();
        let firstTokenAt = null;

        const req = https.request(options, (res) => {
            let buffer = "";

            res.on("data", (chunk) => {
                if (abortRef.aborted) {
                    req.destroy();
                    return;
                }

                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === "data: [DONE]") continue;
                    if (!trimmed.startsWith("data:")) continue;

                    try {
                        const jsonStr = trimmed.slice(5).trim();
                        if (!jsonStr) continue;
                        const parsed = JSON.parse(jsonStr);

                        const extracted = callbacks.extractChunk(parsed);

                        if (extracted.text) {
                            if (!firstTokenAt) {
                                firstTokenAt = Date.now();
                                result.ttft = firstTokenAt - startTime;
                            }
                            result.text += extracted.text;
                            callbacks.onToken(extracted.text);
                        }
                        if (extracted.inputTokens)  result.inputTokens  = extracted.inputTokens;
                        if (extracted.outputTokens) result.outputTokens = extracted.outputTokens;
                    } catch { /* skip malformed chunks */ }
                }
            });

            res.on("end", () => {
                result.totalMs = Date.now() - startTime;
                // Estimate tokens if provider didn't return them
                if (!result.inputTokens)  result.inputTokens  = Math.ceil(postData.length / 4);
                if (!result.outputTokens) result.outputTokens = Math.ceil(result.text.length / 4);
                resolve(result);
            });

            res.on("error", reject);
        });

        req.on("error", (err) => {
            if (abortRef.aborted) {
                result.interrupted = true;
                result.totalMs = Date.now() - startTime;
                if (!result.inputTokens)  result.inputTokens  = Math.ceil(postData.length / 4);
                if (!result.outputTokens) result.outputTokens = Math.ceil(result.text.length / 4);
                resolve(result);
            } else {
                reject(err);
            }
        });

        req.setTimeout(120000, () => {
            req.destroy();
            reject(new Error("Stream timed out after 120s"));
        });

        req.write(postData);
        req.end();
    });
}

// ── Provider streaming calls ──────────────────────────────────────────────────

async function streamClaude(messages, key, model, temperature, callbacks, abortRef) {
    const sysMsg = messages.find((m) => m.role === "system");
    const convMsgs = messages.filter((m) => m.role !== "system");

    const body = {
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 4000,
        stream: true,
        messages: convMsgs,
    };
    if (sysMsg) body.system = sysMsg.content;
    // Claude ignores temperature for some models but accept it anyway
    if (temperature !== undefined && temperature !== 0.3) body.temperature = temperature;

    return streamRequest(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        body,
        { ...callbacks, extractChunk: extractClaudeChunk },
        abortRef
    );
}

async function streamOpenAI(messages, key, model, temperature, callbacks, abortRef, baseUrl) {
    const m = model || "gpt-4o";
    const isO1 = m.startsWith("o1");
    const body = isO1
        ? { model: m, messages: messages.filter((msg) => msg.role !== "system"), max_completion_tokens: 4000, stream: true }
        : { model: m, messages, max_tokens: 4000, temperature: temperature ?? 0.3, stream: true };

    return streamRequest(
        baseUrl || "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${key}` },
        body,
        { ...callbacks, extractChunk: extractOpenAIChunk },
        abortRef
    );
}

// Gemini doesn't stream in the same way — use buffered call
async function callGeminiFallback(messages, key, model) {
    const https2 = require("https");
    const m = model || "gemini-2.0-flash";
    const combined = messages
        .map((msg) => `${msg.role === "user" ? "Human" : "Model"}: ${msg.content}`)
        .join("\n\n");

    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: combined }] }],
            generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
        });
        const urlObj = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        };
        const startTime = Date.now();
        const req = https2.request(options, (res) => {
            let data = "";
            res.on("data", (c) => { data += c; });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    const usage = parsed?.usageMetadata || {};
                    resolve({
                        text,
                        inputTokens: usage.promptTokenCount || Math.ceil(combined.length / 4),
                        outputTokens: usage.candidatesTokenCount || Math.ceil(text.length / 4),
                        ttft: null,
                        totalMs: Date.now() - startTime,
                        interrupted: false,
                    });
                } catch (e) { reject(e); }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Stream AI response with Ctrl+C interruption support.
 *
 * @param {Array} messages
 * @param {object} opts — { aiProvider, aiKey, aiModel, temperature }
 * @param {object} callbacks — { onToken(text), onComplete(result), onInterrupt() }
 * @returns {Promise<{text, inputTokens, outputTokens, ttft, totalMs, interrupted}>}
 */
async function streamAI(messages, opts = {}, callbacks = {}) {
    const { provider, key, model } = require("../utils/helpers").loadAIConfig(opts);
    const temperature = opts.temperature ?? 0.3;

    if (!key) {
        const err = new Error("NO_AI_KEY");
        err.noKey = true;
        throw err;
    }

    const onToken    = callbacks.onToken    || ((t) => process.stdout.write(t));
    const onComplete = callbacks.onComplete || (() => {});
    const onInterrupt = callbacks.onInterrupt || (() => {});

    const abortRef = { aborted: false };

    // Set up SIGINT handler for stream interruption
    const prevSigint = process.rawListeners("SIGINT").slice();
    process.removeAllListeners("SIGINT");

    const sigintPromise = new Promise((resolveInterrupt) => {
        process.once("SIGINT", () => {
            abortRef.aborted = true;
            resolveInterrupt({ interrupted: true });
        });
    });

    const cbObj = { onToken };

    let streamPromise;
    switch (provider) {
        case "claude":
        case "anthropic":
            streamPromise = streamClaude(messages, key, model, temperature, cbObj, abortRef);
            break;
        case "openai":
        case "gpt":
            streamPromise = streamOpenAI(messages, key, model, temperature, cbObj, abortRef);
            break;
        case "grok":
        case "xai":
            streamPromise = streamOpenAI(messages, key, model, temperature, cbObj, abortRef, "https://api.x.ai/v1/chat/completions");
            break;
        case "deepseek":
            streamPromise = streamOpenAI(messages, key, model, temperature, cbObj, abortRef, "https://api.deepseek.com/chat/completions");
            break;
        case "gemini":
        case "google":
            // Gemini: show spinner, no streaming
            streamPromise = callGeminiFallback(messages, key, model).then((r) => {
                onToken(r.text); // emit all at once
                return r;
            });
            break;
        default:
            streamPromise = streamClaude(messages, key, model, temperature, cbObj, abortRef);
    }

    const result = await Promise.race([streamPromise, sigintPromise]);

    // Restore previous SIGINT listeners
    process.removeAllListeners("SIGINT");
    for (const listener of prevSigint) {
        process.on("SIGINT", listener);
    }

    if (result.interrupted) {
        abortRef.aborted = true;
        onInterrupt();
        return {
            text: "",
            inputTokens: 0,
            outputTokens: 0,
            ttft: null,
            totalMs: 0,
            interrupted: true,
        };
    }

    onComplete(result);
    return result;
}

module.exports = { streamAI };
