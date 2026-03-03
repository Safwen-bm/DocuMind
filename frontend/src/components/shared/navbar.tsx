"use client"

import Link from "next/link"
import { useState } from "react"
import { Brain, Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { LanguageSwitcher } from "@/components/shared/language-switcher"

export function Navbar({ locale }: { locale: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = useTranslations("nav")

  const navLinks = [
    { href: "#features", label: t("features") },
    { href: "#how-it-works", label: t("howItWorks") },
    { href: "#ai", label: t("aiAssistant") },
    { href: "#security", label: t("security") },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">DocuMind</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/login`}>{t("signIn")}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/${locale}/register`}>{t("getStarted")}</Link>
          </Button>
        </div>

        <button
          className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <LanguageSwitcher locale={locale} />
              <ThemeToggle />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link href={`/${locale}/login`}>{t("signIn")}</Link>
              </Button>
              <Button size="sm" asChild className="flex-1">
                <Link href={`/${locale}/register`}>{t("getStarted")}</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}