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
  const disabledResponse = productionGuard();
  if (disabledResponse) {
    return disabledResponse;
  }

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
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join(", ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[api/agent] unhandled error", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

function productionGuard() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  if (process.env.GITPULSE_ALLOW_UNAUTHENTICATED_AGENT_ROUTE === "true") {
    return null;
  }

  return NextResponse.json(
    { error: "Agent route is disabled in production until auth is configured." },
    { status: 503 },
  );
}
