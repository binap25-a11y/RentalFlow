const admin = require("firebase-admin");

/**
 * 🛠️ Permanent Admin/Premium Escalation Script
 * 
 * SECURITY NOTICE: Actual private keys have been redacted to allow GitHub pushes.
 * To use this script locally:
 * 1. Obtain a valid serviceAccountKey.json from Firebase Console.
 * 2. Place it in src/lib/
 * 3. Run: node setAdmin.js
 */

async function initialize() {
  try {
    const serviceAccount = require("./src/lib/serviceAccountKey.json");
    
    if (serviceAccount.private_key.includes('REDACTED')) {
      console.error("❌ Escalation Aborted: src/lib/serviceAccountKey.json contains a redacted placeholder.");
      console.log("👉 Please replace it with a valid key from your Firebase Console to run escalation.");
      process.exit(1);
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    return true;
  } catch (err) {
    console.error("❌ Failed to load credentials:", err.message);
    return false;
  }
}

// TARGET UIDs FOR ESCALATION
const targetUids = [
  "E9WTQfSqRNf64HzOlCoYXuAsBuH2",
  "CKG5dqFs9pcFEdJjF9DVqvhiTHj1"
];

async function escalateUsers() {
  const ready = await initialize();
  if (!ready) return;

  console.log("🚀 Starting security escalation for target portfolio managers...");
  
  for (const uid of targetUids) {
    try {
      await admin.auth().setCustomUserClaims(uid, {
        admin: true,
        premium: true,
      });
      console.log(`✅ Claims applied successfully for UID: ${uid}`);
    } catch (err) {
      console.error(`❌ Failed to escalate UID: ${uid}`, err.message);
    }
  }

  console.log("\n👉 Escalation complete. Please logout and log back in to your app to see changes.");
  process.exit(0);
}

escalateUsers();
