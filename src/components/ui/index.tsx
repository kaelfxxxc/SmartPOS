import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react"
import { Link, type LinkProps } from "react-router"
import { LoaderCircle } from "lucide-react"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark"
  loading?: boolean
}

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoaderCircle size={18} className="animate-spin" aria-hidden />
      )}
      {children}
    </button>
  )
}

export function AppLink({
  variant,
  className = "",
  ...props
}: LinkProps & { variant?: "primary" | "secondary" | "ghost" | "dark" }) {
  return (
    <Link
      className={variant ? `btn btn-${variant} ${className}` : className}
      {...props}
    />
  )
}

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" {...props} />
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" {...props}>
        {children}
      </select>
    </label>
  )
}

export function CheckboxField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode
  error?: string
}) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" {...props} />
      <span>{label}</span>
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <AppLink
      to="/"
      className={`logo ${light ? "logo-light" : ""}`}
      aria-label="SmartPOS — Your AI-native POS"
    >
      <img
        src="/brand/smartpos-logo.png"
        alt="SmartPOS — Your AI-native POS"
      />
    </AppLink>
  )
}
