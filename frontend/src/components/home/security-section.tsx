import { Lock, ShieldCheck, Users, Brain, Zap, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"

export async function SecuritySection({ locale }: { locale: string }) {
  const t = await getTranslations("home.security")

  const items = [
    { icon: Lock, key: "isolation" },
    { icon: ShieldCheck, key: "auth" },
    { icon: Users, key: "permissions" },
    { icon: Brain, key: "scoped" },
    { icon: Zap, key: "rateLimit" },
    { icon: FileText, key: "audit" },
  ] as const

  return (
    <section id="security" className="bg-secondary py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <Badge variant="outline" className="mb-4 text-xs">{t("badge")}</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-xl border border-border bg-card p-6">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-1 text-sm font-semibold">{t(`items.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`items.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}