import { FolderTree, MessageSquare, Sparkles, Search, Users, Lock } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"

export async function FeaturesSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.features")

  const features = [
    { icon: FolderTree, key: "workspaces" },
    { icon: MessageSquare, key: "qa" },
    { icon: Sparkles, key: "summaries" },
    { icon: Search, key: "search" },
    { icon: Users, key: "roles" },
    { icon: Lock, key: "isolation" },
  ] as const

  return (
    <section id="features" className="border-t border-border bg-card py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <Badge variant="outline" className="mb-4 text-xs">{t("badge")}</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="group relative rounded-xl border border-border bg-secondary p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{t(`items.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(`items.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}