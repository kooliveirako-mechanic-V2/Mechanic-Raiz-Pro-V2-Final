import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PIXEL_ID = "904555945615995";
const META_API_VERSION = "v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("META_PIXEL_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("META_PIXEL_ACCESS_TOKEN not configured");
    }

    const body = await req.json();
    const {
      event_name = "Purchase",
      value,
      currency = "BRL",
      event_id,
      user_email,
      user_ip,
      user_agent,
      event_source_url,
    } = body;

    // Build user_data with hashing
    const userData: Record<string, string> = {};
    if (user_email) {
      const encoder = new TextEncoder();
      const data = encoder.encode(user_email.toLowerCase().trim());
      const hash = await crypto.subtle.digest("SHA-256", data);
      userData.em = [
        Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      ] as any;
    }
    if (user_ip) userData.client_ip_address = user_ip;
    if (user_agent) userData.client_user_agent = user_agent;

    const eventData: Record<string, unknown> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: userData,
    };

    if (event_id) eventData.event_id = event_id;
    if (event_source_url) eventData.event_source_url = event_source_url;

    if (value) {
      eventData.custom_data = {
        value: parseFloat(value),
        currency,
      };
    }

    const url = `https://graph.facebook.com/${META_API_VERSION}/${PIXEL_ID}/events`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [eventData],
        access_token: accessToken,
      }),
    });

    const result = await response.json();

    console.log("Meta CAPI response:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Meta CAPI error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
