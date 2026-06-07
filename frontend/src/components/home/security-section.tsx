// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\security-section.tsx

import { Lock, ShieldCheck, Users, Brain, Zap, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"

const icons = {
  isolation:   Lock,
  auth:        ShieldCheck,
  permissions: Users,
  scoped:      Brain,
  rateLimit:   Zap,
  audit:       FileText,
}

export async function SecuritySection({ locale }: { locale: string }) {
  const t = await getTranslations("home.security")

  const items = ["isolation", "auth", "permissions", "scoped", "rateLimit", "audit"] as const

  const trustItems = [
    t("trustItems.rbac"),
    t("trustItems.isolation"),
    t("trustItems.scoped"),
    t("trustItems.audit"),
  ]

  return (
    <section id="security" className="relative border-t border-border bg-muted/30 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-block rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {t("badge")}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Grid */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((key) => {
            const Icon = icons[key]
            return (
              <div
                key={key}
                className="flex gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/25 hover:shadow-md hover:shadow-primary/4"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t(`items.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t(`items.${key}.desc`)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Trust bar — fully translated */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-border bg-card px-8 py-5">
          {trustItems.map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}