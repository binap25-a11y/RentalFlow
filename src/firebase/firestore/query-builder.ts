import {
  collectionGroup,
  query,
  where,
  QueryConstraint,
  Firestore
} from "firebase/firestore";

/**
 * 🔐 Centralized query builder to enforce Firestore rules compliance
 */
export function buildSecureCollectionGroupQuery(options: {
  db: Firestore;
  collectionName: string;
  userId: string;
  role: 'landlord' | 'tenant';
  additionalConstraints?: QueryConstraint[];
}) {
  const { db, collectionName, userId, role, additionalConstraints = [] } = options;

  if (!userId) {
    throw new Error("User must be authenticated to build a secure query");
  }

  const constraints: QueryConstraint[] = [];

  // 🔑 ROLE-BASED FILTERING (Enforces query-rules alignment)
  // For Collection Group queries, Firestore requires the filter to exactly match the security rule.
  if (role === "landlord") {
    // Landlords always filter by their own ID across all nested property sub-collections
    constraints.push(where("landlordId", "==", userId));
  } else if (role === "tenant") {
    // For residents, different entities use different ID fields based on backend.json
    let filterField = 'userId';
    if (collectionName === 'maintenanceRequests') {
      filterField = 'tenantId';
    } else if (collectionName === 'tenantProfiles') {
      filterField = 'userId';
    } else if (collectionName === 'documents') {
      filterField = 'userId';
    } else if (collectionName === 'emergencyContactSheets') {
      filterField = 'landlordId'; 
    }
    
    constraints.push(where(filterField, "==", userId));
  }

  // Step 1: Force constraint check (CRITICAL)
  // Collection Group queries without constraints will be rejected by security rules.
  if (constraints.length === 0) {
    throw new Error(`Firestore query for ${collectionName} must include security constraints to pass security rules.`);
  }

  return query(
    collectionGroup(db, collectionName),
    ...constraints,
    ...additionalConstraints
  );
}