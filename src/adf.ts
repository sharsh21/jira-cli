export interface AdfDocument {
  type: "doc";
  version: 1;
  content: AdfParagraph[];
}

interface AdfParagraph {
  type: "paragraph";
  content: Array<{ type: "text"; text: string }>;
}

/**
 * Converts plain text to Atlassian Document Format (ADF), which Jira's v3 API
 * requires for descriptions and comments. Each non-blank line becomes a paragraph.
 */
export function textToAdf(text: string): AdfDocument {
  const paragraphs: AdfParagraph[] = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }));

  return {
    type: "doc",
    version: 1,
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }],
  };
}
