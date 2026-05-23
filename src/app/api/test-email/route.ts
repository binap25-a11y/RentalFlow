import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * @fileOverview Email connectivity diagnostic endpoint.
 * Validates the Resend configuration and API key status.
 */
export async function POST(req: Request) {
  try {
    const { to = "test@example.com" } = await req.json().catch(() => ({}));

    if (!process.env.RESEND_API_KEY) {
      return Response.json({ 
        success: false, 
        error: "RESEND_API_KEY is not configured in .env" 
      }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: to,
      subject: "RentalFlow: System Connectivity Test",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e3a8a;">RentalFlow Engine Check</h2>
          <p>This is a successful test of the <strong>Resend</strong> email integration.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Generated: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    if (error) throw error;

    return Response.json({ success: true, data });
  } catch (error: any) {
    console.error('Diagnostic Email Failed:', error);
    return Response.json({ success: false, error: error.message || error }, { status: 500 });
  }
}
