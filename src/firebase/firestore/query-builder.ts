import {
  collection,
  collectionGroup,
  query,
  where,
  or,
  QueryConstraint,
  Firestore,
  Query
} from "firebase/firestore";

type UserRole = "landlord" | "tenant";

/**
 * 🏠 Direct subcollection query for properties (Landlord only)
 * This is faster and avoids collectionGroup permission issues.
 */
export function getLandlordPropertiesQuery(db: Firestore, userId: string): Query {
  return query(
    collection(db, "users", userId, "properties")
  );
}

/**
 * 🔐 Centralized query builder to enforce Firestore rules compliance for portfolio-wide listings
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

  // ✅ LANDLORD ACCESS
  if (role === "landlord") {
    constraints.push(where("landlordId", "==", userId));
  }

  // ✅ TENANT / MEMBER ACCESS
  if (role === "tenant") {
    // For tenants, we check direct association (tenantId/userId) OR membership in the property via array
    constraints.push(
      or(
        where("tenantId", "==", userId),
        where("userId", "==", userId),
        where("memberIds", "array-contains", userId)
      )
    );
  }

  return query(
    collectionGroup(db, collectionName),
    ...constraints,
    ...additionalConstraints
  );
}
