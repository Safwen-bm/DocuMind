import Link from "next/link"
import { ArrowRight, ChevronRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"

export async function CTASection({ locale }: { locale: string }) {
  const t = await getTranslations("home.cta")

  return (
    <section className="border-t border-border bg-primary py-20">
      <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/80">
          {t("subtitle")}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" variant="secondary" className="gap-2 px-8" asChild>
            <Link href={`/${locale}/register`}>
              {t("getStarted")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="gap-2 bg-accent border-primary-foreground/20 px-8 hover:bg-primary-foreground/10 hover:text-primary-foreground" asChild>
            <Link href={`/${locale}/dashboard`}>
              {t("viewDemo")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}