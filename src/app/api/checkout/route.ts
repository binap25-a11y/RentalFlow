import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * @fileOverview Resilient Stripe Checkout Session Engine (Legacy Route).
 * Synchronized with modern sanitization logic.
 */

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "Stripe configuration is missing in the environment." }, { status: 500 });
    }

    const rawPriceId = process.env.STRIPE_PRICE_ID;
    const priceId = rawPriceId.includes('/') ? rawPriceId.split('/').pop() || '' : rawPriceId;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.get('origin') || 'http://localhost:9002';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: priceId.trim(),
          quantity: 1,
        },
      ],
      success_url: `${origin}/landlord/dashboard?payment=success`,
      cancel_url: `${origin}/landlord/dashboard?payment=cancelled`,
      metadata: {
        userId: userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Session Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
