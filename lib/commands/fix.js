const path = require("path");
const { spawn } = require("child_process");
const { hasBash, hasWSL, ensureInsideProject } = require("../utils/helpers");
const logger = require("../utils/logger");

async function fixCommand() {
    const dir = process.cwd();
    ensureInsideProject(dir);
    const LIB = path.join(__dirname, "..");
    const args = [path.join(LIB, "core", "engine.sh"), dir, "--fix-mode"];
    const cmd = hasBash() ? "bash" : hasWSL() ? "wsl" : null;
    if (!cmd) { logger.warn("  Bash required for fix command."); return; }
    const bashArgs = cmd === "wsl" ? ["bash", ...args] : args;
    const child = spawn(cmd, bashArgs, { stdio: "inherit", env: { ...process.env, TRYAPPSTACK_LIB: LIB } });
    child.on("close", (code) => process.exit(code || 0));
}

module.exports = fixCommand;
