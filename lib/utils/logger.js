const chalk = require("chalk");

/**
 * Simple logger for CLI output.
 * Use for consistent styling across commands.
 */
const logger = {
    info(message) {
        console.log(chalk.cyan(message));
    },
    success(message) {
        console.log(chalk.green(message));
    },
    warn(message) {
        console.log(chalk.yellow(message));
    },
    error(message) {
        console.log(chalk.red(message));
    },
    dim(message) {
        console.log(chalk.gray(message));
    },
    brand(message) {
        console.log(chalk.hex("#c8ff00")(message));
    },
};

module.exports = logger;
