import { Brain, Sparkles, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"

export async function AISection({ locale }: { locale: string }) {
  const t = await getTranslations("home.ai")

  const features = ["qa", "summaries", "simplify", "generate"] as const

  return (
    <section id="ai" className="border-t border-border bg-card py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Badge variant="outline" className="mb-4 text-xs">{t("badge")}</Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{t("subtitle")}</p>

            <div className="mt-8 space-y-4">
              {features.map((key) => (
                <div key={key} className="flex gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">{t(`features.${key}.title`)}</h4>
                    <p className="text-sm text-muted-foreground">{t(`features.${key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary p-6 shadow-lg shadow-primary/5">
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-semibold">AI Assistant</span>
              <Badge variant="secondary" className="bg-primary/5 ml-auto text-[10px]">RAG Mode</Badge>
            </div>
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground max-w-[80%]">
                  {t("chatDemo.question")}
                </div>
              </div>
              <div className="rounded-lg bg-primary/5 p-4 ">
                <p className="text-sm leading-relaxed">{t("chatDemo.answer")}</p>
                <div className="mt-3 flex gap-2">
                  <div className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1">
                    <FileText className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">{t("chatDemo.source1")}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1">
                    <FileText className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">{t("chatDemo.source2")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}