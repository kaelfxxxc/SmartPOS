import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShoppingCart,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { useNavigate } from "react-router"
import { Button, Logo } from "@/components/ui"
import storeIcon from "@/images/icons/store-svgrepo-com.svg"
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/client"
import { usePwaInstall } from "@/lib/pwaInstall"
import {
  DashboardView,
  DigitalLedgerView,
  CreditView,
  InventoryView,
  NotificationsView,
  PeopleView,
  PosView,
  SalesView,
  SettingsView,
} from "./WorkspaceViews"
import type { BusinessContext, WorkspaceView } from "./types"

const coreNav = [
  [LayoutDashboard, "Dashboard", "dashboard"],
  [ShoppingCart, "POS / Cashier", "pos"],
  [Boxes, "Inventory & Stock", "inventory"],
  [CircleDollarSign, "Sales & Reports", "sales"],
] as const

const storeNav = [
  [WalletCards, "Digital Ledger", "ledger"],
  [CreditCard, "Utang / Credit", "credit"],
  [Users, "Customers & Staff", "people"],
  [Settings, "Hardware & Settings", "settings"],
] as const

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [view, setView] = useState<WorkspaceView>("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [subscriptionBillingPreview, setSubscriptionBillingPreview] = useState<"monthly" | "annual">("monthly")
  const [checkoutError, setCheckoutError] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState<"starter" | "professional" | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const { installed, requestInstall } = usePwaInstall()

  async function installApp() {
    const accepted = await requestInstall()
    if (!accepted) {
      setInstallHelp(true)
    }
  }

  const membership = useQuery({
    queryKey: ["current-business"],
    queryFn: async (): Promise<BusinessContext | null> => {
      const { data: member, error } = await supabase
        .from("business_members")
        .select("role,business_id,businesses(name)")
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!member) return null
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("id,name")
        .eq("business_id", member.business_id)
        .eq("is_active", true)
        .order("created_at")
        .limit(1)
        .single()
      if (branchError) throw branchError
      const business = member.businesses as unknown as { name: string }
      return {
        businessId: member.business_id,
        branchId: branch.id,
        businessName: business.name,
        branchName: branch.name,
        role: member.role,
      }
    },
  })
  const subscription = useQuery({
    queryKey: ["business-subscription", membership.data?.businessId],
    enabled: Boolean(membership.data?.businessId),
    refetchInterval: (query) => {
      const returnedFromPayment = new URLSearchParams(window.location.search).get("payment") === "success"
      return returnedFromPayment && query.state.data?.status !== "active" ? 2_000 : false
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_subscriptions")
        .select("plan,status,billing_cycle,trial_ends_at,current_period_ends_at")
        .eq("business_id", membership.data!.businessId)
        .single()
      if (error) throw error
      return data
    },
  })

  if (!membership.isLoading && !membership.data && !membership.error) {
    navigate("/onboarding", { replace: true })
    return null
  }

  function changeView(next: WorkspaceView) {
    setView(next)
    setMobileOpen(false)
  }

  async function buyPlan(plan: "starter" | "professional") {
    setCheckoutError("")
    setCheckoutLoading(plan)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Sign in again to continue to payment.")
      let response: Response
      try {
        response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/server`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan, cycle: subscriptionBillingPreview }),
        })
      } catch (networkError) {
        throw new Error(`Cannot connect to Supabase project ${new URL(supabaseUrl).host}. Check your network connection and try again.`)
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || `Supabase function returned HTTP ${response.status}. Check that the "server" function is deployed.`)
      }
      if (!data?.checkoutUrl) {
        throw new Error(data?.error || "The server function responded without a checkout URL. Redeploy the updated server function.")
      }
      if (!data?.checkoutUrl || !data.checkoutUrl.startsWith("https://checkout.paymongo.com/")) throw new Error(data?.error || "PayMongo returned an invalid checkout link.")
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout. Please try again.")
      setCheckoutLoading(null)
    }
  }

  const context = membership.data

  return (
    <div className="workspace">
      {mobileOpen && (
        <Button
          variant="ghost"
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-logo-row">
          <div className="workspace-brand"><Logo light /></div>
          <Button
            variant="ghost"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </Button>
        </div>
        <nav aria-label="Workspace navigation">
          <span className="sidebar-section-label">Core operations</span>
          {coreNav.map(([Icon, label, key]) => (
            <Button
              variant="ghost"
              className={view === key ? "nav-item active" : "nav-item"}
              key={key}
              onClick={() => changeView(key)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Button>
          ))}
          <span className="sidebar-section-label">Philippine store features</span>
          {storeNav.map(([Icon, label, key]) => (
            <Button
              variant="ghost"
              className={view === key ? "nav-item active" : "nav-item"}
              key={key}
              onClick={() => changeView(key)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="sidebar-footer">
        {subscription.isLoading && <div className="sidebar-trial" title="Loading subscription"><CalendarDays size={19} /><div><b>Subscription</b><small>Loading plan…</small></div></div>}
        {subscription.error && <div className="sidebar-trial subscription-error" title="Subscription unavailable"><CalendarDays size={19} /><div><b>Subscription unavailable</b><small>Apply the subscription migration.</small></div></div>}
        {subscription.data && (() => {
          const expiration = subscription.data.status === "trialing" ? subscription.data.trial_ends_at : subscription.data.current_period_ends_at
          const daysLeft = expiration ? Math.max(0, Math.ceil((new Date(expiration).getTime() - Date.now()) / 86_400_000)) : null
          const planLabel = subscription.data.status === "trialing" ? "Free trial" : subscription.data.plan.replace("_", " ")
          const detail = expiration ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · Ends ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(expiration))}` : "No expiration date"
          return <button type="button" className="sidebar-trial" title={`${planLabel} · ${detail}`} aria-label={`View subscription plan: ${planLabel}`} onClick={() => { setSubscriptionBillingPreview(subscription.data.billing_cycle === "annual" ? "annual" : "monthly"); setSubscriptionOpen(true); setMobileOpen(false) }}><CalendarDays size={19} /><div><b>{planLabel}</b><small>{detail}</small><span className="sidebar-trial-action">View plan</span></div></button>
        })()}
        {!installed && (
          <Button type="button" variant="secondary" className="pwa-install-button sidebar-install-button" onClick={installApp} aria-label="Install SmartPOS as an app">
            <Download size={17} /> <span>Install SmartPOS</span>
          </Button>
        )}
        <div className="sidebar-help">
          <Cloud size={20} />
          <b>Connected & secure</b>
        </div>
        </div>
      </aside>
      {subscriptionOpen && subscription.data && (() => {
        const expiration = subscription.data.status === "trialing" ? subscription.data.trial_ends_at : subscription.data.current_period_ends_at
        const planLabel = subscription.data.status === "trialing" ? "7-Day Free Trial" : subscription.data.plan === "professional" ? "Professional" : "Starter"
        return <div className="subscription-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSubscriptionOpen(false) }}><section className="subscription-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-dialog-title"><header><div><span><CalendarDays size={22}/></span><div><small>Current subscription</small><h2 id="subscription-dialog-title">{planLabel}</h2></div></div><Button variant="ghost" aria-label="Close subscription details" onClick={() => setSubscriptionOpen(false)}><X size={20}/></Button></header><div className="subscription-billing-toggle" role="group" aria-label="Billing cycle"><button type="button" className={subscriptionBillingPreview === "monthly" ? "active" : ""} onClick={() => setSubscriptionBillingPreview("monthly")}>Monthly</button><button type="button" className={subscriptionBillingPreview === "annual" ? "active" : ""} onClick={() => setSubscriptionBillingPreview("annual")}>Yearly</button></div><div className="subscription-options">{checkoutError && <p className="subscription-checkout-error" role="alert">{checkoutError}</p>}<article className="subscription-free-plan"><b>7-Day Free Trial</b><strong>Free</strong>{subscription.data.status === "trialing" && <small className="subscription-trial-expiry">Trial expires {expiration ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(expiration)) : "No date"}</small>}<ul><li>Up to 50 products</li><li>10 AI scans during trial</li><li>Basic inventory &amp; expiration alerts</li></ul></article><article className="subscription-recommended-plan"><span className="subscription-recommended-badge">Best choice</span><b>Starter</b><strong>{subscriptionBillingPreview === "annual" ? "₱6,999" : "₱699"}<small>/{subscriptionBillingPreview === "annual" ? "year" : "month"}</small></strong>{subscriptionBillingPreview === "annual" && <em>Billed yearly</em>}<ul><li>Up to 500 products</li><li>100 AI scans per month</li><li>Food waste reports &amp; storage areas</li></ul><Button className="subscription-buy-plan" loading={checkoutLoading === "starter"} disabled={checkoutLoading !== null} onClick={() => buyPlan("starter")}>Buy plan</Button></article><article className="subscription-professional-plan"><b>Professional</b><strong>{subscriptionBillingPreview === "annual" ? "₱9,999" : "₱999"}<small>/{subscriptionBillingPreview === "annual" ? "year" : "month"}</small></strong>{subscriptionBillingPreview === "annual" && <em>Billed yearly</em>}<ul><li>Up to 500 products</li><li>Unlimited AI scans</li><li>Multiple staff &amp; advanced reporting</li></ul><Button className="subscription-buy-plan" loading={checkoutLoading === "professional"} disabled={checkoutLoading !== null} onClick={() => buyPlan("professional")}>Buy plan</Button></article></div></section></div>
      })()}
      <main className="workspace-main">
        <header className="workspace-header">
          <Button
            variant="ghost"
            className="mobile-menu"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <Button
            variant="ghost"
            className="business-switcher"
            onClick={() => changeView("settings")}
          >
            <span className="mini-icon">
              <img src={storeIcon} alt="" />
            </span>
            <div>
              <b>{context?.businessName ?? "Loading business…"}</b>
              <small>{context?.branchName ?? "Loading branch…"}</small>
            </div>
            <ChevronDown size={16} />
          </Button>
          <Button
            variant="ghost"
            className="global-search"
            onClick={() => changeView("inventory")}
          >
            <Search size={18} />
            <span>Search products and inventory…</span>
            <kbd>⌘ K</kbd>
          </Button>
          <span className="online-pill">
            <i /> Online
          </span>
          <span className="system-ready-pill">System ready</span>
          <Button
            variant="ghost"
            className="icon-button"
            aria-label="Notifications"
            onClick={() => changeView("notifications")}
          >
            <Bell size={20} />
          </Button>
          <Button
            variant="ghost"
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              await supabase.auth.signOut()
              navigate("/")
            }}
          >
            <LogOut size={20} />
          </Button>
        </header>
        <section className="dashboard-content">
          {installHelp && (
            <div className="pwa-install-help" role="status">
              <span>Open your browser menu and choose <b>Install app</b> or <b>Add to Home Screen</b>. On iPhone and iPad, use the Share menu.</span>
              <Button variant="ghost" aria-label="Close installation instructions" onClick={() => setInstallHelp(false)}><X size={16} /></Button>
            </div>
          )}
          {membership.error && (
            <div className="form-message">
              Unable to load your business workspace. Confirm the migrations
              were applied and refresh the page.
            </div>
          )}
          {context && view === "dashboard" && (
            <DashboardView context={context} onNavigate={changeView} />
          )}
          {context && view === "pos" && <PosView context={context} />}
          {context && view === "inventory" && (
            <InventoryView context={context} />
          )}
          {context && view === "sales" && <SalesView context={context} />}
          {context && view === "ledger" && <DigitalLedgerView context={context} />}
          {context && view === "credit" && <CreditView context={context} />}
          {context && view === "people" && <PeopleView context={context} />}
          {context && view === "settings" && <SettingsView context={context} />}
          {context && view === "notifications" && (
            <NotificationsView context={context} />
          )}
        </section>
      </main>
    </div>
  )
}
