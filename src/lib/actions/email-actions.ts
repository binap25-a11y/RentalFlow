'use server';

import { sendPropertyEmail } from '@/lib/email';

/**
 * @fileOverview Server Actions for professional email communications.
 * Provides a secure entry point for client components to trigger notifications.
 */

export async function notifyLandlordOfRequest(data: {
  landlordEmail: string;
  propertyAddress: string;
  title: string;
  description: string;
}) {
  return sendPropertyEmail({
    to: data.landlordEmail,
    subject: `New Maintenance: ${data.propertyAddress}`,
    text: `A new maintenance request has been logged for ${data.propertyAddress}.\n\nSubject: ${data.title}\nDescription: ${data.description}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #1e3a8a;">Maintenance Alert</h2>
        <p>A new request has been submitted for <strong>${data.propertyAddress}</strong>.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Subject:</strong> ${data.title}</p>
          <p><strong>Context:</strong> ${data.description}</p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}/landlord/maintenance" style="background: #1e3a8a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Maintenance Hub</a>
      </div>
    `
  });
}

export async function notifyTenantOfUpdate(data: {
  tenantEmail: string;
  propertyAddress: string;
  status: string;
  title: string;
}) {
  return sendPropertyEmail({
    to: data.tenantEmail,
    subject: `Update on Repair: ${data.title}`,
    text: `The status of your repair request for ${data.propertyAddress} has been updated to: ${data.status}.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #1e3a8a;">Repair Progress Update</h2>
        <p>Your request for <strong>${data.title}</strong> at <strong>${data.propertyAddress}</strong> has a new status.</p>
        <div style="margin: 20px 0;">
          <span style="background: #dcfce7; color: #166534; padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase;">
            Status: ${data.status}
          </span>
        </div>
        <p style="color: #64748b; font-size: 14px;">Log in to the Resident Portal for full details.</p>
      </div>
    `
  });
}
