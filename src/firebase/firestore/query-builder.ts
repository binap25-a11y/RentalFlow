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
 * 🏠 Membership-Based Portfolio Queries
 * Filters collections by the memberIds array. This is the primary way to fetch 
 * data shared between landlords and tenants securely.
 */
export function getMemberCollectionQuery(db: Firestore, collectionName: string, userId: string): Query<DocumentData> {
  if (!userId) throw new Error("User ID required for membership query");
  return query(
    collection(db, collectionName),
    where("memberIds", "array-contains", userId)
  );
}

/**
 * 🏠 Landlord Portfolio Queries
 * Filters top-level collections by landlordId.
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
 * Uses membership as the primary filter for consistency with security rules.
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

  // TenantProfiles are specifically linked by userId for residents
  if (collectionName === 'tenantProfiles') {
    return query(
      collection(db, collectionName),
      where("userId", "==", userId),
      ...additionalConstraints
    );
  }

  // Use membership for maintenance and documents to ensure they match security rules
  return query(
    collection(db, collectionName),
    where("memberIds", "array-contains", userId),
    ...additionalConstraints
  );
}