import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseSignature(header: string) {
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key && value) parts[key] = value;
  }
  return parts;
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("PayMongo webhook secrets are incomplete.");
    return json({ error: "Webhook is not configured." }, 503);
  }

  const signature = parseSignature(
    request.headers.get("Paymongo-Signature") ||
      request.headers.get("X-Paymongo-Signature") ||
      "",
  );
  const rawBody = await request.text();
  const timestamp = Number(signature.t);
  if (!Number.isFinite(timestamp)) return json({ error: "Invalid signature." }, 401);

  // Reject stale signed deliveries to reduce replay risk. PayMongo retries promptly.
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > 300) return json({ error: "Expired signature." }, 401);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const expected = await hmacHex(webhookSecret, `${signature.t}.${rawBody}`);
  const supplied = payload?.data?.attributes?.livemode ? signature.li : signature.te;
  if (!supplied || !constantTimeEqual(expected, supplied)) {
    return json({ error: "Invalid signature." }, 401);
  }

  const event = payload?.data;
  if (event?.attributes?.type !== "checkout_session.payment.paid") {
    return json({ received: true });
  }

  const session = event.attributes.data;
  const referenceNumber = session?.attributes?.reference_number;
  const sessionId = session?.id;
  if (!referenceNumber || !sessionId) return json({ received: true });

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: checkout, error: checkoutError } = await db
    .from("subscription_checkouts")
    .select("id,business_id,plan,billing_cycle,amount_centavos,status,paymongo_session_id")
    .eq("reference_number", referenceNumber)
    .maybeSingle();

  if (checkoutError) {
    console.error("Unable to read subscription checkout", event.id, checkoutError);
    return json({ error: "Webhook processing failed." }, 500);
  }
  if (!checkout || checkout.paymongo_session_id !== sessionId) {
    return json({ received: true });
  }
  if (checkout.status === "paid") return json({ received: true });
  if (checkout.status !== "pending") return json({ received: true });

  const paidPayment = (session.attributes?.payments || []).find(
    (payment: any) => payment?.attributes?.status === "paid",
  );
  if (Number(paidPayment?.attributes?.amount) !== Number(checkout.amount_centavos)) {
    console.error("Paid amount did not match checkout", event.id);
    return json({ error: "Payment amount mismatch." }, 400);
  }

  const periodEnd = new Date();
  if (checkout.billing_cycle === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const { data: claimed, error: claimError } = await db
    .from("subscription_checkouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", checkout.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) {
    console.error("Unable to claim subscription checkout", event.id, claimError);
    return json({ error: "Webhook processing failed." }, 500);
  }
  if (!claimed) return json({ received: true });

  const { error: subscriptionError } = await db
    .from("business_subscriptions")
    .update({
      plan: checkout.plan,
      status: "active",
      billing_cycle: checkout.billing_cycle,
      current_period_ends_at: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", checkout.business_id);

  if (subscriptionError) {
    await db
      .from("subscription_checkouts")
      .update({ status: "pending", paid_at: null })
      .eq("id", checkout.id)
      .eq("status", "paid");
    console.error("Unable to activate subscription", event.id, subscriptionError);
    return json({ error: "Webhook processing failed." }, 500);
  }

  return json({ received: true });
});
