const admin = require("firebase-admin");
const serviceAccount = require("./src/lib/serviceAccountKey.json");

/**
 * 🛠️ Permanent Admin/Premium Escalation Script
 * 
 * INSTRUCTIONS:
 * 1. Ensure your serviceAccountKey.json is correct in src/lib/
 * 2. Run in terminal: node setAdmin.js
 * 3. Log out and back in to the app to refresh your token.
 */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// TARGET UIDs FOR ESCALATION (Verified for your accounts)
const targetUids = [
  "E9WTQfSqRNf64HzOlCoYXuAsBuH2",
  "CKG5dqFs9pcFEdJjF9DVqvhiTHj1"
];

async function escalateUsers() {
  console.log("🚀 Starting security escalation for target portfolio managers...");
  
  for (const uid of targetUids) {
    try {
      // Apply Custom User Claims for immediate security-level access
      // This bypasses Firestore-only checks and is verified at the token level.
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