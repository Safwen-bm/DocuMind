// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\how-it-works-section.tsx

import { BookOpen, Zap, Brain, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

const stepIcons = {
  create:   BookOpen,
  index:    Zap,
  ask:      Brain,
  generate: Sparkles,
}

export async function HowItWorksSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.howItWorks")

  const steps = ["create", "index", "ask", "generate"] as const

  return (
    <section id="how-it-works" className="relative border-t border-border bg-muted/30 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-xl text-center">
          <span className="mb-4 inline-block rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {t("badge")}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
        </div>

        {/* Steps — horizontal on lg, vertical on mobile */}
        <div className="relative mt-16">
          {/* Connector line — desktop only */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] top-[28px] hidden h-px lg:block"
            style={{
              background:
                "repeating-linear-gradient(to right, var(--border) 0, var(--border) 6px, transparent 6px, transparent 14px)",
            }}
          />

          <div className="grid gap-10 lg:grid-cols-4">
            {steps.map((key, idx) => {
              const Icon = stepIcons[key]
              return (
                <div key={key} className="relative flex flex-col items-center text-center lg:items-center">
                  {/* Mobile connector line */}
                  {idx < steps.length - 1 && (
                    <div
                      aria-hidden
                      className="absolute left-[28px] top-[56px] h-[calc(100%+40px-56px)] w-px lg:hidden"
                      style={{
                        background:
                          "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 6px, transparent 6px, transparent 14px)",
                      }}
                    />
                  )}

                  {/* Icon ring */}
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                    <Icon className="h-6 w-6 text-primary" />
                    {/* Step number badge */}
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                  </div>

                  <h3 className="mt-5 text-base font-bold text-foreground">
                    {t(`steps.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`steps.${key}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}