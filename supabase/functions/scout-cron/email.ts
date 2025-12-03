// Email notification helper for successful scouts

import type { ScoutResponse, Scout } from "./types.ts";

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email notification when a scout finds results
 * Uses the user's authenticated account email from auth.users
 */
export async function sendScoutSuccessEmail(
  scout: Scout,
  scoutResponse: ScoutResponse,
  supabase: any
): Promise<void> {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Open Scouts <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email notification");
      return;
    }

    // Fetch user's email from auth.users table using the scout's user_id
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(scout.user_id);

    if (userError) {
      console.error("Error fetching user:", userError);
      return;
    }

    // Check if user has an email
    if (!userData?.user?.email) {
      console.log("User has no email address, skipping email notification");
      return;
    }

    const userEmail = userData.user.email;
    console.log(`Sending scout success email to: ${userEmail}`);

    // Format the email
    const emailHtml = formatScoutEmail(scout, scoutResponse);

    const emailPayload: EmailPayload = {
      from: RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `Scout Alert: ${scout.title}`,
      html: emailHtml,
    };

    // Send email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send email: ${response.status} - ${errorText}`);

      // Parse error for logging
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          console.error(`Resend error: ${errorJson.message}`);
        }
      } catch {
        // Error text is not JSON, already logged above
      }
      return;
    }

    const result = await response.json();
    console.log(`Email sent successfully! ID: ${result.id}`);
  } catch (error: any) {
    // Don't throw - we don't want email failures to break scout execution
    console.error("Error sending email notification:", error.message);
  }
}

/**
 * Formats the scout results into a nice HTML email
 */
function formatScoutEmail(scout: Scout, scoutResponse: ScoutResponse): string {
  // Convert markdown response to simple HTML (basic conversion)
  let htmlContent = scoutResponse.response
    .replace(/## (.*?)(\n|$)/g, '<h2 style="color: #262626; font-size: 20px; margin: 20px 0 10px 0;">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #FF4C00; text-decoration: none;">$1</a>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #FF4C00; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                🔍 Scout Alert
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #262626; font-size: 16px; line-height: 1.5;">
                Your scout <strong>${scout.title}</strong> found something interesting!
              </p>

              <div style="background-color: #f9f9f9; border-left: 4px solid #FF4C00; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Scout Details
                </p>
                <p style="margin: 0 0 8px 0; color: #262626; font-size: 14px;">
                  <strong>Goal:</strong> ${scout.goal}
                </p>
                ${scout.location?.city ? `
                <p style="margin: 0; color: #262626; font-size: 14px;">
                  <strong>Location:</strong> ${scout.location.city}
                </p>
                ` : ''}
              </div>

              <div style="margin: 30px 0; color: #262626; font-size: 15px; line-height: 1.6;">
                ${htmlContent}
              </div>

              <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e5e5;">
                <a href="https://openscout.dev" style="display: inline-block; background-color: #FF4C00; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  View in Open Scouts
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px 0; color: #999; font-size: 13px;">
                You're receiving this because you have active scouts in Open Scouts.
              </p>
              <p style="margin: 0; color: #999; font-size: 13px;">
                <a href="https://openscout.dev" style="color: #FF4C00; text-decoration: none;">View your scouts</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
