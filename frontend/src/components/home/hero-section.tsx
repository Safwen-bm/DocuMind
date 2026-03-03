import Link from "next/link"
import { ArrowRight, ChevronRight, Sparkles, Brain, FolderTree, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export async function HeroSection({ locale }: { locale: string }) {
  const t = await getTranslations("home.hero")

  return (
    <section className="relative overflow-hidden pb-20 pt-16 lg:pb-32 lg:pt-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 text-center lg:px-8">
        <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          {t("badge")}
        </Badge>

        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {t("title")}{" "}
          <span className="text-primary">{t("titleHighlight")}</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground lg:text-xl">
          {t("subtitle")}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="gap-2 px-8" asChild>
            <Link href={`/${locale}/register`}>
              {t("startFree")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="gap-2 px-8" asChild>
            <Link href={`/${locale}/dashboard`}>
              {t("viewDemo")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* App preview */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/5">
            <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/50 px-4">
              <div className="h-3 w-3 rounded-full bg-red-400/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
              <div className="h-3 w-3 rounded-full bg-green-400/60" />
              <span className="ml-4 text-xs text-muted-foreground">DocuMind — Engineering Team</span>
            </div>
            <div className="flex h-[420px] lg:h-[480px]">
              <div className="hidden w-60 border-r border-border bg-muted/30 p-4 lg:block">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <FolderTree className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Documents</span>
                </div>
                {["Architecture", "Onboarding", "Guidelines", "Meeting Notes", "Projects"].map((name, i) => (
                  <div key={name} className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${i === 0 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
                    <FolderTree className="h-3.5 w-3.5" />
                    {name}
                  </div>
                ))}
              </div>
              <div className="flex-1 p-6">
                <h2 className="mb-4 text-xl font-bold">System Architecture Overview</h2>
                <div className="space-y-3">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-4/5 rounded bg-muted" />
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="mt-6 h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-5/6 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
              <div className="hidden w-72 border-l border-border bg-muted/20 p-4 xl:block">
                <div className="mb-4 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">AI Assistant</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">How does authentication work?</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3">
                    <p className="text-xs">Based on the documentation, the system uses JWT tokens...</p>
                    <div className="mt-2 flex items-center gap-1">
                      <FileText className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-primary">2 sources</span>
                    </div>
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