import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * @fileOverview Resilient Stripe Checkout Session Engine.
 * Robust sanitization: Handles configuration strings, full API paths, and Product ID errors.
 */

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    let rawPriceId = process.env.STRIPE_PRICE_ID;

    if (!process.env.STRIPE_SECRET_KEY || !rawPriceId) {
      console.error("Stripe configuration missing: STRIPE_SECRET_KEY or STRIPE_PRICE_ID is not defined.");
      return NextResponse.json({ 
        error: "System Configuration Error: Payments are not fully initialized in this environment." 
      }, { status: 503 });
    }

    // SANITIZATION: Robust extraction of price_ ID from full paths or dirty strings
    // Format handled: /v1/prices/price_... OR price_... OR whitespace strings
    let priceId = String(rawPriceId || "").trim();
    if (priceId.includes('/')) {
      priceId = priceId.split('/').pop() || priceId;
    }
    priceId = (priceId || "").trim();

    // VALIDATION: Product IDs (prod_...) cannot be used as prices.
    if (priceId.startsWith('prod_')) {
      return NextResponse.json({ 
        error: `Configuration Mismatch: You are using a Product ID (${priceId}). Please use a Price ID (starting with 'price_') from your Stripe Dashboard.` 
      }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.get('origin') || 'http://localhost:9002';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: priceId,
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
    return NextResponse.json({ 
      error: error.message || "An unexpected error occurred during checkout initialization." 
    }, { status: 500 });
  }
}
