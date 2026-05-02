import {
  collectionGroup,
  query,
  where,
  or,
  QueryConstraint,
  Firestore
} from "firebase/firestore";

type UserRole = "landlord" | "tenant";

/**
 * 🔐 Centralized query builder to enforce Firestore rules compliance
 */
export function buildSecureCollectionGroupQuery(options: {
  db: Firestore;
  collectionName: string;
  userId: string;
  role: UserRole;
  additionalConstraints?: QueryConstraint[];
}) {
  const { db, collectionName, userId, role, additionalConstraints = [] } = options;

  if (!userId) {
    throw new Error("User must be authenticated to build a secure query");
  }

  const constraints: QueryConstraint[] = [];

  // 🔑 ROLE-BASED FILTERING (Enforces query-rules alignment)
  if (role === "landlord") {
    constraints.push(where("landlordId", "==", userId));
  } else if (role === "tenant") {
    // Tenants can access documents where they are the primary user, 
    // OR where they are included in the memberIds array.
    if (collectionName === 'maintenanceRequests') {
      constraints.push(where("tenantId", "==", userId));
    } else if (collectionName === 'documents') {
      constraints.push(
        or(
          where("userId", "==", userId),
          where("memberIds", "array-contains", userId)
        )
      );
    } else {
      constraints.push(where("memberIds", "array-contains", userId));
    }
  }

  // Final check to prevent broad queries
  if (constraints.length === 0) {
    throw new Error(`Firestore query for ${collectionName} must include security constraints.`);
  }

  return query(
    collectionGroup(db, collectionName),
    ...constraints,
    ...additionalConstraints
  );
}