
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

/**
 * @fileOverview Stripe Webhook Fulfillment Hub.
 * Authenticates incoming Stripe events and updates user subscription status in Firestore.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      // Secure fulfillment with signature verification
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      // Fallback for development if secret is not set (not recommended for production)
      event = JSON.parse(payload);
    }
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  // Handle Checkout Completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (userId) {
      try {
        // Upgrade user plan in the relational ledger (Firestore)
        await adminDb.collection("users").doc(userId).update({
          plan: "pro",
          subscriptionId: session.subscription,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`✅ User ${userId} successfully upgraded to PRO plan.`);
      } catch (error) {
        console.error(`❌ Firestore Upgrade Failed for User ${userId}:`, error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
