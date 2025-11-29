import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { markdownToHtml } from "../markdown";
import * as markedModule from "marked";

describe("markdownToHtml", () => {
  describe("basic markdown conversion", () => {
    it("converts headings to HTML", () => {
      expect(markdownToHtml("# Title")).toContain("<h1");
      expect(markdownToHtml("## Subtitle")).toContain("<h2");
      expect(markdownToHtml("### Section")).toContain("<h3");
    });

    it("converts bold text", () => {
      const result = markdownToHtml("**bold text**");
      expect(result).toContain("<strong>");
      expect(result).toContain("bold text");
    });

    it("converts italic text", () => {
      const result = markdownToHtml("*italic text*");
      expect(result).toContain("<em>");
      expect(result).toContain("italic text");
    });

    it("converts unordered lists", () => {
      const markdown = "- item 1\n- item 2\n- item 3";
      const result = markdownToHtml(markdown);
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>");
      expect(result).toContain("item 1");
    });

    it("converts ordered lists", () => {
      const markdown = "1. first\n2. second\n3. third";
      const result = markdownToHtml(markdown);
      expect(result).toContain("<ol>");
      expect(result).toContain("<li>");
    });

    it("converts links", () => {
      const result = markdownToHtml("[GitHub](https://github.com)");
      expect(result).toContain('<a href="https://github.com"');
      expect(result).toContain("GitHub");
    });

    it("converts code blocks", () => {
      const markdown = "```javascript\nconst x = 1;\n```";
      const result = markdownToHtml(markdown);
      expect(result).toContain("<code");
      expect(result).toContain("const x = 1");
    });

    it("converts inline code", () => {
      const result = markdownToHtml("use `const` keyword");
      expect(result).toContain("<code>");
      expect(result).toContain("const");
    });

    it("converts paragraphs", () => {
      const result = markdownToHtml("First paragraph.\n\nSecond paragraph.");
      expect(result).toContain("<p>");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = markdownToHtml("");
      expect(result).toBe("");
    });

    it("handles plain text without markdown", () => {
      const result = markdownToHtml("Just plain text");
      expect(result).toContain("Just plain text");
    });

    it("handles unicode characters", () => {
      const result = markdownToHtml("# Unicode: 日本語 emoji 🚀");
      expect(result).toContain("日本語");
      expect(result).toContain("🚀");
    });

    it("handles special characters in content", () => {
      const result = markdownToHtml("Characters: < > & \"");
      // Should be escaped in output
      expect(result).toContain("&lt;");
      expect(result).toContain("&gt;");
      expect(result).toContain("&amp;");
    });
  });

  describe("GitHub-flavored markdown", () => {
    it("converts task lists", () => {
      const markdown = "- [ ] unchecked\n- [x] checked";
      const result = markdownToHtml(markdown);
      expect(result).toContain("unchecked");
      expect(result).toContain("checked");
    });

    it("converts tables", () => {
      const markdown = "| Header |\n| ------ |\n| Cell   |";
      const result = markdownToHtml(markdown);
      expect(result).toContain("<table");
      expect(result).toContain("Header");
    });

    it("converts blockquotes", () => {
      const result = markdownToHtml("> This is a quote");
      expect(result).toContain("<blockquote>");
      expect(result).toContain("This is a quote");
    });
  });

  describe("report-specific patterns", () => {
    it("converts typical standup report structure", () => {
      const markdown = `## Work Completed

- Built feature X
- Fixed bug Y

## Blockers

None today.`;

      const result = markdownToHtml(markdown);
      expect(result).toContain("<h2");
      expect(result).toContain("Work Completed");
      expect(result).toContain("<ul>");
      expect(result).toContain("Built feature X");
      expect(result).toContain("Blockers");
    });

    it("converts citations with links", () => {
      const markdown =
        "Fixed issue in [PR #42](https://github.com/org/repo/pull/42)";
      const result = markdownToHtml(markdown);
      expect(result).toContain('<a href="https://github.com/org/repo/pull/42"');
      expect(result).toContain("PR #42");
    });
  });

  describe("error handling", () => {
    it("throws when marked returns Promise", () => {
      // Save original parse function
      const originalParse = markedModule.marked.parse;

      // Mock marked.parse to return a Promise
      (markedModule.marked as any).parse = jest.fn(() => Promise.resolve("<p>html</p>"));

      expect(() => markdownToHtml("test")).toThrow(
        "Markdown parsing returned a Promise unexpectedly",
      );

      // Restore original
      (markedModule.marked as any).parse = originalParse;
    });
  });
});
