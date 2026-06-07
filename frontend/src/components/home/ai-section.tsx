// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\home\ai-section.tsx

import { Brain, Sparkles, FileText, Zap, MessageSquare, Star } from "lucide-react"
import { getTranslations } from "next-intl/server"

const featureIcons = {
  qa:        MessageSquare,
  summaries: Sparkles,
  simplify:  Zap,
  generate:  Star,
}

export async function AISection({ locale }: { locale: string }) {
  const t = await getTranslations("home.ai")

  const features = ["qa", "summaries", "simplify", "generate"] as const

  return (
    <section id="ai" className="relative border-t border-border bg-background py-24 lg:py-32">
      {/* Right-side glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full"
        style={{ background: "var(--primary)", opacity: 0.04, filter: "blur(80px)" }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left: Text */}
          <div>
            <span className="mb-4 inline-block rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              {t("badge")}
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
              {t("subtitle")}
            </p>

            <div className="mt-10 space-y-5">
              {features.map((key) => {
                const Icon = featureIcons[key]
                return (
                  <div key={key} className="group flex gap-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {t(`features.${key}.title`)}
                      </h4>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {t(`features.${key}.desc`)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Chat demo */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5">
            {/* Panel header */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{t("panelTitle")}</p>
                <p className="text-[10px] text-muted-foreground">{t("panelWorkspace")}</p>
              </div>
              <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                RAG Mode
              </span>
            </div>

            {/* Messages */}
            <div className="space-y-4 p-5">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {t("chatDemo.question")}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 rounded-2xl rounded-tl-sm border border-border bg-background p-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    {t("chatDemo.answer")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[t("chatDemo.source1"), t("chatDemo.source2")].map((src) => (
                      <span key={src} className="flex items-center gap-1.5 rounded-lg bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
                        <FileText className="h-3 w-3" />
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick actions — translated */}
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  t("quickActions.summarize"),
                  t("quickActions.simplify"),
                  t("quickActions.keyDecisions"),
                ].map((action) => (
                  <button
                    key={action}
                    className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Input area — translated */}
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2.5">
                <span className="flex-1 text-sm text-muted-foreground/50">
                  {t("chatInputPlaceholder")}
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}