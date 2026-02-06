import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe secret not configured" },
      { status: 500 },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Convex not configured" },
      { status: 500 },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  const customer = await convex.query(api.customers.getByUserId, { userId });
  const stripeCustomerId = customer?.stripeCustomerId;

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "Stripe customer not found" },
      { status: 400 },
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: new URL("/dashboard/settings", request.url).toString(),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe portal session missing URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe portal session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
