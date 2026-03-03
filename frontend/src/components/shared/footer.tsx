import Link from "next/link"
import { Brain } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations("home.footer")
  const tNav = await getTranslations("nav")

  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">DocuMind</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href={`/${locale}/login`} className="text-sm text-muted-foreground hover:text-foreground">
              {tNav("signIn")}
            </Link>
            <Link href={`/${locale}/register`} className="text-sm text-muted-foreground hover:text-foreground">
              {tNav("getStarted")}
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">{t("builtWith")}</p>
        </div>
      </div>
    </footer>
  )
}