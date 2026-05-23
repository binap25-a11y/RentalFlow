
import { sendPropertyEmail } from "@/lib/email";

/**
 * @fileOverview Email connectivity diagnostic endpoint.
 * Validates the Resend configuration and API key status.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const to = body.to || "test@example.com";

    if (!process.env.RESEND_API_KEY) {
      return Response.json({ 
        success: false, 
        error: "RESEND_API_KEY is not configured in .env" 
      }, { status: 500 });
    }

    const result = await sendPropertyEmail({
      to: to,
      subject: "RentalFlow: System Connectivity Test",
      text: "The communication engine is active.",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #1e3a8a; margin: 0;">RentalFlow</h1>
            <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Communication Engine Check</p>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; text-align: center;">
            <h2 style="color: #166534; margin-top: 0;">Connection Verified</h2>
            <p style="color: #166534; font-size: 14px;">The <strong>Resend</strong> integration is active and responding.</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">Generated: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    if (!result.success) {
      return Response.json({ 
        success: false, 
        error: result.error,
        isTrialRestriction: !!result.error?.includes('Trial Restriction') 
      }, { status: result.error?.includes('Trial Restriction') ? 403 : 500 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Diagnostic Email Failed:', error);
    return Response.json({ success: false, error: error.message || error }, { status: 500 });
  }
}
