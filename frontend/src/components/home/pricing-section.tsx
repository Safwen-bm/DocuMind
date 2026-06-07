// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\pricing-section.tsx

import Link from "next/link"
import { Check, FolderOpen, Zap, Sparkles, ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const plans = [
  {
    key:        "free",
    icon:       FolderOpen,
    iconBg:     "bg-muted",
    iconColor:  "text-muted-foreground",
    cardBorder: "border-border",
    checkColor: "text-primary",
    highlight:  false,
  },
  {
    key:        "pro",
    icon:       Zap,
    iconBg:     "bg-violet-500/10",
    iconColor:  "text-violet-500",
    cardBorder: "border-violet-500/40",
    checkColor: "text-violet-500",
    highlight:  true,
  },
  {
    key:        "enterprise",
    icon:       Sparkles,
    iconBg:     "bg-amber-500/10",
    iconColor:  "text-amber-500",
    cardBorder: "border-amber-500/40",
    checkColor: "text-amber-500",
    highlight:  false,
  },
] as const

export async function PricingSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.pricing")
  const tPlan = await getTranslations("dashboard.plans.pricing")

  return (
    <section
      id="pricing"
      className="relative border-t border-border bg-background py-24 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(var(--foreground) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-block rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {t("badge")}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {tPlan("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
            {tPlan("subtitle")}
          </p>
        </div>

        {/* Plans */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map(({ key, icon: Icon, iconBg, iconColor, cardBorder, checkColor, highlight }) => {
            const features = tPlan.raw(`${key}.features`) as string[]
            const isFree = key === "free"

            return (
              <div
                key={key}
                className={cn(
                  "relative flex flex-col rounded-2xl border-2 bg-card p-7 transition-all duration-200",
                  cardBorder,
                  highlight && "shadow-xl shadow-violet-500/10 scale-[1.02]"
                )}
              >
                {highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-violet-600 px-3.5 py-1 text-[11px] font-bold text-white shadow-sm shadow-violet-500/30">
                      {t("mostPopular")}
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <div className={cn("mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl", iconBg)}>
                    <Icon className={cn("h-5 w-5", iconColor)} />
                  </div>
                  <h3 className="text-lg font-extrabold text-foreground">
                    {tPlan(`${key}.name`)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tPlan(`${key}.desc`)}
                  </p>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tight text-foreground">
                    {tPlan(`${key}.price`)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tPlan(`${key}.period`)}
                  </span>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", checkColor)} />
                      <span className="text-foreground/85">{f}</span>
                    </li>
                  ))}
                </ul>

                {isFree ? (
                  <Button variant="outline" className="w-full rounded-xl" asChild>
                    <Link href={`/${locale}/register`}>
                      {tPlan(`${key}.cta`)}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className={cn(
                      "w-full rounded-xl font-semibold gap-2",
                      key === "pro"
                        ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25"
                        : "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25"
                    )}
                    asChild
                  >
                    <Link href={`/${locale}/pricing`}>
                      {tPlan(`${key}.cta`)}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          {tPlan("stripeNote")}
        </p>

        <div className="mt-5 text-center">
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("seeFullComparison")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}