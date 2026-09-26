import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CliError } from "./errors.js";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  myAccountId: string;
  defaultProjectKey?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".jira-cli");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const REQUIRED_FIELDS = ["baseUrl", "email", "apiToken", "myAccountId"] as const;

export function configPath(): string {
  return CONFIG_PATH;
}

export async function loadConfig(): Promise<JiraConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(CONFIG_PATH, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CliError(`No config found at ${CONFIG_PATH}. Run 'jira-cli config init' first.`);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError(`${CONFIG_PATH} is not valid JSON. Run 'jira-cli config init' to recreate it.`);
  }

  const config = parsed as Partial<JiraConfig>;
  const missing = REQUIRED_FIELDS.filter((field) => typeof config[field] !== "string" || !config[field]);
  if (missing.length > 0) {
    throw new CliError(
      `${CONFIG_PATH} is missing ${missing.join(", ")}. Run 'jira-cli config init' to recreate it.`
    );
  }
  return config as JiraConfig;
}

export async function saveConfig(config: JiraConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  // writeFile only applies `mode` when creating the file, so tighten an existing one too.
  // This is a no-op on Windows, where the file inherits the user profile's ACLs.
  await fs.chmod(CONFIG_PATH, 0o600);
}
