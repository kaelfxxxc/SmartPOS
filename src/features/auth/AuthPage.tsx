import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Check, Store } from "lucide-react"
import { useNavigate } from "react-router"
import { supabase } from "@/lib/supabase/client"
import {
  AppLink,
  Button,
  CheckboxField,
  Field,
  Logo,
} from "@/components/ui"

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
    navigate("/onboarding")
  }

  async function socialLogin(provider: "google" | "facebook") {
    setBusy(true)
    setMessage("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/onboarding` },
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
        <Logo light />
        <div className="auth-promise">
          <span className="eyebrow light">Built for Filipino businesses</span>
          <h1>Simple enough for today. Powerful enough for what’s next.</h1>
          <p>
            Run sales, inventory, and customer credit from one secure workspace.
          </p>
          {[
            "Secure business-isolated records",
            "Works with cash, GCash, Maya, and utang",
            "Designed for fast, accessible checkout",
          ].map((item) => (
            <div className="auth-check" key={item}>
              <Check size={18} />
              {item}
            </div>
          ))}
        </div>
        <span className="security-note">
          <Store size={18} /> Trusted by many food establishments in the
          Philippines
        </span>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <AppLink to="/" className="back-link">
            <ArrowLeft size={17} /> Back
          </AppLink>
          <span className="eyebrow">Welcome to SmartPOS</span>
          <h2>
            {mode === "login"
              ? "Sign in to your business"
              : "Start your free trial"}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Enter your details to continue."
              : "No card required. Set up your first branch in minutes."}
          </p>
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
            <span>or use email</span>
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
              <Button
                type="button"
                variant="ghost"
                className="forgot"
                onClick={resetPassword}
              >
                Forgot password?
              </Button>
            )}
            {message && (
              <div className="form-message" role="status">
                {message}
              </div>
            )}
            <Button type="submit" loading={busy}>
              {mode === "login" ? "Sign in securely" : "Create my account"}
            </Button>
          </form>
          <p className="switch-mode">
            {mode === "login" ? "New to SmartPOS?" : "Already have an account?"}
            <Button
              variant="ghost"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login")
                setMessage("")
              }}
            >
              {mode === "login" ? "Start free" : "Sign in"}
            </Button>
          </p>
        </div>
      </section>
    </main>
  )
}
