import { NextResponse } from "next/server";
import { z } from "zod";

import { runGitPulseAgent } from "@gitpulse/agent-core";
import { ScopeSchema, TimeWindowSchema } from "@gitpulse/schemas";

const RequestSchema = z.object({
  question: z.string().min(3),
  window: TimeWindowSchema,
  scope: ScopeSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = RequestSchema.parse(body);

    const answer = await runGitPulseAgent({
      question: payload.question,
      window: payload.window,
      scope: payload.scope,
      githubToken: process.env.GITHUB_TOKEN,
    });

    return NextResponse.json(answer);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join(", ")
        : error instanceof Error
          ? error.message
          : "Unknown error";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
