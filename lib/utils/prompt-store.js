/**
 * Prompt store — save/load/export/import prompt packs
 *
 * Individual prompts: ~/.tryappstack/prompts/<name>.txt
 * Prompt packs (YAML/JSON): ~/.tryappstack/prompts/<pack>.prompts.yaml
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

const PROMPTS_DIR = path.join(os.homedir(), ".tryappstack", "prompts");
const BRAND = chalk.hex("#c8ff00");

function ensurePromptsDir() {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
}

// ── Save single prompt ────────────────────────────────────────────────────────

/**
 * Save a prompt by name.
 */
function savePrompt(name, text) {
    ensurePromptsDir();
    const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "-");
    const p = path.join(PROMPTS_DIR, `${safe}.txt`);
    fs.writeFileSync(p, text);
    return p;
}

/**
 * Load a saved prompt by name.
 */
function loadPrompt(name) {
    const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "-");
    const p = path.join(PROMPTS_DIR, `${safe}.txt`);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf8");
}

/**
 * List all saved prompts.
 */
function listPrompts() {
    ensurePromptsDir();
    return fs.readdirSync(PROMPTS_DIR)
        .filter((f) => f.endsWith(".txt"))
        .map((f) => ({
            name: f.replace(".txt", ""),
            preview: fs.readFileSync(path.join(PROMPTS_DIR, f), "utf8").slice(0, 60).replace(/\n/g, " "),
        }));
}

function deletePrompt(name) {
    const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "-");
    const p = path.join(PROMPTS_DIR, `${safe}.txt`);
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
    return false;
}

// ── YAML serializer/parser ────────────────────────────────────────────────────

/**
 * Serialize a prompt pack to YAML string.
 */
function toYAML(pack) {
    const lines = [
        `name: ${pack.name}`,
        `description: ${pack.description || ""}`,
        `version: ${pack.version || "1.0"}`,
        `author: ${pack.author || ""}`,
        `created: ${new Date().toISOString()}`,
        `prompts:`,
    ];

    for (const p of pack.prompts) {
        lines.push(`  - id: ${p.id}`);
        lines.push(`    description: ${p.description || ""}`);
        // Multi-line text with literal block scalar
        lines.push(`    text: |`);
        const textLines = p.text.split("\n");
        for (const tl of textLines) {
            lines.push(`      ${tl}`);
        }
    }

    return lines.join("\n") + "\n";
}

/**
 * Parse a YAML prompt pack (handles our specific format only).
 */
function fromYAML(yaml) {
    const pack = { name: "", description: "", version: "1.0", prompts: [] };
    const lines = yaml.split("\n");
    let i = 0;

    // Parse top-level scalars
    while (i < lines.length) {
        const line = lines[i];

        if (/^name:\s*(.+)/.test(line))        pack.name = line.replace(/^name:\s*/, "").trim();
        else if (/^description:\s*(.+)/.test(line)) pack.description = line.replace(/^description:\s*/, "").trim();
        else if (/^version:\s*(.+)/.test(line))  pack.version = line.replace(/^version:\s*/, "").trim();
        else if (line.trim() === "prompts:") {
            i++;
            // Parse prompts list
            while (i < lines.length) {
                const pl = lines[i];
                if (/^  - id:\s*(.+)/.test(pl)) {
                    const prompt = {
                        id: pl.replace(/^  - id:\s*/, "").trim(),
                        description: "",
                        text: "",
                    };
                    i++;
                    // Parse prompt fields
                    while (i < lines.length) {
                        const pfl = lines[i];
                        if (/^    description:\s*(.*)/.test(pfl)) {
                            prompt.description = pfl.replace(/^    description:\s*/, "").trim();
                            i++;
                        } else if (/^    text:\s*\|/.test(pfl)) {
                            i++;
                            const textLines = [];
                            while (i < lines.length && /^      /.test(lines[i])) {
                                textLines.push(lines[i].replace(/^      /, ""));
                                i++;
                            }
                            prompt.text = textLines.join("\n").trimEnd();
                        } else if (/^    text:\s*(.+)/.test(pfl)) {
                            prompt.text = pfl.replace(/^    text:\s*/, "").trim();
                            i++;
                        } else if (/^  - id:/.test(pfl) || /^[a-z]/.test(pfl)) {
                            break;
                        } else {
                            i++;
                        }
                    }
                    pack.prompts.push(prompt);
                } else {
                    i++;
                }
            }
            continue;
        }
        i++;
    }

    return pack;
}

// ── Pack save/load ────────────────────────────────────────────────────────────

/**
 * Export a prompt pack to a .yaml file.
 */
function exportPack(pack, outputPath) {
    const yaml = toYAML(pack);
    const p = outputPath || path.join(process.cwd(), `${pack.name}.prompts.yaml`);
    fs.writeFileSync(p, yaml);
    return p;
}

/**
 * Import a prompt pack from a .yaml or .json file.
 */
function importPack(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (filePath.endsWith(".json")) {
        return JSON.parse(content);
    }
    return fromYAML(content);
}

/**
 * Save an imported pack's prompts into the local store.
 */
function installPack(pack) {
    ensurePromptsDir();
    let count = 0;
    for (const p of pack.prompts) {
        savePrompt(p.id, p.text);
        count++;
    }
    return count;
}

// ── Print ─────────────────────────────────────────────────────────────────────

function printPrompts() {
    const prompts = listPrompts();
    if (prompts.length === 0) {
        console.log(chalk.dim("  No saved prompts. Use /save <name> to save one.\n"));
        return;
    }
    console.log(`\n  ${chalk.bold("Saved Prompts")} ${chalk.dim(`(${prompts.length})`)}\n`);
    for (const p of prompts) {
        console.log(`  ${BRAND(p.name.padEnd(24))} ${chalk.dim(p.preview + "...")}`);
    }
    console.log("");
}

module.exports = {
    savePrompt,
    loadPrompt,
    listPrompts,
    deletePrompt,
    exportPack,
    importPack,
    installPack,
    toYAML,
    fromYAML,
    printPrompts,
};
