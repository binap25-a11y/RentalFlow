
import { Property, User, MaintenanceRequest, Inspection } from './types';

export const MOCK_PROPERTIES: Property[] = [
  {
    id: 'prop-1',
    address: '123 Azure Heights, Skyview Tower',
    description: 'Luxury 2-bedroom apartment with panoramic city views.',
    imageUrl: 'https://picsum.photos/seed/prop1/800/600',
    documents: [
      { id: 'doc-1', name: 'Tenancy Agreement.pdf', url: '#', type: 'contract', uploadedAt: '2024-01-15' },
      { id: 'doc-2', name: 'Building Rules.pdf', url: '#', type: 'guide', uploadedAt: '2024-01-15' }
    ],
    emergencyContacts: [
      { id: 'ec-1', name: 'Emergency Plumber', role: 'Plumbing', phone: '0800-123-456' },
      { id: 'ec-2', name: 'Skyview Management', role: 'Concierge', phone: '020-7777-8888' }
    ]
  },
  {
    id: 'prop-2',
    address: '45 Bluebell Mews, Meadow Village',
    description: 'Charming 3-bedroom detached house with a private garden.',
    imageUrl: 'https://picsum.photos/seed/prop2/800/600',
    documents: [],
    emergencyContacts: [
      { id: 'ec-3', name: 'Meadow Gas Services', role: 'Heating', phone: '0123-444-555' }
    ]
  }
];

export const MOCK_USERS: User[] = [
  { id: 'l-1', name: 'Sarah Landlord', email: 'landlord@leaseloop.com', role: 'landlord', avatar: 'https://picsum.photos/seed/landlord/200/200' },
  { id: 't-1', name: 'Alex Resident', email: 'tenant@leaseloop.com', role: 'tenant', avatar: 'https://picsum.photos/seed/tenant/200/200' }
];

export const MOCK_MAINTENANCE: MaintenanceRequest[] = [
  {
    id: 'mr-1',
    propertyId: 'prop-1',
    tenantId: 't-1',
    description: 'The kitchen sink is leaking heavily from the pipe underneath.',
    priority: 'urgent',
    category: 'plumbing',
    status: 'in-progress',
    createdAt: '2024-03-20T10:00:00Z',
    reasoning: 'Active leak in kitchen area requires prompt attention to prevent water damage.'
  }
];

export const MOCK_INSPECTIONS: Inspection[] = [
  {
    id: 'insp-1',
    propertyId: 'prop-1',
    scheduledDate: '2024-04-15',
    status: 'scheduled'
  }
];
