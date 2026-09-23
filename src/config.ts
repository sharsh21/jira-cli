import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  myAccountId: string;
  defaultProjectKey?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".jira-cli");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<JiraConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as JiraConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `No config found at ${CONFIG_PATH}. Run 'jira-cli config init' first.`
      );
    }
    throw err;
  }
}

export async function saveConfig(config: JiraConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function configPath(): string {
  return CONFIG_PATH;
}
