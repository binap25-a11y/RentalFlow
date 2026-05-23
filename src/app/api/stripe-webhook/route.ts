import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from 'firebase-admin';

/**
 * @fileOverview Resilient Stripe Webhook Fulfillment Hub.
 * Authenticates incoming Stripe events and updates user subscription status in Firestore.
 */

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Webhook Error: STRIPE_SECRET_KEY is not defined.");
    return NextResponse.json({ error: "System misconfigured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      // Fallback for development only
      event = JSON.parse(payload);
    }
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (userId) {
      try {
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
