import {
  collection,
  query,
  where,
  or,
  QueryConstraint,
  Firestore,
  Query,
  DocumentData
} from "firebase/firestore";

/**
 * 🏠 Landlord Portfolio Queries (FLAT)
 * Filters a top-level collection by landlordId.
 */
export function getLandlordCollectionQuery(db: Firestore, collectionName: string, userId: string): Query<DocumentData> {
  if (!userId) throw new Error("User ID required");
  return query(
    collection(db, collectionName),
    where("landlordId", "==", userId)
  );
}

/**
 * 🔐 Tenant / Resident Hub Queries (FLAT)
 * Filters a top-level collection for items relevant to the tenant.
 */
export function getTenantCollectionQuery(options: {
  db: Firestore;
  collectionName: string;
  userId: string;
  additionalConstraints?: QueryConstraint[];
}): Query<DocumentData> {
  const { db, collectionName, userId, additionalConstraints = [] } = options;

  if (!userId) {
    throw new Error("User must be authenticated");
  }

  // Properties use tenantIds array-contains
  if (collectionName === 'properties') {
    return query(
      collection(db, collectionName),
      where("tenantIds", "array-contains", userId),
      ...additionalConstraints
    );
  }

  // Other entities use OR filters matching security rules
  // We check for direct tenantId, general userId, or memberIds membership.
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
