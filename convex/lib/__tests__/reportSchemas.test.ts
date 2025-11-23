import { describe, expect, it } from "@jest/globals";
import {
  DAILY_SECTION_TITLES,
  WEEKLY_SECTION_TITLES,
  DailyReportSchema,
  WeeklyReportSchema,
  type DailyReportPayload,
  type WeeklyReportPayload,
} from "../reportSchemas";

const metadata = {
  githubUsername: "octocat",
  timeframe: {
    start: new Date("2025-11-01T00:00:00Z").toISOString(),
    end: new Date("2025-11-02T00:00:00Z").toISOString(),
    days: 1,
  },
  repoCount: 2,
  eventCount: 10,
  promptVersion: "v1",
  generatedAt: new Date().toISOString(),
};

describe("report schemas", () => {
  it("accepts a valid daily payload", () => {
    const sections: DailyReportPayload["sections"] = [
      {
        title: DAILY_SECTION_TITLES[0],
        body: `${DAILY_SECTION_TITLES[0]} body`,
        bulletPoints: ["Point one"],
        citationUrls: ["https://github.com/gitpulse"],
      },
      {
        title: DAILY_SECTION_TITLES[1],
        body: `${DAILY_SECTION_TITLES[1]} body`,
        bulletPoints: [],
        citationUrls: [],
      },
      {
        title: DAILY_SECTION_TITLES[2],
        body: `${DAILY_SECTION_TITLES[2]} body`,
        bulletPoints: [],
        citationUrls: [],
      },
    ];

    const payload: DailyReportPayload = {
      kind: "daily",
      metadata,
      sections,
      citations: [
        {
          url: "https://github.com/gitpulse",
          context: "Referenced commit",
        },
      ],
    };

    expect(() => DailyReportSchema.parse(payload)).not.toThrow();
  });

  it("rejects weekly payloads with unexpected section headings", () => {
    const payload = {
      kind: "weekly",
      metadata,
      sections: WEEKLY_SECTION_TITLES.map((title) => ({
        title,
        body: `${title} summary`,
        bulletPoints: [],
        citationUrls: [],
      })).map((section, index) =>
        index === 0 ? { ...section, title: "Wins" } : section,
      ),
      citations: [],
    } as unknown as WeeklyReportPayload;

    expect(() => WeeklyReportSchema.parse(payload)).toThrow();
  });

  it("requires citation URLs when provided", () => {
    const payload = {
      kind: "daily",
      metadata,
      sections: DAILY_SECTION_TITLES.map((title) => ({
        title,
        body: `${title} body`,
        bulletPoints: [],
        citationUrls: [],
      })),
      citations: [
        {
          url: "not-a-url",
          context: "bad",
        },
      ],
    } as unknown as DailyReportPayload;

    expect(() => DailyReportSchema.parse(payload)).toThrow();
  });
});
