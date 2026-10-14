import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, Check, MapPin, Store } from "lucide-react"
import { useNavigate } from "react-router"
import { supabase } from "@/lib/supabase/client"
import { Button, Field, Logo, SelectField } from "@/components/ui"
import { useAuth } from "@/features/auth/AuthProvider"

const schema = z.object({
  businessName: z.string().min(2, "Enter your business name"),
  category: z.string().min(1),
  address: z.string().min(5, "Enter the business address"),
  contact: z.string().min(7, "Enter a valid contact number"),
  ownerName: z.string().min(2, "Enter the owner name"),
  branchName: z.string().min(2, "Enter a branch name"),
})
type Values = z.infer<typeof schema>

export default function OnboardingPage() {
  const [message, setMessage] = useState("")
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchName: "Main Branch",
      category: "sari_sari",
      businessName: user?.user_metadata.business_name ?? "",
      ownerName: user?.user_metadata.full_name ?? "",
      contact: user?.user_metadata.phone ?? "",
    },
  })

  async function submit(values: Values) {
    setMessage("")
    const { error } = await supabase.rpc("create_business_with_owner", {
      p_name: values.businessName,
      p_category: values.category,
      p_address: values.address,
      p_contact: values.contact,
      p_owner_name: values.ownerName,
      p_branch_name: values.branchName,
    })
    if (error) {
      setMessage(
        error.code === "PGRST202"
          ? "Database setup is pending. Apply the included Supabase migration, then try again."
          : error.message,
      )
      return
    }
    navigate("/app")
  }

  return (
    <main className="onboarding-page">
      <header className="simple-header">
        <Logo />
        <span>Step 1 of 3 · Business profile</span>
      </header>
      <section className="onboarding-shell">
        <aside className="onboarding-guide">
          <span className="eyebrow light">Welcome aboard</span>
          <h1>Let’s set up your store.</h1>
          <p>We’ll create your secure business workspace and first branch.</p>
          {[
            ["1", "Business details", "Tell us about your store"],
            ["2", "Tax & receipts", "Configure when you’re ready"],
            ["3", "Add products", "Start selling"],
          ].map(([number, title, copy], index) => (
            <div className={`step ${index === 0 ? "active" : ""}`} key={number}>
              <span>{index === 0 ? <Check size={16} /> : number}</span>
              <div>
                <b>{title}</b>
                <small>{copy}</small>
              </div>
            </div>
          ))}
        </aside>
        <form className="onboarding-form" onSubmit={handleSubmit(submit)}>
          <div className="section-heading">
            <Building2 />
            <div>
              <h2>Your business</h2>
              <p>These details appear in your workspace and receipts.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field
              label="Business name"
              placeholder="e.g. Aling Nena’s Store"
              error={errors.businessName?.message}
              {...register("businessName")}
            />
            <SelectField label="Business category" {...register("category")}>
              <option value="sari_sari">Sari-sari store</option>
              <option value="restaurant">Restaurant or carinderia</option>
              <option value="cafe">Café, bakery, or milk tea</option>
              <option value="grocery">Mini grocery or convenience</option>
              <option value="food_stall">Food stall or kiosk</option>
              <option value="other">Other retail business</option>
            </SelectField>
            <Field
              label="Owner name"
              placeholder="Full name"
              error={errors.ownerName?.message}
              {...register("ownerName")}
            />
            <Field
              label="Contact number"
              placeholder="09XX XXX XXXX"
              error={errors.contact?.message}
              {...register("contact")}
            />
          </div>
          <div className="section-heading compact">
            <MapPin />
            <div>
              <h2>First branch</h2>
              <p>
                Currency and timezone are securely preset for the Philippines.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field
              label="Branch name"
              error={errors.branchName?.message}
              {...register("branchName")}
            />
            <Field
              label="Business address"
              placeholder="Barangay, city, province"
              error={errors.address?.message}
              {...register("address")}
            />
          </div>
          <div className="locked-settings">
            <Store size={19} />
            <span>
              <b>Philippine defaults</b> Philippine Peso (PHP) · Asia/Manila ·
              Non-VAT until configured
            </span>
          </div>
          {message && (
            <div className="form-message" role="alert">
              {message}
            </div>
          )}
          <div className="form-actions">
            <span>You can update all settings later.</span>
            <Button type="submit" loading={isSubmitting}>
              Create business workspace
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
