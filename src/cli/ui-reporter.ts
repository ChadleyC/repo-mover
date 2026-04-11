import chalk from 'chalk';
import cliProgress from 'cli-progress';

export class UIReporter {
  private multiBar: cliProgress.MultiBar;
  private bar: cliProgress.SingleBar | null = null;
  private barStarted = false;

  constructor() {
    this.multiBar = new cliProgress.MultiBar({
      format: `${chalk.blue('Migration Progress')} |${chalk.cyan('{bar}')}| {percentage}% || {value}/{total} Repositories || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: false,
    }, cliProgress.Presets.shades_grey);
  }

  start(total: number, message: string): void {
    console.log(chalk.blue.bold(`\n🚀 ${message}`));
    this.bar = this.multiBar.create(total, 0, { status: 'Starting...' });
    this.barStarted = true;
  }

  /** Prints a line cleanly above the progress bar (falls back to console.log before bar starts). */
  log(message: string): void {
    if (this.barStarted) {
      this.multiBar.log(message + '\n');
    } else {
      console.log(message);
    }
  }

  update(current: number, status: string): void {
    this.bar?.update(current, { status });
  }

  setStatus(status: string): void {
    this.bar?.update(this.bar.getProgress(), { status });
  }

  increment(status?: string): void {
    this.bar?.increment(1, status ? { status } : undefined);
  }

  stop(message: string): void {
    this.multiBar.stop();
    this.barStarted = false;
    console.log(chalk.green.bold(`\n✅ ${message}\n`));
  }

  error(message: string, error?: any): void {
    const extra = error ? `\n   ${chalk.red(error.message || String(error))}` : '';
    this.log(chalk.red.bold(`❌ ${message}`) + extra);
  }

  info(message: string): void {
    this.log(chalk.cyan(`ℹ️  ${message}`));
  }

  success(message: string): void {
    this.log(chalk.green(`✔ ${message}`));
  }

  showWelcomeBanner(): void {
    const border = chalk.blue('╔══════════════════════════════════════════════╗');
    const footer = chalk.blue('╚══════════════════════════════════════════════╝');
    const side = chalk.blue('║');
    const title   = `${side}  ${chalk.bold.white('        🚀  Repo Mover  🚀        ')}          ${side}`;
    const line1   = `${side}  ${chalk.dim('Migrate repositories from Bitbucket')}       ${side}`;
    const line2   = `${side}  ${chalk.dim('to GitHub with ease.')}                      ${side}`;
    console.log(`\n${border}\n${title}\n${line1}\n${line2}\n${footer}\n`);
  }

  showSection(title: string, step: number, total: number): void {
    const divider = chalk.blue('─'.repeat(45));
    const stepText = chalk.bold(`  Step ${step} of ${total}`);
    const titleText = chalk.cyan(title);
    console.log(`\n${divider}\n${stepText} · ${titleText}\n${divider}\n`);
  }
}
