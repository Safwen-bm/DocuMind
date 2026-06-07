// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\cta-section.tsx

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"

export async function CTASection({ locale }: { locale: string }) {
  const t = await getTranslations("home.cta")

  return (
    <section className="relative isolate overflow-hidden border-t border-border bg-background py-24 lg:py-32">
      {/* CTA card — full-width rounded panel */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
          style={{
            background:
              "linear-gradient(135deg, var(--primary) 0%, oklch(0.42 0.22 280) 100%)",
          }}
        >
          {/* Grid overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* Radial highlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", filter: "blur(60px)" }}
          />

          <div className="relative">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80">
              <Sparkles className="h-3 w-3" />
              Get started today
            </span>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {t("title")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
              {t("subtitle")}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-xl bg-white px-8 text-base font-bold text-primary shadow-lg shadow-black/20 hover:bg-white/90"
                asChild
              >
                <Link href={`/${locale}/register`}>
                  {t("getStarted")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 rounded-xl border border-white/20 px-8 text-base text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href={`#pricing`}>
                  {t("viewDemo")}
                </Link>
              </Button>
            </div>

            {/* Micro reassurance */}
            <p className="mt-6 text-xs text-white/50">
              No credit card required · Free plan forever · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}