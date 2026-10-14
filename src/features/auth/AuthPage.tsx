import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowRight, Check, Cloud, ShieldCheck, WifiOff, Zap } from "lucide-react"
import { useNavigate } from "react-router"
import { supabase } from "@/lib/supabase/client"
import {
  AppLink,
  Button,
  CheckboxField,
  Field,
  Logo,
} from "@/components/ui"
import { useAuth } from "./AuthProvider"

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  fullName: z.string().optional(),
  businessName: z.string().optional(),
  phone: z.string().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptTerms: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function submit(values: FormData) {
    if (mode === "signup") {
      if (!values.fullName || values.fullName.trim().length < 2) {
        return setMessage("Enter your full name.")
      }
      if (!values.businessName || values.businessName.trim().length < 2) {
        return setMessage("Enter the name of your store.")
      }
      if (!values.phone || !/^[+0-9()\-\s]{7,20}$/.test(values.phone)) {
        return setMessage("Enter a valid contact number.")
      }
      if (!values.acceptPrivacy || !values.acceptTerms) {
        return setMessage(
          "You must accept the Privacy Policy and Terms and Conditions.",
        )
      }
    }
    setBusy(true)
    setMessage("")
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
          })
        : await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              emailRedirectTo: `${window.location.origin}/onboarding`,
              data: {
                full_name: values.fullName?.trim(),
                business_name: values.businessName?.trim(),
                phone: values.phone?.trim(),
                privacy_accepted_at: new Date().toISOString(),
                terms_accepted_at: new Date().toISOString(),
              },
            },
          })
    setBusy(false)
    if (result.error) return setMessage(result.error.message)
    if (mode === "signup" && !result.data.session) {
      return setMessage(
        "Check your email to verify your account, then sign in.",
      )
    }
    if (mode === "signup") {
      navigate("/onboarding", { replace: true })
      return
    }
    await routeAuthenticatedUser()
  }

  async function routeAuthenticatedUser() {
    setBusy(true)
    const { data, error } = await supabase
      .from("business_members")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
    setBusy(false)
    if (error) return setMessage(error.message)
    navigate(data ? "/app" : "/onboarding", { replace: true })
  }

  useEffect(() => {
    if (user) void routeAuthenticatedUser()
  }, [user?.id])

  async function socialLogin(provider: "google" | "facebook") {
    setBusy(true)
    setMessage("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login` },
    })
    if (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }

  async function resetPassword() {
    const email = getValues("email")
    if (!z.string().email().safeParse(email).success) {
      return setMessage("Enter your email first, then select Forgot password.")
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setMessage(error?.message ?? "Password reset instructions sent.")
  }

  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup">
          <Logo light />
          <div><b>SmartPOS</b><small>Philippine Cloud &amp; Offline Commerce Core</small></div>
        </div>
        <div className="auth-promise">
          <h1>Simple enough for today.<br/><em>Ready for what&apos;s next.</em></h1>
          <p>
            Power checkout, inventory, GCash and Maya records, and customer
            credit from one secure business workspace.
          </p>
          {[
            "Fast barcode checkout and confirmed stock updates",
            "GCash and Maya ledger with service-fee profit tracking",
            "Offline-ready workflows for unstable connections",
            "Digital utang ledger and customer balance records",
          ].map((item) => (
            <div className="auth-check" key={item}>
              <Check size={18} />
              {item}
            </div>
          ))}
        </div>
        <div className="auth-live-card">
          <div><span><i /> Workspace ready</span><b>Cloud synchronized</b></div>
          <div><small>Store operations</small><strong>Sales · Stock · Wallets · Utang</strong></div>
        </div>
        <span className="security-note"><ShieldCheck size={18} /> Business-isolated records with secure Supabase authentication</span>
      </section>
      <section className="auth-form-panel">
        <header className="auth-panel-header">
          <AppLink to="/" className="back-link">Back</AppLink>
          <div><span className="auth-region">🇵🇭 EN / PH</span></div>
        </header>
        <div className="auth-card">
          <h2>
            {mode === "login"
              ? "Sign in to your business"
              : "Start your free trial"}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Enter your store manager credentials or registered business email."
              : "No card required. Set up your first branch in minutes."}
          </p>
          <div className="auth-mode-tabs" role="tablist" aria-label="Account access mode">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage("") }}>Business Owner / Admin</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage("") }}><Zap size={15}/> Start Free Trial</button>
          </div>
          <div className="social-login-grid">
            <Button
              variant="secondary"
              onClick={() => socialLogin("google")}
              disabled={busy}
            >
              <span className="social-provider google-provider" aria-hidden>
                G
              </span>
              Continue with Google
            </Button>
            <Button
              variant="secondary"
              onClick={() => socialLogin("facebook")}
              disabled={busy}
            >
              <span className="social-provider facebook-provider" aria-hidden>
                f
              </span>
              Continue with Facebook
            </Button>
          </div>
          <div className="divider">
            <span>or sign in with registered business email</span>
          </div>
          <form onSubmit={handleSubmit(submit)} className="form-stack">
            {mode === "signup" && (
              <div className="signup-fields">
                <Field
                  label="Your full name"
                  type="text"
                  autoComplete="name"
                  placeholder="Juan Dela Cruz"
                  {...register("fullName")}
                />
                <Field
                  label="Store name"
                  type="text"
                  autoComplete="organization"
                  placeholder="e.g. Juan’s Sari-sari Store"
                  {...register("businessName")}
                />
                <Field
                  label="Contact number"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="09XX XXX XXXX"
                  {...register("phone")}
                />
              </div>
            )}
            <Field
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@business.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Field
              label="Password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder="At least 8 characters"
              error={errors.password?.message}
              {...register("password")}
            />
            {mode === "signup" && (
              <div className="legal-consent">
                <CheckboxField
                  label={
                    <>
                      I have read and accept the{" "}
                      <AppLink to="/privacy" target="_blank">
                        Privacy Policy
                      </AppLink>
                      .
                    </>
                  }
                  {...register("acceptPrivacy")}
                />
                <CheckboxField
                  label={
                    <>
                      I agree to the{" "}
                      <AppLink to="/terms" target="_blank">
                        Terms and Conditions
                      </AppLink>
                      .
                    </>
                  }
                  {...register("acceptTerms")}
                />
              </div>
            )}
            {mode === "login" && (
              <div className="auth-login-options"><label><input type="checkbox" defaultChecked /> Remember this device</label><Button type="button" variant="ghost" className="forgot" onClick={resetPassword}>Forgot password?</Button></div>
            )}
            {message && (
              <div className="form-message" role="status">
                {message}
              </div>
            )}
            <Button type="submit" loading={busy}>
              {mode === "login" ? <>Sign in to POS Workspace <ArrowRight size={18}/></> : <>Create my account <ArrowRight size={18}/></>}
            </Button>
          </form>
          <p className="switch-mode">
            {mode === "login" ? "Don’t have a SmartPOS account yet?" : "Already have an account?"}
            <Button
              variant="ghost"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login")
                setMessage("")
              }}
            >
              {mode === "login" ? "Start 7-Day Free Trial" : "Sign in"}
            </Button>
          </p>
          <div className="auth-trust-row"><span><ShieldCheck size={14}/> Secure authentication</span><span><Cloud size={14}/> Cloud synced</span><span><WifiOff size={14}/> Offline ready</span></div>
        </div>
      </section>
    </main>
  )
}
