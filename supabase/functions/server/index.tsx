import { Hono, type Context } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const planCatalog = {
  starter: {
    monthly: { amount: 69900, name: "SmartPOS Starter — Monthly" },
    annual: { amount: 699900, name: "SmartPOS Starter — Yearly" },
  },
  professional: {
    monthly: { amount: 99900, name: "SmartPOS Professional — Monthly" },
    annual: { amount: 999900, name: "SmartPOS Professional — Yearly" },
  },
} as const;

async function forwardCheckout(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const headers = new Headers(c.req.raw.headers);
  headers.set("Content-Type", "application/json");
  return app.request(new Request("http://localhost/paymongo/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }));
}

app.post("/", forwardCheckout);
app.post("/server", forwardCheckout);
app.post("/server/", forwardCheckout);

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Subscription payments are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

app.post("/paymongo/checkout", async (c) => {
  const requestId = crypto.randomUUID();
  try {
    const body = await c.req.json();
    const plan = body?.plan;
    const cycle = body?.cycle;
    if (typeof plan !== "string" || !(plan in planCatalog) || !(cycle === "monthly" || cycle === "annual")) {
      return c.json({ error: "Choose a valid plan and billing cycle." }, 400);
    }

    const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!secretKey) return c.json({ error: "PayMongo is not configured yet." }, 503);

    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Sign in to buy a plan." }, 401);
    const token = authHeader.slice("Bearer ".length);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) return c.json({ error: "Subscription payments are not configured." }, 503);
    const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return c.json({ error: "Sign in to buy a plan." }, 401);

    const db = adminClient();
    const { data: membership, error: membershipError } = await db
      .from("business_members").select("business_id,role,created_at")
      .eq("user_id", user.id).eq("status", "active")
      .in("role", ["owner", "admin"]).order("created_at").limit(1).maybeSingle();
    if (membershipError || !membership) return c.json({ error: "Only a business owner or admin can buy a plan." }, 403);

    const chosen = planCatalog[plan as keyof typeof planCatalog][cycle as "monthly" | "annual"];
    const referenceNumber = `sp_${crypto.randomUUID()}`;
    const referer = c.req.header("Referer");
    const allowedOrigin = c.req.header("Origin") || Deno.env.get("APP_BASE_URL");
    if (!allowedOrigin) return c.json({ error: "App URL is not configured." }, 503);
    const returnUrl = referer ? new URL(referer) : new URL("/app", allowedOrigin);
    if (returnUrl.origin !== new URL(allowedOrigin).origin) return c.json({ error: "Invalid return URL." }, 400);
    returnUrl.pathname = "/app";
    returnUrl.searchParams.set("subscription", "pending");
    const successUrl = new URL(returnUrl);
    successUrl.searchParams.set("payment", "success");
    const cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set("payment", "cancelled");

    const { data: checkout, error: checkoutError } = await db.from("subscription_checkouts").insert({
      reference_number: referenceNumber,
      business_id: membership.business_id,
      user_id: user.id,
      plan,
      billing_cycle: cycle,
      amount_centavos: chosen.amount,
      status: "pending",
    }).select("id").single();
    if (checkoutError) {
      console.error("PayMongo checkout record insert failed", requestId, checkoutError);
      return c.json({ error: "Checkout database setup is missing or unavailable. Apply the subscription checkout migration." }, 503);
    }

    const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${secretKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { attributes: {
        line_items: [{ name: chosen.name, amount: chosen.amount, currency: "PHP", quantity: 1 }],
        payment_method_types: ["card", "gcash", "grab_pay", "paymaya", "qrph"],
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
        reference_number: referenceNumber,
        description: `SmartPOS ${plan} subscription (${cycle})`,
      } } }),
    });
    const payload = await response.json();
    const checkoutUrl = payload?.data?.attributes?.checkout_url;
    if (!response.ok || !checkoutUrl) {
      await db.from("subscription_checkouts").update({ status: "failed" }).eq("id", checkout.id);
      console.error("PayMongo checkout creation failed", requestId, response.status, payload);
      return c.json({ error: payload?.errors?.[0]?.detail || payload?.errors?.[0]?.code || "PayMongo could not create checkout. Check the API key and enabled payment methods." }, 502);
    }
    const { error: sessionSaveError } = await db.from("subscription_checkouts").update({ paymongo_session_id: payload.data.id }).eq("id", checkout.id);
    if (sessionSaveError) {
      console.error("Unable to save PayMongo session", requestId, sessionSaveError);
      return c.json({ error: "Could not prepare checkout. Please try again." }, 500);
    }
    return c.json({ checkoutUrl });
  } catch (error) {
    console.error("Subscription checkout error", requestId, error);
    return c.json({ error: error instanceof Error ? error.message : "Could not start subscription checkout." }, 500);
  }
});

app.post("/server/paymongo/checkout", forwardCheckout);

app.post("/paymongo/webhook", async (c) => {
  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  if (!webhookSecret) return c.json({ error: "Webhook is not configured." }, 503);
  const signatureHeader = c.req.header("Paymongo-Signature") || c.req.header("X-Paymongo-Signature") || "";
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key && value) parts[key] = value;
  }
  const rawBody = await c.req.text();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const parsedBody = JSON.parse(rawBody);
  const actual = parsedBody?.data?.attributes?.livemode ? parts.li : parts.te;
  if (!actual || actual.length !== expected.length) return c.json({ error: "Invalid webhook signature." }, 401);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  if (difference !== 0) return c.json({ error: "Invalid webhook signature." }, 401);

  try {
    const event = parsedBody?.data;
    if (event?.attributes?.type !== "checkout_session.payment.paid") return c.json({ received: true });
    const session = event.attributes.data;
    const reference = session?.attributes?.reference_number;
    if (!reference) return c.json({ received: true });
    const db = adminClient();
    const { data: order, error } = await db.from("subscription_checkouts").select("*").eq("reference_number", reference).eq("status", "pending").single();
    if (error || !order || order.paymongo_session_id !== session.id) return c.json({ received: true });
    const paid = (session.attributes.payments || []).some((payment: { attributes?: { status?: string } }) => payment.attributes?.status === "paid");
    if (!paid) return c.json({ received: true });
    const periodEnd = new Date();
    if (order.billing_cycle === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { error: updateError } = await db.from("business_subscriptions").update({
      plan: order.plan,
      status: "active",
      billing_cycle: order.billing_cycle,
      current_period_ends_at: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("business_id", order.business_id);
    if (updateError) throw updateError;
    await db.from("subscription_checkouts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", order.id);
    return c.json({ received: true });
  } catch (error) {
    console.error("PayMongo webhook processing error", error);
    return c.json({ error: "Webhook processing failed." }, 500);
  }
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

Deno.serve(app.fetch);
