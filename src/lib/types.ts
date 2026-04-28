
export type UserRole = 'landlord' | 'tenant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Property {
  id: string;
  address: string;
  description: string;
  imageUrl: string;
  documents: PropertyDocument[];
  emergencyContacts: EmergencyContact[];
}

export interface PropertyDocument {
  id: string;
  name: string;
  url: string;
  type: 'contract' | 'guide' | 'other';
  uploadedAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  tenantId: string;
  description: string;
  priority: 'low' | 'routine' | 'urgent' | 'critical';
  category: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
  reasoning?: string;
}

export interface Inspection {
  id: string;
  propertyId: string;
  scheduledDate: string;
  status: 'scheduled' | 'completed';
  findings?: string;
  reportUrl?: string;
}
