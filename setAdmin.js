const admin = require("firebase-admin");
const serviceAccount = require("./src/lib/serviceAccountKey.json");

/**
 * 🛠️ Permanent Admin/Premium Escalation Script
 * 
 * INSTRUCTIONS:
 * 1. Run in terminal: node setAdmin.js
 * 2. Log out and back in to the app to refresh your token.
 */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// TARGET UIDs FOR ESCALATION
const targetUids = [
  "E9WTQfSqRNf64HzOlCoYXuAsBuH2",
  "CKG5dqFs9pcFEdJjF9DVqvhiTHj1"
];

async function escalateUsers() {
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

  console.log("\n👉 Escalation complete. Please logout and log back in to see changes.");
  process.exit(0);
}

escalateUsers();