import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { textToAdf } from "./adf.js";

describe("textToAdf", () => {
  it("turns each non-blank line into a paragraph", () => {
    const doc = textToAdf("First line\r\n\n  \nSecond line");
    assert.deepEqual(
      doc.content.map((p) => p.content[0]?.text),
      ["First line", "Second line"],
    );
  });

  it("returns one empty paragraph for blank text", () => {
    assert.deepEqual(textToAdf("").content, [{ type: "paragraph", content: [] }]);
  });
});
