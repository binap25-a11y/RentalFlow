
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
  // Portfolio-wide listing for landlords must filter by landlordId to match rules
  if (role === "landlord") {
    constraints.push(where("landlordId", "==", userId));
  }

  // ✅ TENANT / MEMBER ACCESS
  // Residents check direct association OR membership via memberIds
  if (role === "tenant") {
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
