
import { Property, User, MaintenanceRequest, Inspection } from './types';

export const MOCK_PROPERTIES: Property[] = [];

export const MOCK_USERS: User[] = [
  { id: 'placeholder-landlord', name: 'Landlord User', email: 'landlord@example.com', role: 'landlord' },
  { id: 'placeholder-tenant', name: 'Tenant User', email: 'tenant@example.com', role: 'tenant' }
];

export const MOCK_MAINTENANCE: MaintenanceRequest[] = [];

export const MOCK_INSPECTIONS: Inspection[] = [];
