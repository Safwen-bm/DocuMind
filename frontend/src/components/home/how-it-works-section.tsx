import { BookOpen, Zap, Brain, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"

export async function HowItWorksSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.howItWorks")

  const steps = [
    { icon: BookOpen, key: "create" },
    { icon: Zap, key: "index" },
    { icon: Brain, key: "ask" },
    { icon: Sparkles, key: "generate" },
  ] as const

  return (
    <section id="how-it-works" className="bg-secondary py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <Badge variant="outline" className="mb-4 text-xs">{t("badge")}</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, key }) => (
            <div key={key} className="relative text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
                {t(`steps.${key}.number`)}
              </span>
              <h3 className="mb-2 text-lg font-semibold">{t(`steps.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(`steps.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}