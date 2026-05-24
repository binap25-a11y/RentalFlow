const admin = require("firebase-admin");
const serviceAccount = require("./src/lib/serviceAccountKey.json");

/**
 * 🛠️ Permanent Admin/Premium Escalation Script
 * Run: node setAdmin.js
 */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// REPLACE WITH YOUR UID
const uid = "REPLACE_WITH_YOUR_FIREBASE_UID";

admin.auth().setCustomUserClaims(uid, {
  admin: true,
  premium: true,
})
.then(() => {
  console.log("✅ Admin & Premium roles successfully applied to token.");
  process.exit(0);
})
.catch((err) => {
  console.error("❌ Escalation Failed:", err);
  process.exit(1);
});