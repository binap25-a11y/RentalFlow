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
 * 🏠 Landlord Portfolio Queries
 * Filters top-level collections by landlordId.
 * No collectionGroup is used to ensure security rule performance and predictability.
 */
export function getLandlordCollectionQuery(db: Firestore, collectionName: string, userId: string): Query<DocumentData> {
  if (!userId) throw new Error("User ID required for landlord query");
  return query(
    collection(db, collectionName),
    where("landlordId", "==", userId)
  );
}

/**
 * 🔐 Resident Hub Queries
 * Filters top-level collections for items relevant to the resident.
 */
export function getTenantCollectionQuery(options: {
  db: Firestore;
  collectionName: string;
  userId: string;
  additionalConstraints?: QueryConstraint[];
}): Query<DocumentData> {
  const { db, collectionName, userId, additionalConstraints = [] } = options;

  if (!userId) {
    throw new Error("User must be authenticated for resident query");
  }

  // Properties use tenantIds array-contains for shared access
  if (collectionName === 'properties') {
    return query(
      collection(db, collectionName),
      where("tenantIds", "array-contains", userId),
      ...additionalConstraints
    );
  }

  // TenantProfiles are linked by userId
  if (collectionName === 'tenantProfiles') {
    return query(
      collection(db, collectionName),
      where("userId", "==", userId),
      ...additionalConstraints
    );
  }

  // Maintenance and Documents are linked by tenantId or memberIds
  return query(
    collection(db, collectionName),
    where("tenantId", "==", userId),
    ...additionalConstraints
  );
}