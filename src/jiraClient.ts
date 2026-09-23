import axios, { AxiosInstance } from "axios";
import { JiraConfig } from "./config.js";

export class JiraClient {
  private http: AxiosInstance;

  constructor(config: JiraConfig) {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString(
      "base64"
    );
    this.http = axios.create({
      baseURL: `${config.baseUrl.replace(/\/$/, "")}/rest/api/3`,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  async myself() {
    const res = await this.http.get("/myself");
    return res.data;
  }

  async searchUser(query: string) {
    const res = await this.http.get("/user/search", { params: { query } });
    return res.data as Array<{ accountId: string; displayName: string; emailAddress?: string }>;
  }

  async createIssue(fields: Record<string, unknown>) {
    const res = await this.http.post("/issue", { fields });
    return res.data as { id: string; key: string; self: string };
  }

  async getIssue(issueKey: string) {
    const res = await this.http.get(`/issue/${issueKey}`);
    return res.data;
  }

  async updateIssue(issueKey: string, fields: Record<string, unknown>) {
    await this.http.put(`/issue/${issueKey}`, { fields });
  }

  async addWorklog(
    issueKey: string,
    body: { timeSpent: string; comment?: unknown; started?: string }
  ) {
    const res = await this.http.post(`/issue/${issueKey}/worklog`, body);
    return res.data;
  }

  async getTransitions(issueKey: string) {
    const res = await this.http.get(`/issue/${issueKey}/transitions`);
    return res.data.transitions as Array<{ id: string; name: string }>;
  }

  async transitionIssue(issueKey: string, transitionId: string) {
    await this.http.post(`/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
  }
}

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data) {
      const messages = (data as any).errorMessages;
      const errors = (data as any).errors;
      const parts = [
        ...(Array.isArray(messages) ? messages : []),
        ...(errors ? Object.entries(errors).map(([k, v]) => `${k}: ${v}`) : []),
      ];
      if (parts.length) return parts.join("; ");
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
