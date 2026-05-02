
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
 * 🏠 Direct Landlord Queries (Bypasses CollectionGroup Index requirement)
 */
export function getLandlordCollectionQuery(db: Firestore, userId: string, collectionName: string): Query {
  return query(collection(db, "users", userId, collectionName));
}

/**
 * 🔐 Secure Portfolio Queries (For Residents and shared access)
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
    throw new Error("User must be authenticated");
  }

  const constraints: QueryConstraint[] = [];

  // ✅ LANDLORD ACCESS (Uses direct path helper in practice, but supported here)
  if (role === "landlord") {
    constraints.push(where("landlordId", "==", userId));
  }

  // ✅ TENANT / MEMBER ACCESS
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
