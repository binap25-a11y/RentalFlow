
import { Resend } from 'resend';

/**
 * 📧 Premium Email Engine
 * Refactored for lazy initialization to prevent "Missing API Key" errors during server boot.
 */
let resendInstance: Resend | null = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('RESEND_API_KEY is missing. Email dispatch will be bypassed.');
    return null;
  }
  
  if (!resendInstance) {
    resendInstance = new Resend(key);
  }
  return resendInstance;
}

export async function sendPropertyEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const resend = getResend();
  
  if (!resend) {
    return { success: false, error: 'Configuration missing' };
  }

  try {
    const { data, error } = await resend.emails.send({
      // Use onboarding@resend.dev for trial accounts or unverified domains
      from: 'RentalFlow <onboarding@resend.dev>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || `<p>${options.text}</p>`,
    });

    if (error) {
      console.warn('Resend API returned a validation error:', error);
      // Handle the common "Unverified Domain" 403 error gracefully
      if ((error as any).statusCode === 403 || error.name === 'validation_error') {
        return { 
          success: false, 
          error: 'Resend Trial Restriction: You can only send to your own email address until you verify a domain.',
          details: error 
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Email Dispatch Critical Failure:', error);
    return { success: false, error: error.message || 'Unknown network error' };
  }
}
