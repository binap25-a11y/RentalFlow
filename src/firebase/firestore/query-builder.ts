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
    // Landlords always access via landlordId
    constraints.push(where("landlordId", "==", userId));
  } else if (role === "tenant") {
    // Residents access via tenantId/userId OR memberIds array
    if (collectionName === 'maintenanceRequests') {
      constraints.push(where("tenantId", "==", userId));
    } else if (collectionName === 'documents' || collectionName === 'tenantProfiles') {
      constraints.push(
        or(
          where("userId", "==", userId),
          where("memberIds", "array-contains", userId)
        )
      );
    } else {
      // Default fallback for properties, inspections etc.
      constraints.push(
        or(
          where("tenantId", "==", userId),
          where("memberIds", "array-contains", userId)
        )
      );
    }
  }

  // Final check to prevent broad unauthorized queries
  if (constraints.length === 0) {
    throw new Error(`Firestore query for ${collectionName} must include security constraints.`);
  }

  return query(
    collectionGroup(db, collectionName),
    ...constraints,
    ...additionalConstraints
  );
}