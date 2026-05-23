import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * @fileOverview Resilient Stripe Checkout Session Engine.
 * Handles missing environment variables gracefully to prevent build-time failures.
 */

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      console.error("Stripe configuration missing: STRIPE_SECRET_KEY or STRIPE_PRICE_ID is not defined.");
      return NextResponse.json({ 
        error: "Payments are currently being configured for this environment. Please try again later." 
      }, { status: 503 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.get('origin') || 'http://localhost:9002';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
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
