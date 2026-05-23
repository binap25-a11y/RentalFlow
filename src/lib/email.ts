import { Resend } from 'resend';

/**
 * 📧 Premium Email Engine
 * Refactored for lazy initialization to prevent "Missing API Key" errors during server boot.
 * Optimized for trial account handling and domain verification detection.
 */
let resendInstance: Resend | null = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('SYSTEM ALERT: RESEND_API_KEY is missing from environment. Email dispatch bypassed.');
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
    return { 
      success: false, 
      error: 'Engine Offline: No API key configured. Please update your environment variables.' 
    };
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
      console.warn('RESEND VALIDATION ERROR:', error);
      
      // Handle the common "Unverified Domain" 403 error specifically
      const isTrialRestriction = (error as any).statusCode === 403 || 
                                 error.name === 'validation_error' || 
                                 error.message?.includes('testing email');
                                 
      if (isTrialRestriction) {
        return { 
          success: false, 
          error: 'Resend Trial Restriction: You can only send to your own registered email address until a domain is verified at resend.com.',
          details: error 
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('EMAIL DISPATCH CRITICAL FAILURE:', error);
    return { success: false, error: error.message || 'Unknown network error' };
  }
}
