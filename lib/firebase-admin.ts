import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function app() {
  return (
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId:
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        "gen-lang-client-0444960702",
    })
  );
}
export function firestore() {
  const db = getFirestore(app(), process.env.FIRESTORE_DATABASE_ID || "side-b");
  // Only undefined optional fields are omitted; user data remains server-side.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* already initialized */
  }
  return db;
}
export function auth() {
  return getAuth(app());
}
