
import {
  collection,
  query,
  where,
  Firestore,
  Query,
  DocumentData,
  QueryConstraint
} from "firebase/firestore";

/**
 * 🏠 Portfolio Queries (FLAT)
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
 * 🔐 Resident Hub Queries (FLAT)
 * Filters a top-level collection for items relevant to the resident.
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

  // Other entities use specific field checks
  const field = collectionName === 'tenantProfiles' ? 'userId' : 'tenantId';
  
  return query(
    collection(db, collectionName),
    where(field, "==", userId),
    ...additionalConstraints
  );
}
