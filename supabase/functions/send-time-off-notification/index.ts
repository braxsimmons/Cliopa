import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  request_id: string;
  action: "approved" | "denied";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request_id, action }: NotificationRequest = await req.json();

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/time_off_requests?id=eq.${request_id}&select=*,profiles!inner(first_name,last_name,email)`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
      }
    );

    const requestData = await response.json();

    if (!requestData || requestData.length === 0) {
      throw new Error("Request not found");
    }

    const request = requestData[0];
    const profile = request.profiles;

    const employeeName =
      profile.first_name || profile.last_name
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        : profile.email;

    const startDate = new Date(request.start_date).toLocaleDateString();
    const endDate = new Date(request.end_date).toLocaleDateString();

    const subject =
      action === "approved"
        ? `Time Off Request Approved`
        : `Time Off Request Denied`;

    const htmlContent =
      action === "approved"
        ? `
        <h2>Your Time Off Request Has Been Approved</h2>
        <p>Hi ${employeeName},</p>
        <p>Great news! Your ${
          request.request_type
        } request has been approved.</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Type: ${request.request_type}</li>
          <li>Dates: ${startDate} - ${endDate}</li>
          <li>Duration: ${request.days_requested} day${
            request.days_requested !== 1 ? "s" : ""
          }</li>
          ${request.reason ? `<li>Reason: ${request.reason}</li>` : ""}
        </ul>
        <p>Enjoy your time off!</p>
        <p>Best regards,<br>HR Team</p>
      `
        : `
        <h2>Time Off Request Update</h2>
        <p>Hi ${employeeName},</p>
        <p>We regret to inform you that your ${
          request.request_type
        } request has been denied.</p>
        <p><strong>Request Details:</strong></p>
        <ul>
          <li>Type: ${request.request_type}</li>
          <li>Dates: ${startDate} - ${endDate}</li>
          <li>Duration: ${request.days_requested} day${
            request.days_requested !== 1 ? "s" : ""
          }</li>
          ${request.reason ? `<li>Reason: ${request.reason}</li>` : ""}
        </ul>
        <p>Please reach out to your manager if you have any questions.</p>
        <p>Best regards,<br>HR Team</p>
      `;

    const emailResponse = await resend.emails.send({
      from: "HR Team <hr@yourdomain.com>",
      to: [profile.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-time-off-notification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
