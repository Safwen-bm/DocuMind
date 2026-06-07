// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\features-section.tsx

import { FolderTree, MessageSquare, Sparkles, Search, Users, Lock } from "lucide-react"
import { getTranslations } from "next-intl/server"

const icons = {
  workspaces: FolderTree,
  qa: MessageSquare,
  summaries: Sparkles,
  search: Search,
  roles: Users,
  isolation: Lock,
}

const accentClasses: Record<string, string> = {
  workspaces: "bg-blue-500/10 text-blue-500",
  qa:         "bg-violet-500/10 text-violet-500",
  summaries:  "bg-amber-500/10 text-amber-600",
  search:     "bg-emerald-500/10 text-emerald-500",
  roles:      "bg-pink-500/10 text-pink-500",
  isolation:  "bg-slate-500/10 text-slate-500",
}

export async function FeaturesSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.features")

  const features = ["workspaces", "qa", "summaries", "search", "roles", "isolation"] as const

  return (
    <section id="features" className="relative border-t border-border bg-background py-24 lg:py-32">
      {/* Background texture dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(var(--foreground) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-block rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {t("badge")}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
            {t("subtitle")}
          </p>
        </div>

        {/* Feature grid — 3 col desktop, 2 tablet, 1 mobile */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((key, idx) => {
            const Icon = icons[key]
            const isLarge = idx === 0
            return (
              <div
                key={key}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 ${
                  isLarge ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                {/* Top-right decoration */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full transition-opacity duration-300 group-hover:opacity-60"
                  style={{ background: "var(--primary)", opacity: 0.03, filter: "blur(24px)" }}
                />

                {/* Icon */}
                <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accentClasses[key]}`}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <h3 className="mb-2 text-base font-bold text-foreground">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`items.${key}.desc`)}
                </p>

                {/* Hover bottom accent line */}
                <div
                  aria-hidden
                  className="absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-primary transition-all duration-300 group-hover:w-full"
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}