import { z } from "zod";

export const DAILY_SECTION_TITLES = [
  "Work Completed",
  "Key Decisions & Context",
  "Momentum & Next Steps",
] as const;

export const WEEKLY_SECTION_TITLES = [
  "Accomplishments",
  "Technical Insights",
  "Challenges & Growth",
  "Momentum & Direction",
] as const;

export const CitationSchema = z.object({
  url: z.string().url(),
  context: z.string().min(1).max(400),
});

export const SectionSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  bulletPoints: z.array(z.string().min(1)).default([]),
  citationUrls: z.array(z.string().url()).default([]),
});

export const ReportMetadataSchema = z.object({
  githubUsername: z.string().min(1),
  timeframe: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
    days: z.number().int().positive(),
  }),
  repoCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  promptVersion: z.string().min(1),
  generatedAt: z.string().min(1),
});

const BaseReportSchema = z.object({
  metadata: ReportMetadataSchema,
  citations: z.array(CitationSchema),
});

export const DailyReportSchema = BaseReportSchema.extend({
  kind: z.literal("daily"),
  sections: z.tuple([
    SectionSchema.extend({ title: z.literal(DAILY_SECTION_TITLES[0]) }),
    SectionSchema.extend({ title: z.literal(DAILY_SECTION_TITLES[1]) }),
    SectionSchema.extend({ title: z.literal(DAILY_SECTION_TITLES[2]) }),
  ]),
});

export const WeeklyReportSchema = BaseReportSchema.extend({
  kind: z.literal("weekly"),
  sections: z.tuple([
    SectionSchema.extend({ title: z.literal(WEEKLY_SECTION_TITLES[0]) }),
    SectionSchema.extend({ title: z.literal(WEEKLY_SECTION_TITLES[1]) }),
    SectionSchema.extend({ title: z.literal(WEEKLY_SECTION_TITLES[2]) }),
    SectionSchema.extend({ title: z.literal(WEEKLY_SECTION_TITLES[3]) }),
  ]),
});

export type ReportMetadata = z.infer<typeof ReportMetadataSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ReportSection = z.infer<typeof SectionSchema>;
export type DailyReportPayload = z.infer<typeof DailyReportSchema>;
export type WeeklyReportPayload = z.infer<typeof WeeklyReportSchema>;
