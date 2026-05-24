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

// YOUR SPECIFIC UID
const uid = "E9WTQfSqRNf64HzOlCoYXuAsBuH2";

admin.auth().setCustomUserClaims(uid, {
  admin: true,
  premium: true,
})
.then(() => {
  console.log("✅ Admin & Premium roles successfully applied to token.");
  console.log("👉 Now logout and log back into the app to see changes.");
  process.exit(0);
})
.catch((err) => {
  console.error("❌ Escalation Failed:", err);
  process.exit(1);
});
