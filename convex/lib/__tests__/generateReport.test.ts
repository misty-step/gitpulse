import { describe, expect, it } from "@jest/globals";
import { DAILY_SECTION_TITLES, WEEKLY_SECTION_TITLES } from "../reportSchemas";
import {
  parseReportSections,
  sectionsToMarkdown,
  stripJsonFence,
  type ReportSection,
} from "../generateReport";

jest.mock("../../_generated/api", () => ({
  api: {},
  internal: {},
}));

describe("generateReport helpers", () => {
  it("parseReportSections - valid daily JSON returns sections array", () => {
    const sections = DAILY_SECTION_TITLES.map((title, index) => ({
      title,
      bullets: [`${title} bullet`],
      citations: index === 0 ? ["https://github.com/gitpulse"] : [],
    }));
    const payload = JSON.stringify({ sections });

    const result = parseReportSections(payload, "daily");

    expect(result.parseError).toBeUndefined();
    expect(result.sections).toHaveLength(DAILY_SECTION_TITLES.length);
    expect(result.sections[0]?.title).toBe(DAILY_SECTION_TITLES[0]);
  });

  it("parseReportSections - valid weekly JSON returns 4 sections", () => {
    const sections = WEEKLY_SECTION_TITLES.map((title) => ({
      title,
      bullets: [`${title} bullet`],
      citations: [],
    }));
    const payload = JSON.stringify({ sections });

    const result = parseReportSections(payload, "weekly");

    expect(result.parseError).toBeUndefined();
    expect(result.sections).toHaveLength(4);
  });

  it("parseReportSections - invalid JSON returns empty sections + parseError", () => {
    const result = parseReportSections("{not-json", "daily");

    expect(result.sections).toEqual([]);
    expect(result.parseError).toBeDefined();
  });

  it("parseReportSections - malformed schema returns empty sections + parseError", () => {
    const payload = JSON.stringify({
      sections: [
        { title: "Wrong Title", bullets: [], citations: [] },
        { title: "Other", bullets: [], citations: [] },
        { title: "Nope", bullets: [], citations: [] },
      ],
    });

    const result = parseReportSections(payload, "daily");

    expect(result.sections).toEqual([]);
    expect(result.parseError).toBeDefined();
  });

  it("sectionsToMarkdown - converts sections to markdown format", () => {
    const sections: ReportSection[] = [
      {
        title: "Work Completed",
        bullets: ["Shipped feature A", "Fixed bug B"],
        citations: [],
      },
      {
        title: "Momentum & Next Steps",
        bullets: ["Start refactor C"],
        citations: [],
      },
    ];

    const markdown = sectionsToMarkdown(sections);

    expect(markdown).toBe(
      "## Work Completed\n- Shipped feature A\n- Fixed bug B\n\n## Momentum & Next Steps\n- Start refactor C",
    );
  });

  it("sectionsToMarkdown - empty sections returns empty string", () => {
    expect(sectionsToMarkdown([])).toBe("");
  });

  it("stripJsonFence - removes code fences from JSON response", () => {
    const fenced = '```json\n{"sections":[]}\n```';

    expect(stripJsonFence(fenced)).toBe('{"sections":[]}');
  });
});
