import { useLocation } from "react-router"
import { AppLink, Logo } from "@/components/ui"
import { ArrowLeft } from "lucide-react"

export default function LegalPage() {
  const { pathname } = useLocation()
  const privacy = pathname === "/privacy"

  return (
    <main className="legal-page">
      <header className="simple-header">
        <Logo />
        <AppLink to="/login" className="back-link legal-back">
          <ArrowLeft size={17} /> Back
        </AppLink>
      </header>
      <article className="legal-document">
        <span className="eyebrow">SmartPOS legal</span>
        <h1>{privacy ? "Privacy Policy" : "Terms and Conditions"}</h1>
        <p className="legal-updated">Effective date: October 14, 2026</p>
        {privacy ? (
          <>
            <h2>Information we process</h2>
            <p>
              SmartPOS processes account, business, branch, staff, product, and
              transaction information needed to provide the service. Payment
              card credentials and Supabase service-role credentials must never
              be stored in the browser application.
            </p>
            <h2>How information is used</h2>
            <p>
              Information is used to authenticate users, isolate business
              records, operate requested POS features, maintain audit history,
              and protect the service. Business data is not presented as public
              information.
            </p>
            <h2>Storage and offline data</h2>
            <p>
              Authorized business records may be cached on a registered device
              to support offline operation. Shared-device users must sign out
              safely and avoid clearing unsynchronized records.
            </p>
            <h2>Your responsibilities and choices</h2>
            <p>
              Business owners are responsible for lawful collection of customer
              and employee information. Contact the service administrator to
              request access, correction, export, or deletion where legally
              permitted. Completed financial history may need to be retained.
            </p>
          </>
        ) : (
          <>
            <h2>Using SmartPOS</h2>
            <p>
              You must provide accurate registration information, protect your
              account, and use SmartPOS only for lawful business activity.
              Owners are responsible for staff access and business settings.
            </p>
            <h2>Payments, taxes, and invoices</h2>
            <p>
              Manually recorded GCash or Maya references are not provider
              confirmation. Internal receipts are not automatically
              BIR-authorized invoices. Businesses remain responsible for tax,
              registration, and regulatory requirements applicable to them.
            </p>
            <h2>Offline operation</h2>
            <p>
              Disconnected devices cannot guarantee globally current stock.
              Pending records may require review during synchronization and
              must not be silently discarded.
            </p>
            <h2>Service limitations</h2>
            <p>
              Features may depend on configured third-party services such as
              Supabase and OAuth providers. Production use requires appropriate
              security, legal, backup, and operational review.
            </p>
          </>
        )}
      </article>
    </main>
  )
}
