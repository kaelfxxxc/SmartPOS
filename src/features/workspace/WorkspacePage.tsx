import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Users,
  X,
} from "lucide-react"
import { useNavigate } from "react-router"
import { Button, Logo } from "@/components/ui"
import { supabase } from "@/lib/supabase/client"
import {
  DashboardView,
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
  [CreditCard, "Utang / Credit", "credit"],
  [Users, "Customers & Staff", "people"],
  [Settings, "Hardware & Settings", "settings"],
] as const

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [view, setView] = useState<WorkspaceView>("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)

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
          <div className="workspace-brand"><Logo light /><span>Philippine Cloud POS</span></div>
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
        <div className="sidebar-help">
          <Cloud size={20} />
          <b>Connected & secure</b>
          <small>Records sync with Supabase</small>
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
              <Store size={18} />
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
