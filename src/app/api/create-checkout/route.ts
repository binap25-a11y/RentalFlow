import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * @fileOverview Resilient Stripe Checkout Session Engine.
 * Handles configuration errors (like Price vs Product IDs) and full API paths gracefully.
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

    // Sanitization: Extract the ID if the user provided the full API path (/v1/prices/price_...)
    let priceId = rawPriceId.includes('/') ? rawPriceId.split('/').pop() || '' : rawPriceId;

    // Validation: Product IDs (prod_...) cannot be used as prices in checkout line items.
    if (priceId.startsWith('prod_')) {
      return NextResponse.json({ 
        error: "Configuration Mismatch: STRIPE_PRICE_ID is set to a Product ID. Please use a Price ID (starting with 'price_') from your Stripe Dashboard." 
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
