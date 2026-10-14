# SmartPOS — Your AI-native POS

React, Vite, Tailwind CSS, and Supabase foundation for a Philippine-focused POS.

## Current implementation

The current foundation includes the responsive landing page, bilingual browser narration, Supabase authentication, protected routes, atomic business onboarding, and tenant-aware PostgreSQL schema. The operational core adds persisted products, confirmed inventory receiving, a searchable basket, atomic cash checkout, receipt numbering, stock deduction, branch sales history, customer credit accounts, staff/customer directories, business settings, and live stock notifications.

No sample transactions or fabricated analytics are inserted. Dashboard values remain empty until real transactional modules persist data.

## Supabase setup

1. Open the connected Supabase project.
2. For a new database, apply `foundation.sql`, `signup_profile_fields.sql`, `core_pos.sql`, `customers_credit.sql`, and `phase2_completion.sql` in that order using the SQL editor or Supabase CLI. For an existing database, run the migrations not yet applied.
3. In Authentication settings, add the app origin and `/onboarding` as allowed redirect URLs.
4. Enable the Google and Facebook providers and supply your own OAuth credentials for each required sign-in method. Google OAuth works in Chrome and other supported browsers; Chrome itself is not an OAuth provider.
5. Keep the service-role key server-side. The frontend uses only the generated public anonymous key.

The migration creates UUID-keyed organization, branch, member, permission, catalog, inventory, and audit tables; indexes; constraints; onboarding RPC; and tenant-aware RLS. Direct client writes to financial and inventory movement history are intentionally denied until atomic Phase 2 functions are installed.

## Commands

```bash
pnpm install
pnpm build
pnpm format
```

The Figma Make development server starts automatically. Do not start a second server.

## Important limitations

- Credit sales, wallet ledgers, refunds, PWA synchronization, and advanced reporting remain later phases and do not generate simulated records.
- Printed internal records must not be described as BIR-authorized invoices.
- Make is not intended to collect sensitive PII or replace a production security review.
- Philippine invoicing and tax configuration require verification for the business’s actual registration and use case.
