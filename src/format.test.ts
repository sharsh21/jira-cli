import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeBaseUrl,
  parseDate,
  parseDuration,
  parseIssueKey,
  toJiraDateTime,
} from "./format.js";

describe("parseDuration", () => {
  it("accepts Jira duration formats", () => {
    for (const value of ["2h", "30m", "1d", "1w", "1h30m", "1d 4h", " 3h 30m "]) {
      assert.equal(parseDuration(value), value.trim());
    }
  });

  it("rejects anything else", () => {
    for (const value of ["", "2", "1.5h", "2 hours", "h2"]) {
      assert.throws(() => parseDuration(value), /Invalid duration/);
    }
  });
});

describe("parseIssueKey", () => {
  it("upper-cases valid keys", () => {
    assert.equal(parseIssueKey("eng-123"), "ENG-123");
    assert.equal(parseIssueKey("MY_PROJ2-7"), "MY_PROJ2-7");
  });

  it("rejects invalid keys", () => {
    for (const value of ["ENG", "123", "ENG-", "-1", "ENG 1"]) {
      assert.throws(() => parseIssueKey(value), /Invalid issue key/);
    }
  });
});

describe("parseDate", () => {
  it("parses ISO 8601", () => {
    assert.equal(parseDate("2026-09-26T10:00:00Z").toISOString(), "2026-09-26T10:00:00.000Z");
  });

  it("rejects garbage", () => {
    assert.throws(() => parseDate("yesterday"), /Invalid date/);
  });
});

describe("toJiraDateTime", () => {
  it("uses the format Jira's worklog API expects", () => {
    const value = toJiraDateTime(new Date(2026, 8, 26, 9, 5, 7, 42));
    assert.match(value, /^2026-09-26T09:05:07\.042[+-]\d{4}$/);
  });
});

describe("normalizeBaseUrl", () => {
  it("strips paths and trailing slashes", () => {
    assert.equal(normalizeBaseUrl("https://acme.atlassian.net/"), "https://acme.atlassian.net");
    assert.equal(normalizeBaseUrl(" https://acme.atlassian.net/jira "), "https://acme.atlassian.net");
  });

  it("requires https", () => {
    assert.throws(() => normalizeBaseUrl("http://acme.atlassian.net"), /https/);
    assert.throws(() => normalizeBaseUrl("acme.atlassian.net"), /Invalid URL/);
  });
});
