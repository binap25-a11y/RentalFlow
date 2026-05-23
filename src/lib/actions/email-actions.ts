'use server';

import { sendPropertyEmail } from '@/lib/email';

/**
 * @fileOverview Server Actions for professional email communications.
 * Provides a secure entry point for client components to trigger notifications.
 * These actions are designed to fail silently (gracefully) so UI workflows aren't blocked by unverified domains.
 */

const BRAND_PRIMARY = '#1e3a8a';
const BRAND_ACCENT = '#3b82f6';
const BRAND_BG = '#f8fafc';

/**
 * 📧 Maintenance: Notify Landlord of new request
 */
export async function notifyLandlordOfRequest(data: {
  landlordEmail: string;
  propertyAddress: string;
  title: string;
  description: string;
}) {
  return await sendPropertyEmail({
    to: data.landlordEmail,
    subject: `Maintenance Alert: ${data.propertyAddress}`,
    text: `A new maintenance request has been logged for ${data.propertyAddress}.`,
    html: `
      <div style="font-family: sans-serif; padding: 30px; background-color: ${BRAND_BG}; border-radius: 24px; color: #1e293b;">
        <h2 style="color: ${BRAND_PRIMARY}; margin-top: 0;">Maintenance Alert</h2>
        <p>A new request has been submitted for <strong>${data.propertyAddress}</strong>.</p>
        <div style="background: white; padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-weight: bold; color: ${BRAND_PRIMARY};">${data.title}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 1.6;">${data.description}</p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}/landlord/maintenance" style="display: inline-block; background: ${BRAND_PRIMARY}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 10px;">Review Request</a>
      </div>
    `
  });
}

/**
 * 📧 Maintenance: Notify Tenant of status update
 */
export async function notifyTenantOfUpdate(data: {
  tenantEmail: string;
  propertyAddress: string;
  status: string;
  title: string;
}) {
  return await sendPropertyEmail({
    to: data.tenantEmail,
    subject: `Update on Repair: ${data.title}`,
    text: `The status of your repair request for ${data.propertyAddress} has been updated to: ${data.status}.`,
    html: `
      <div style="font-family: sans-serif; padding: 30px; background-color: ${BRAND_BG}; border-radius: 24px; color: #1e293b;">
        <h2 style="color: ${BRAND_PRIMARY}; margin-top: 0;">Repair Progress Update</h2>
        <p>The status of your request at <strong>${data.propertyAddress}</strong> has changed.</p>
        <div style="margin: 25px 0;">
          <span style="background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 30px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            ${data.status}
          </span>
        </div>
        <p style="font-size: 14px; color: #64748b;">Log in to the Resident Portal for more details or to message management.</p>
      </div>
    `
  });
}

/**
 * 📧 Onboarding: Welcome Tenant to Property
 */
export async function sendTenantWelcomeEmail(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
}) {
  return await sendPropertyEmail({
    to: data.tenantEmail,
    subject: `Welcome to Your New Home: ${data.propertyAddress}`,
    text: `Welcome to your new home at ${data.propertyAddress}. You can now access the RentalFlow Resident Portal.`,
    html: `
      <div style="font-family: sans-serif; padding: 40px; background-color: ${BRAND_BG}; border-radius: 32px; color: #1e293b; max-width: 600px; margin: auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: ${BRAND_PRIMARY}; margin: 0; font-size: 28px;">Welcome Home</h1>
          <p style="color: ${BRAND_ACCENT}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; margin-top: 5px;">Resident Onboarding</p>
        </div>
        <p>Hello ${data.tenantName},</p>
        <p>Your residency at <strong>${data.propertyAddress}</strong> has been registered on the RentalFlow platform.</p>
        <div style="background: white; padding: 25px; border-radius: 20px; margin: 30px 0; border: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">You can now report repairs, download your lease, and message management directly.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}" style="display: inline-block; background: ${BRAND_PRIMARY}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 14px; font-weight: bold; margin-top: 20px; box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.2);">Access Resident Hub</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated communication from your property management team via RentalFlow.</p>
      </div>
    `
  });
}

/**
 * 📧 Finance: Rent Reminder
 */
export async function sendRentReminderEmail(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  month: string;
}) {
  return await sendPropertyEmail({
    to: data.tenantEmail,
    subject: `Rent Reminder: ${data.month} Collection`,
    text: `A friendly reminder that rent for ${data.propertyAddress} is currently pending for ${data.month}.`,
    html: `
      <div style="font-family: sans-serif; padding: 40px; background-color: ${BRAND_BG}; border-radius: 32px; color: #1e293b; max-width: 600px; margin: auto;">
        <h2 style="color: ${BRAND_PRIMARY}; margin-top: 0;">Payment Reminder</h2>
        <p>Hello ${data.tenantName},</p>
        <p>This is a friendly notification regarding the rent collection for <strong>${data.month}</strong> at <strong>${data.propertyAddress}</strong>.</p>
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 25px; border-radius: 20px; margin: 30px 0; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #92400e; font-weight: bold; text-transform: uppercase;">Amount Pending</p>
          <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold; color: #92400e;">£${data.amount.toLocaleString()}</p>
        </div>
        <p style="font-size: 14px;">If you have already made this payment, please disregard this message as the management ledger may still be updating.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}/tenant/hub" style="display: inline-block; background: ${BRAND_PRIMARY}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 14px; font-weight: bold;">View Tenancy Status</a>
        </div>
      </div>
    `
  });
}

/**
 * 📧 Finance: Rent Receipt
 */
export async function sendRentReceiptEmail(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  month: string;
  paymentDate: string;
}) {
  return await sendPropertyEmail({
    to: data.tenantEmail,
    subject: `Payment Confirmed: ${data.month} Rent Receipt`,
    text: `Your rent payment of £${data.amount} for ${data.month} has been verified and collected.`,
    html: `
      <div style="font-family: sans-serif; padding: 40px; background-color: ${BRAND_BG}; border-radius: 32px; color: #1e293b; max-width: 600px; margin: auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: #dcfce7; color: #166534; width: 60px; height: 60px; border-radius: 50%; line-height: 60px; margin: 0 auto 15px auto; font-size: 30px;">✓</div>
          <h2 style="color: ${BRAND_PRIMARY}; margin: 0;">Payment Verified</h2>
          <p style="color: #64748b; font-size: 14px;">Rent Receipt for ${data.month}</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; color: #64748b;">Property</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold;">${data.propertyAddress}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b;">Amount Paid</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #166534;">£${data.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b;">Verification Date</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold;">${data.paymentDate}</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 14px; text-align: center; color: #64748b;">Thank you for your timely payment. Your account status has been updated in the Resident Hub.</p>
      </div>
    `
  });
}
