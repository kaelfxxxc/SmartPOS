import { useEffect, useState } from "react"
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
import { supabase } from "@/lib/supabase/client"
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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

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
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  )

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const markInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setInstallHelp(false)
    }
    window.addEventListener("beforeinstallprompt", capturePrompt)
    window.addEventListener("appinstalled", markInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt)
      window.removeEventListener("appinstalled", markInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) {
      setInstallHelp(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    setInstallPrompt(null)
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
        {subscription.data && (() => {
          const expiration = subscription.data.status === "trialing" ? subscription.data.trial_ends_at : subscription.data.current_period_ends_at
          const daysLeft = expiration ? Math.max(0, Math.ceil((new Date(expiration).getTime() - Date.now()) / 86_400_000)) : null
          return <div className="sidebar-trial"><CalendarDays size={19} /><div><b>{subscription.data.status === "trialing" ? "Free trial" : subscription.data.plan.replace("_", " ")}</b><small>{expiration ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · Ends ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(expiration))}` : "No expiration date"}</small></div></div>
        })()}
        <div className="sidebar-help">
          <Cloud size={20} />
          <b>Connected & secure</b>
        </div>
      </aside>
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
          {!installed && (
            <Button variant="secondary" className="pwa-install-button" onClick={installApp}>
              <Download size={17} /> <span>Install app</span>
            </Button>
          )}
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
