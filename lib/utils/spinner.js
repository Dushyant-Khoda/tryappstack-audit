/**
 * Premium spinner utility — wraps ora + cli-spinners.
 * Different animations per context to make the terminal feel alive.
 */

const ora = require("ora");
const chalk = require("chalk");

// Lazy-load cli-spinners to stay resilient if not yet installed
function getSpinners() {
    try { return require("cli-spinners"); } catch { return null; }
}

const SPINNER_MAP = {
    ai:       "dots12",      // AI call in progress
    scan:     "arc",         // scanning files
    code:     "binary",      // writing code
    think:    "dots",        // thinking / analysing
    save:     "bouncingBar", // saving file
    load:     "squareCorners",
    team:     "weather",     // team command
    brand:    "aesthetic",
    legal:    "clock",
    test:     "toggle",
    default:  "dots",
};

const BRAND_COLOR = "#c8ff00";

/**
 * Create a contextual spinner.
 * @param {string} text - Spinner label
 * @param {"ai"|"scan"|"code"|"think"|"save"|"team"|"brand"|"legal"|"test"|"default"} context
 */
function createSpinner(text, context = "default") {
    const spinners = getSpinners();
    const spinnerName = SPINNER_MAP[context] || "dots";

    let spinnerDef;
    if (spinners && spinners[spinnerName]) {
        spinnerDef = spinners[spinnerName];
    } else {
        spinnerDef = "dots";
    }

    return ora({
        text: `  ${text}`,
        spinner: spinnerDef,
        color: context === "ai" ? "cyan" : context === "code" ? "green" : "yellow",
        prefixText: "",
    });
}

/**
 * Shorthand: start a spinner immediately.
 */
function spin(text, context = "default") {
    return createSpinner(text, context).start();
}

/**
 * Spinner that shows elapsed time since start.
 * Good for longer AI calls.
 */
function timedSpin(text, context = "ai") {
    const start = Date.now();
    const spinnerInstance = createSpinner(text, context).start();

    const interval = setInterval(() => {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        spinnerInstance.text = `  ${text} ${chalk.dim(`(${elapsed}s)`)}`;
    }, 500);

    return {
        stop() {
            clearInterval(interval);
            spinnerInstance.stop();
        },
        succeed(msg) {
            clearInterval(interval);
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            spinnerInstance.succeed(`  ${msg || text} ${chalk.dim(`(${elapsed}s)`)}`);
        },
        fail(msg) {
            clearInterval(interval);
            spinnerInstance.fail(`  ${msg || text}`);
        },
    };
}

/**
 * Premium "AI is thinking" spinner with rotating status messages.
 * Shows the AI provider name and cycles through status lines.
 */
function aiThinkSpin(providerName, task) {
    const messages = [
        `${providerName} is thinking...`,
        `${providerName} is analysing...`,
        `${providerName} is writing...`,
        `${providerName} is reviewing...`,
        `Almost there...`,
    ];

    let idx = 0;
    const start = Date.now();
    const spinnerInstance = createSpinner(messages[0], "ai").start();

    const interval = setInterval(() => {
        idx = (idx + 1) % messages.length;
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        spinnerInstance.text = `  ${messages[idx]} ${chalk.dim(`· ${elapsed}s`)}`;
    }, 1800);

    return {
        stop() {
            clearInterval(interval);
            spinnerInstance.stop();
        },
        succeed(msg) {
            clearInterval(interval);
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            spinnerInstance.succeed(chalk.hex(BRAND_COLOR)(`  ${msg || "Done"}`) + chalk.dim(` · ${elapsed}s`));
        },
        fail(msg) {
            clearInterval(interval);
            spinnerInstance.fail(`  ${msg || "Failed"}`);
        },
    };
}

module.exports = { createSpinner, spin, timedSpin, aiThinkSpin };
