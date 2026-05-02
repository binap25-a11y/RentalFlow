import {
  collection,
  query,
  where,
  or,
  QueryConstraint,
  Firestore,
  Query
} from "firebase/firestore";

/**
 * 🏠 Landlord Portfolio Queries
 * Filters a top-level collection by landlordId.
 */
export function getLandlordCollectionQuery(db: Firestore, collectionName: string, userId: string): Query {
  return query(
    collection(db, collectionName),
    where("landlordId", "==", userId)
  );
}

/**
 * 🔐 Tenant / Resident Hub Queries
 * Filters a top-level collection for items relevant to the tenant.
 */
export function getTenantCollectionQuery(options: {
  db: Firestore;
  collectionName: string;
  userId: string;
  additionalConstraints?: QueryConstraint[];
}) {
  const { db, collectionName, userId, additionalConstraints = [] } = options;

  if (!userId) {
    throw new Error("User must be authenticated");
  }

  return query(
    collection(db, collectionName),
    or(
      where("tenantId", "==", userId),
      where("userId", "==", userId),
      where("memberIds", "array-contains", userId)
    ),
    ...additionalConstraints
  );
}
