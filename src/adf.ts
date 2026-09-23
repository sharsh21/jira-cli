export function textToADF(text: string) {
  const paragraphs = text.split("\n").filter((line) => line.length > 0);
  return {
    type: "doc",
    version: 1,
    content: paragraphs.length
      ? paragraphs.map((line) => ({
          type: "paragraph",
          content: [{ type: "text", text: line }],
        }))
      : [{ type: "paragraph", content: [] }],
  };
}
