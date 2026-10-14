import { useEffect, useRef, useState } from "react"
import {
  ArrowRight,
  BarChart3,
  Box,
  Check,
  ChevronDown,
  CircleCheck,
  CloudOff,
  CreditCard,
  Download,
  Headphones,
  Menu,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  ShoppingBasket,
  Square,
  Store,
  UtensilsCrossed,
  WifiOff,
  X,
} from "lucide-react"
import { AppLink, Button, Logo } from "@/components/ui"
import { usePwaInstall } from "@/lib/pwaInstall"

const ENGLISH =
  "SmartPOS is your AI-native point of sale and inventory system, made for Filipino businesses. Manage sales, stock, GCash, Maya, and customer credit in one secure place. Keep selling even when the internet is unreliable, then synchronize your authorized records when you reconnect."
const FILIPINO =
  "Ang SmartPOS ay isang AI-native point of sale at inventory system para sa mga negosyong Pilipino. Pamahalaan ang benta, imbentaryo, GCash, Maya, at utang ng customer sa isang ligtas na sistema."
const faqs = [
  [
    "Can SmartPOS work without internet?",
    "Offline checkout is designed to queue permitted local transactions and synchronize them when a verified connection returns. Offline records remain clearly marked as provisional until confirmed.",
  ],
  [
    "Does it automatically confirm GCash or Maya payments?",
    "No. Manually entered wallet references remain cashier-confirmed or unverified until reconciled with an authorized provider workflow.",
  ],
  [
    "Is every printed receipt BIR-authorized?",
    "No. Internal records are clearly identified. Configured invoice issuance requires the business’s actual registration, approved setup, and BIR or professional verification.",
  ],
]

function Narration() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle")
  const [language, setLanguage] = useState<"en-PH" | "fil-PH">("en-PH")
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const supported = "speechSynthesis" in window
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  function play() {
    if (!supported) return
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(
      language === "en-PH" ? ENGLISH : FILIPINO,
    )
    speech.lang = language
    speech.onend = () => setStatus("idle")
    speech.onerror = () => setStatus("idle")
    utterance.current = speech
    window.speechSynthesis.speak(speech)
    setStatus("playing")
  }
  function stop() {
    window.speechSynthesis.cancel()
    setStatus("idle")
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Headphones size={18} /> Listen to system overview
      </Button>
      {open && (
        <div
          className="narration-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="narration-title"
        >
          <div className="narration-card">
            <Button
              variant="ghost"
              className="close-button"
              aria-label="Close"
              onClick={() => {
                stop()
                setOpen(false)
              }}
            >
              <X />
            </Button>
            <span className="narration-icon">
              <Headphones />
            </span>
            <span className="eyebrow">Audio overview</span>
            <h2 id="narration-title">Listen in your preferred language</h2>
            <div className="language-toggle">
              <Button
                variant={language === "en-PH" ? "dark" : "ghost"}
                onClick={() => {
                  stop()
                  setLanguage("en-PH")
                }}
              >
                English
              </Button>
              <Button
                variant={language === "fil-PH" ? "dark" : "ghost"}
                onClick={() => {
                  stop()
                  setLanguage("fil-PH")
                }}
              >
                Filipino
              </Button>
            </div>
            <div className="transcript">
              <small>Transcript</small>
              <p>{language === "en-PH" ? ENGLISH : FILIPINO}</p>
            </div>
            {!supported ? (
              <div className="form-message">
                Speech synthesis is not supported by this browser. The
                transcript remains available.
              </div>
            ) : (
              <div className="audio-controls">
                {status === "idle" && (
                  <Button onClick={play}>
                    <Play size={18} /> Play
                  </Button>
                )}
                {status === "playing" && (
                  <Button
                    onClick={() => {
                      window.speechSynthesis.pause()
                      setStatus("paused")
                    }}
                  >
                    <Pause size={18} /> Pause
                  </Button>
                )}
                {status === "paused" && (
                  <Button
                    onClick={() => {
                      window.speechSynthesis.resume()
                      setStatus("playing")
                    }}
                  >
                    <Play size={18} /> Resume
                  </Button>
                )}
                <Button variant="secondary" onClick={stop}>
                  <Square size={16} /> Stop
                </Button>
                <Button variant="ghost" onClick={play}>
                  <RotateCcw size={17} /> Replay
                </Button>
              </div>
            )}
            <span className="playback-status" role="status">
              Status: {status}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

function DashboardPreview() {
  return (
    <div className="hero-preview">
      <div className="preview-sidebar">
        <span>T</span>
        {[1, 2, 3, 4, 5].map((i) => (
          <i className={i === 1 ? "active" : ""} key={i} />
        ))}
      </div>
      <div className="preview-main">
        <div className="preview-top">
          Business overview <i />
          <i />
        </div>
        <div className="preview-welcome">
          <div>
            <small>MAGANDANG ARAW!</small>
            <b>Your store at a glance</b>
          </div>
          <span>+ New sale</span>
        </div>
        <div className="preview-kpis">
          {["Today’s sales", "Transactions", "Items sold"].map((x) => (
            <div key={x}>
              <small>{x}</small>
              <b>—</b>
              <i />
            </div>
          ))}
        </div>
        <div className="preview-lower">
          <div className="preview-chart">
            <b>Sales overview</b>
            <div className="bars">
              {[25, 45, 30, 68, 48, 78, 56].map((h, i) => (
                <i style={{ height: `${h}%` }} key={i} />
              ))}
            </div>
          </div>
          <div className="preview-stock">
            <b>Stock health</b>
            <div className="donut" />
            <small>Ready for products</small>
          </div>
        </div>
      </div>
      <span className="float-card float-a">
        <CircleCheck size={18} /> Secure records
      </span>
      <span className="float-card float-b">
        <WifiOff size={18} /> Offline-ready
      </span>
    </div>
  )
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [installHelp, setInstallHelp] = useState(false)
  const { installed, requestInstall } = usePwaInstall()

  async function installApp() {
    const accepted = await requestInstall()
    if (!accepted) {
      setInstallHelp(true)
    }
  }

  return (
    <main className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className={menu ? "nav-links open" : "nav-links"}>
          <a href="#features">Features</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
        </nav>
        <div className="nav-actions">
          <AppLink to="/login">Log in</AppLink>
          <AppLink to="/login" variant="primary">
            Start free
          </AppLink>
        </div>
        {!installed && <Button variant="secondary" className="landing-pwa-install" onClick={installApp}><Download size={17} /><span>Install</span></Button>}
        <Button
          variant="ghost"
          className="mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-label="Toggle navigation"
        >
          <Menu />
        </Button>
      </header>
      {installHelp && <div className="landing-install-help" role="status"><span>Open your browser menu and choose <b>Install app</b> or <b>Add to Home Screen</b>. On iPhone and iPad, use the Share menu.</span><Button variant="ghost" aria-label="Close installation instructions" onClick={() => setInstallHelp(false)}><X size={16} /></Button></div>}
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Your Business.
            <br />
            <em>Smarter Sales.</em>
            <br />
            Simpler Management.
          </h1>
          <p>
            One easy system for sales, inventory, GCash, Maya, and customer
            credit—designed around how Filipino businesses actually work.
          </p>
          <div className="hero-actions">
            <AppLink to="/login" variant="primary" className="hero-trial-cta">
              Start 7-day free trial
            </AppLink>
            <a className="btn btn-ghost" href="#features">
              Explore features
            </a>
            <Narration />
          </div>
          <div className="hero-trust">
            <span>
              <Check /> No card required
            </span>
            <span>
              <Check /> Philippine-ready
            </span>
            <span>
              <Check /> Guided setup
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <DashboardPreview />
        </div>
      </section>
      <section className="trust-strip">
        <span>BUILT FOR EVERYDAY FILIPINO BUSINESS</span>
        <div>
          {[
            "Sari-sari",
            "Carinderia",
            "Café & Bakery",
            "Mini Grocery",
            "Food Kiosk",
          ].map((x) => (
            <b key={x}>{x}</b>
          ))}
        </div>
      </section>
      <section className="section" id="features">
        <div className="section-intro">
          <span className="eyebrow">Everything in one place</span>
          <h2>
            Less time managing.
            <br />
            More time growing.
          </h2>
          <p>
            Clear workflows and dependable records help your team move quickly
            without losing control.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-card featured">
            <span className="feature-icon">
              <ShoppingBasket />
            </span>
            <h3>Fast, friendly checkout</h3>
            <p>
              Search, scan, and complete sales with large controls made for busy
              counters.
            </p>
            <div className="mini-pos">
              <div>
                <span>Basket</span>
                <b>0 items</b>
              </div>
              <i />
              <i />
              <button>Ready for your first sale</button>
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-icon teal">
              <ScanLine />
            </span>
            <h3>Barcode-ready inventory</h3>
            <p>Know confirmed, projected, and low stock at a glance.</p>
            <div className="scan-graphic">
              <ScanLine />
              <span>EAN · UPC · CODE 128</span>
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-icon gold">
              <CreditCard />
            </span>
            <h3>Payments that fit</h3>
            <p>
              Record cash, GCash, Maya, split payments, and authorized utang
              honestly.
            </p>
            <div className="payment-pills">
              <span>Cash</span>
              <span>GCash</span>
              <span>Maya</span>
            </div>
          </article>
          <article className="feature-card wide">
            <div>
              <span className="feature-icon navy">
                <BarChart3 />
              </span>
              <h3>Reports you can trust</h3>
              <p>
                See sales, cost, profit, expenses, and receivables from actual
                persisted records—not made-up dashboard values.
              </p>
            </div>
            <div className="report-graphic">
              <div className="report-bars">
                {[30, 50, 42, 74, 60, 88, 72].map((h, i) => (
                  <i style={{ height: `${h}%` }} key={i} />
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
      <section className="offline-section" id="solutions">
        <div className="offline-art">
          <div className="signal-orbit">
            <CloudOff />
            <span>Offline mode</span>
          </div>
          <div className="offline-ticket">
            <small>PROVISIONAL SALE</small>
            <b>Saved securely on device</b>
            <span>
              <CircleCheck /> Queued for sync
            </span>
          </div>
        </div>
        <div className="offline-copy">
          <span className="eyebrow light">Internet down? Keep selling.</span>
          <h2>Made for real-world connectivity.</h2>
          <p>
            Record permitted local sales and preserve them across restarts. When
            a verified connection returns, SmartPOS synchronizes in dependency
            order and surfaces conflicts instead of silently discarding a sale.
          </p>
          <ul>
            <li>
              <Check /> Persistent structured offline queue
            </li>
            <li>
              <Check /> Clear provisional receipts
            </li>
            <li>
              <Check /> Idempotent synchronization
            </li>
          </ul>
          <small>
            Offline devices cannot guarantee globally current stock. Confirmed
            and projected quantities are always distinguished.
          </small>
        </div>
      </section>
      <section className="security-section" id="about">
        <div>
          <span className="eyebrow">Security by design</span>
          <h2>Your business data stays your business.</h2>
          <p>
            Tenant-aware access, branch permissions, server-enforced roles, and
            immutable financial records form the foundation—not an afterthought.
          </p>
          <div className="security-points">
            <span>
              <ShieldCheck /> Row-level security
            </span>
            <span>
              <PackageCheck /> Auditable records
            </span>
          </div>
        </div>
        <div className="security-badge">
          <ShieldCheck />
          <b>Protected workspace</b>
        </div>
      </section>
      <section className="section business-section">
        <div className="section-intro centered">
          <span className="eyebrow">Made for your kind of business</span>
          <h2>One smart system, many ways to sell.</h2>
        </div>
        <div className="category-grid">
          {[
            [Store, "Sari-sari stores"],
            [UtensilsCrossed, "Carinderias & cafés"],
            [ShoppingBasket, "Mini groceries"],
            [Box, "Food stalls & kiosks"],
          ].map(([Icon, title]) => (
            <article key={title as string}>
              <Icon />
              <div>
                <h3>{title as string}</h3>
                <p>Simple, fast, and flexible workflows</p>
              </div>
              <ArrowRight />
            </article>
          ))}
        </div>
      </section>
      <section className="section pricing-section" id="pricing">
        <div className="section-intro centered">
          <span className="eyebrow">Simple food business pricing</span>
          <h2>Start free. Grow when you’re ready.</h2>
          <p>Choose monthly or save with annual billing.</p>
        </div>
        <div className="pricing-grid">
          {[
            [
              "7-Day Free Trial",
              "₱0",
              "Up to 50 products",
              "10 AI scans during trial",
              "Basic inventory & expiration alerts",
            ],
            [
              "Starter",
              "₱699.00",
              "Up to 500 products",
              "100 AI scans per month",
              "Food waste reports & storage areas",
            ],
            [
              "Professional",
              "₱999.00",
              "Up to 500 products",
              "Unlimited AI scans",
              "Multiple staff & advanced reporting",
            ],
          ].map((p, i) => (
            <article
              className={i === 1 ? "price-card popular" : "price-card"}
              key={p[0]}
            >
              {i === 1 && <span className="popular-tag">MOST POPULAR</span>}
              <h3>{p[0]}</h3>
              <div className="price">
                {p[1]}
                {i > 0 && <small>/month</small>}
              </div>
              {p.slice(2).map((x) => (
                <p key={x}>
                  <Check />
                  {x}
                </p>
              ))}
              <AppLink to="/login" variant={i === 1 ? "primary" : "secondary"}>
                {i === 0 ? "Start free trial" : "Choose plan"}
              </AppLink>
              {i > 0 && (
                <small>{i === 1 ? "₱6,999" : "₱9,999"} billed yearly</small>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="section faq-section">
        <div className="section-intro">
          <span className="eyebrow">Questions, answered</span>
          <h2>Good to know before you start.</h2>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a], i) => (
            <article className={openFaq === i ? "open" : ""} key={q}>
              <Button
                variant="ghost"
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
              >
                <span>{q}</span>
                <ChevronDown />
              </Button>
              {openFaq === i && <p>{a}</p>}
            </article>
          ))}
        </div>
      </section>
      <section className="final-cta">
        <span className="eyebrow light">Ready when you are</span>
        <h2>Make every sale count.</h2>
        <p>Set up your Philippine business workspace in minutes.</p>
        <AppLink to="/login" variant="secondary">
          Start your free trial <ArrowRight />
        </AppLink>
      </section>
      <footer>
        <Logo light />
        <p>Modern sales and inventory management for Filipino businesses.</p>
        <div>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">Security</a>
        </div>
        <small>
          © 2026 SmartPOS — Your AI-native POS. Internal receipts are not automatically
          BIR-authorized invoices.
        </small>
      </footer>
    </main>
  )
}
