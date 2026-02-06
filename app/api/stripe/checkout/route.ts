import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth, clerkClient } from "@clerk/nextjs/server";

type CheckoutBody = {
  priceId?: string;
};

function parseBody(rawBody: string): CheckoutBody | null {
  if (!rawBody.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as CheckoutBody;
  } catch {
    return null;
  }
}

function getPrimaryEmail(user: {
  primaryEmailAddressId?: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
}): string | null {
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();
  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.priceId !== undefined && typeof body.priceId !== "string") {
    return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
  }

  const priceId = body.priceId?.trim() || process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured" },
      { status: 500 },
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe secret not configured" },
      { status: 500 },
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = getPrimaryEmail(user);
  if (!email) {
    return NextResponse.json(
      { error: "No email address on user" },
      { status: 400 },
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const successUrl = new URL("/dashboard?checkout=success", request.url);
  const cancelUrl = new URL("/pricing?checkout=canceled", request.url);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      subscription_data: { trial_period_days: 14 },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      customer_email: email,
      metadata: { userId },
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe session missing URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
