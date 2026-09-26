import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { CliError } from "./errors.js";

/**
 * Line-based prompts, with support for hidden input (e.g. API tokens).
 * Reads through an async line iterator so piped input isn't lost between questions.
 */
export class Prompter {
  private muted = false;
  private readonly rl: readline.Interface;
  private readonly lines: AsyncIterator<string>;

  constructor() {
    // readline echoes typed characters through this stream; muting it hides secrets.
    const output = new Writable({
      write: (chunk, encoding, callback) => {
        if (!this.muted) stdout.write(chunk, encoding);
        callback();
      },
    });
    this.rl = readline.createInterface({ input: stdin, output, terminal: stdin.isTTY });
    this.lines = this.rl[Symbol.asyncIterator]();
  }

  async ask(question: string, defaultValue?: string): Promise<string> {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    stdout.write(`${question}${suffix}: `);
    return (await this.readLine()) || defaultValue || "";
  }

  async askSecret(question: string): Promise<string> {
    stdout.write(`${question}: `);
    this.muted = true;
    try {
      return await this.readLine();
    } finally {
      this.muted = false;
      stdout.write("\n");
    }
  }

  close(): void {
    this.rl.close();
  }

  private async readLine(): Promise<string> {
    const { value, done } = await this.lines.next();
    if (done) throw new CliError("Input ended before setup was complete.");
    return value.trim();
  }
}
