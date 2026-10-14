# PayMongo subscription checkout setup

The app creates PayMongo hosted Checkout Sessions server-side. The `server`
function keeps Supabase gateway JWT verification enabled, and the checkout
handler also validates that the caller is an owner/admin. Configure these
secrets in the deployment environment for the existing `server` function:

For Vite, set `VITE_SUPABASE_URL` to the Project URL shown in Supabase →
Project Settings → API, in the form `https://<project-ref>.supabase.co`, and set
`VITE_SUPABASE_ANON_KEY` to that same project's public anon/publishable key.
Put these in `.env.local` for local development or `.env.production` for a Vite
production build. Vite does not automatically load a file named `.env.prod`.
The project reference must be the project you intend to use and must resolve
publicly. The repository's generated fallback reference is
`kwaymqumrspenhbgpcvp`; if that project has been removed or its endpoint does
not resolve, replace both frontend values with the URL and public key from the
active Supabase project. Restart Vite after changing env values.

- `PAYMONGO_SECRET_KEY`: PayMongo test key first (`sk_test_...`), then live key
  only after testing.
- `PAYMONGO_WEBHOOK_SECRET`: secret shown for the PayMongo webhook endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: backend-only Supabase service role key, never a
  `VITE_` variable and never exposed to the browser.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: standard project URL and public anon key.
- `APP_BASE_URL`: public app base URL if the request does not include an Origin.

Apply `supabase/migrations/subscription_checkouts.sql` before enabling checkout.
In PayMongo Developers → Webhooks, register the public URL
`https://<project-ref>.supabase.co/functions/v1/server/paymongo/webhook`
and subscribe to `checkout_session.payment.paid`. Configure and test the webhook
in test mode before using live credentials.

Plan prices are currently defined in `supabase/functions/server/index.tsx` in
centavos: Starter ₱699 monthly / ₱6,999 yearly and Professional ₱999 monthly /
₱9,999 yearly. Change the server catalog if the displayed prices change; the
server remains the source of truth for what is charged.

The customer return URL is informational only. A subscription becomes active
only after the signed PayMongo webhook confirms a paid Checkout Session.
