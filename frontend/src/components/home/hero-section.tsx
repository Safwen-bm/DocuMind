// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\hero-section.tsx

import Link from "next/link"
import { ArrowRight, Brain, FolderTree, FileText, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"

export async function HeroSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.hero")

  return (
    <section className="relative isolate overflow-hidden pt-20 pb-24 lg:pt-32 lg:pb-36">
      {/* Grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          opacity: 0.35,
        }}
      />
      {/* Radial fade over grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, var(--background) 100%)",
        }}
      />
      {/* Top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full"
        style={{ background: "var(--primary)", opacity: 0.06, filter: "blur(80px)" }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow pill */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-primary" />
            {t("badge")}
          </span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto mt-7 max-w-4xl text-center text-[2.6rem] font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-6xl lg:text-[4.5rem]">
          {t("title")}{" "}
          <span
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, oklch(0.55 0.2 280) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("titleHighlight")}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground lg:text-xl">
          {t("subtitle")}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 gap-2 rounded-xl px-8 text-base font-semibold shadow-md shadow-primary/20" asChild>
            <Link href={`/${locale}/register`}>
              {t("startFree")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 gap-2 rounded-xl border-border px-8 text-base" asChild>
            <Link href="#pricing">
              {t("viewDemo")}
            </Link>
          </Button>
        </div>

        {/* Trust strip — translated */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
          {[
            t("trustNoCreditCard"),
            t("trustFreePlan"),
            t("trustSetup"),
          ].map((label) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
              {label}
            </span>
          ))}
        </div>

        {/* App mockup */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 h-40 w-3/4 -translate-x-1/2 rounded-full"
            style={{ background: "var(--primary)", opacity: 0.08, filter: "blur(40px)" }}
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-border/40">
            {/* Window bar */}
            <div className="flex h-11 items-center gap-2 border-b border-border bg-muted/40 px-5">
              <div className="h-3 w-3 rounded-full" style={{ background: "#fc605b" }} />
              <div className="h-3 w-3 rounded-full" style={{ background: "#fdbc40" }} />
              <div className="h-3 w-3 rounded-full" style={{ background: "#34c84a" }} />
              <div className="mx-auto flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                {/* URL bar — UI chrome, intentionally not translated */}
                <span className="text-[11px] text-muted-foreground">documind.app/engineering</span>
              </div>
            </div>

            <div className="flex" style={{ height: 440 }}>
              {/* Sidebar — UI chrome mockup, sidebar items are fake demo data */}
              <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-muted/20 p-4 lg:flex">
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FolderTree className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Workspace</span>
                </div>
                {["Architecture", "Onboarding", "Guidelines", "API Docs", "Meeting Notes"].map((name, i) => (
                  <div
                    key={name}
                    className={`mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      i === 0 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {name}
                  </div>
                ))}
                <div className="mt-auto rounded-lg border border-dashed border-border/60 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    <span className="block font-semibold text-foreground">12 / 50</span>
                    docs this month
                  </p>
                </div>
              </aside>

              {/* Document area */}
              <main className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center gap-0 border-b border-border bg-muted/10 px-4">
                  {["Overview", "API", "Diagrams"].map((tab, i) => (
                    <div
                      key={tab}
                      className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                        i === 0 ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                      }`}
                    >
                      {tab}
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-hidden p-6">
                  <h2 className="mb-1 text-lg font-bold">System Architecture Overview</h2>
                  <p className="mb-5 text-xs text-muted-foreground">Last edited 2 hours ago · 4 contributors</p>
                  <div className="space-y-2.5">
                    {[100, 85, 70, 90, 60].map((w, i) => (
                      <div key={i} className="h-2.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
                    ))}
                    <div className="mt-6 flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-primary/15" />
                      <div className="h-2.5 w-36 rounded-full bg-muted" />
                    </div>
                    {[75, 55, 80].map((w, i) => (
                      <div key={i} className="h-2.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
              </main>

              {/* AI Chat panel */}
              <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-muted/10 xl:flex">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold">{t("mockupAiTitle")}</span>
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    RAG
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-xs text-primary-foreground">
                      {t("mockupQuestion")}
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <Brain className="h-3 w-3 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-3.5 py-2.5 text-xs">
                      <p className="leading-relaxed text-foreground">
                        {t("mockupAnswer")}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {[t("mockupSource1"), t("mockupSource2")].map((src) => (
                          <span key={src} className="flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <FileText className="h-2.5 w-2.5" />
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-1 px-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    ))}
                    <span className="ml-1 text-[10px] text-muted-foreground">{t("mockupAiThinking")}</span>
                  </div>
                </div>
                <div className="border-t border-border p-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <span className="flex-1 text-xs text-muted-foreground/50">{t("mockupAskPlaceholder")}</span>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary">
                      <ArrowRight className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        {/* Stat strip — translated */}
        <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { value: "10×", label: t("statSpeed") },
            { value: "RAG", label: t("statRag") },
            { value: "∞",   label: t("statWorkspaces") },
          ].map(({ value, label }) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">{value}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}