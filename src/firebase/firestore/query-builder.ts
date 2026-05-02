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
    // Residents/Members access via tenantId/userId OR memberIds array
    if (collectionName === 'maintenanceRequests') {
      constraints.push(where("tenantId", "==", userId));
    } else if (collectionName === 'tenantProfiles') {
      constraints.push(where("userId", "==", userId));
    } else if (collectionName === 'documents') {
      constraints.push(
        or(
          where("userId", "==", userId),
          where("memberIds", "array-contains", userId)
        )
      );
    } else {
      // For properties, inspections, etc.
      constraints.push(where("memberIds", "array-contains", userId));
    }
  }

  // Final safety check: throw if no constraints are generated to prevent broad query denials
  if (constraints.length === 0) {
    throw new Error(`❌ Firestore query for ${collectionName} missing security filters. This will be rejected by rules.`);
  }

  return query(
    collectionGroup(db, collectionName),
    ...constraints,
    ...additionalConstraints
  );
}