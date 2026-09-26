import axios, { AxiosInstance } from "axios";

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active?: boolean;
}

export interface IssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface Transition {
  id: string;
  name: string;
}

export interface CreatedIssue {
  id: string;
  key: string;
  self: string;
}

export interface WorklogInput {
  timeSpent: string;
  started: string;
  comment?: unknown;
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Minimal client for the Jira Cloud REST API v3. */
export class JiraClient {
  private readonly http: AxiosInstance;

  constructor(credentials: JiraCredentials) {
    const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString("base64");
    this.http = axios.create({
      baseURL: `${credentials.baseUrl.replace(/\/+$/, "")}/rest/api/3`,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  async myself(): Promise<JiraUser> {
    const res = await this.http.get<JiraUser>("/myself");
    return res.data;
  }

  async searchUsers(query: string): Promise<JiraUser[]> {
    const res = await this.http.get<JiraUser[]>("/user/search", { params: { query } });
    return res.data;
  }

  async getProjectIssueTypes(projectKey: string): Promise<IssueType[]> {
    const res = await this.http.get<{ issueTypes: IssueType[] }>(
      `/project/${encodeURIComponent(projectKey)}`,
    );
    return res.data.issueTypes;
  }

  async getIssueProjectKey(issueKey: string): Promise<string> {
    const res = await this.http.get<{ fields: { project: { key: string } } }>(
      `/issue/${encodeURIComponent(issueKey)}`,
      { params: { fields: "project" } },
    );
    return res.data.fields.project.key;
  }

  async createIssue(fields: Record<string, unknown>): Promise<CreatedIssue> {
    const res = await this.http.post<CreatedIssue>("/issue", { fields });
    return res.data;
  }

  async updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void> {
    await this.http.put(`/issue/${encodeURIComponent(issueKey)}`, { fields });
  }

  async addWorklog(issueKey: string, worklog: WorklogInput): Promise<void> {
    await this.http.post(`/issue/${encodeURIComponent(issueKey)}/worklog`, worklog);
  }

  async getTransitions(issueKey: string): Promise<Transition[]> {
    const res = await this.http.get<{ transitions: Transition[] }>(
      `/issue/${encodeURIComponent(issueKey)}/transitions`,
    );
    return res.data.transitions;
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.http.post(`/issue/${encodeURIComponent(issueKey)}/transitions`, {
      transition: { id: transitionId },
    });
  }
}
