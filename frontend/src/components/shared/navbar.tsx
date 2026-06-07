// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\shared\navbar.tsx
"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Brain, Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { LanguageSwitcher } from "@/components/shared/language-switcher"

export function Navbar({ locale }: { locale: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const t = useTranslations("nav")

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navLinks = [
    { href: "#features",     label: t("features") },
    { href: "#how-it-works", label: t("howItWorks") },
    { href: "#ai",           label: t("aiAssistant") },
    { href: "#security",     label: t("security") },
    { href: "#pricing",      label: t("pricing") },
  ]

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/70 bg-background/90 shadow-sm shadow-black/5 backdrop-blur-lg"
          : "border-b border-transparent bg-background/60 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="group flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm transition-shadow group-hover:shadow-md group-hover:shadow-primary/30">
            <Brain className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">DocuMind</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1.5 md:flex">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />
          <div className="mx-1.5 h-4 w-px bg-border" />
          <Button variant="ghost" size="sm" className="text-sm" asChild>
            <Link href={`/${locale}/login`}>{t("signIn")}</Link>
          </Button>
          <Button size="sm" className="rounded-lg px-4 text-sm font-semibold shadow-sm shadow-primary/20" asChild>
            <Link href={`/${locale}/register`}>{t("getStarted")}</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-border bg-background/95 backdrop-blur-lg md:hidden">
          <nav className="mx-auto max-w-7xl flex flex-col gap-1 px-4 py-4 sm:px-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="my-2 h-px bg-border" />

            {/* Controls row */}
            <div className="flex items-center gap-2 px-1 pb-1">
              <LanguageSwitcher locale={locale} />
              <ThemeToggle />
            </div>

            {/* Auth buttons */}
            <div className="flex gap-2 px-1 pb-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-lg" asChild>
                <Link href={`/${locale}/login`} onClick={() => setMobileOpen(false)}>
                  {t("signIn")}
                </Link>
              </Button>
              <Button size="sm" className="flex-1 rounded-lg font-semibold" asChild>
                <Link href={`/${locale}/register`} onClick={() => setMobileOpen(false)}>
                  {t("getStarted")}
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}