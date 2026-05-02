import {
  collectionGroup,
  query,
  where,
  QueryConstraint,
  Firestore
} from "firebase/firestore";

/**
 * 🔐 Centralised query builder to enforce Firestore rules compliance
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
  if (role === "landlord") {
    constraints.push(where("landlordId", "==", userId));
  } else if (role === "tenant") {
    // Note: Some models use tenantId, others userId for tenant identification
    // We default to tenantId for maintenance requests and userId for profiles/docs as per backend.json
    const filterField = (collectionName === 'maintenanceRequests' || collectionName === 'tenantProfiles') ? 'tenantId' : 'userId';
    constraints.push(where(filterField, "==", userId));
  }

  return query(
    collectionGroup(db, collectionName),
    ...constraints,
    ...additionalConstraints
  );
}
