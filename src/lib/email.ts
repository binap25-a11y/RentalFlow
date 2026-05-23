import { Resend } from 'resend';

/**
 * 📧 Premium Email Engine
 * Centralized configuration for Resend to handle portfolio-wide notifications.
 */
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPropertyEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is missing. Email dispatch skipped.');
    return { success: false, error: 'Configuration missing' };
  }

  try {
    const data = await resend.emails.send({
      from: 'RentalFlow <notifications@resend.dev>', // Replace with verified domain in production
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || `<p>${options.text}</p>`,
    });

    return { success: true, data };
  } catch (error: any) {
    console.error('Email Dispatch Error:', error);
    return { success: false, error: error.message };
  }
}

export default resend;
