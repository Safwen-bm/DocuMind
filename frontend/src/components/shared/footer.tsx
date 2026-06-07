// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\shared\footer.tsx

import Link from "next/link"
import { Brain, Github, Linkedin } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations("home.footer")
  const tNav = await getTranslations("nav")

  const productLinks = [
    { href: "#features",     label: tNav("features") },
    { href: "#how-it-works", label: tNav("howItWorks") },
    { href: "#ai",           label: tNav("aiAssistant") },
    { href: "#security",     label: tNav("security") },
    { href: "#pricing",      label: tNav("pricing") },
  ]

  const accountLinks = [
    { href: `/${locale}/login`,    label: tNav("signIn") },
    { href: `/${locale}/register`, label: tNav("getStarted") },
    { href: `/${locale}/pricing`,  label: tNav("pricing") },
  ]

  return (
    <footer className="relative border-t border-border bg-background">

      {/* Gradient accent line at top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(to right, transparent, var(--primary), transparent)",
          opacity: 0.35,
        }}
      />

      {/* Main grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:py-20">

          {/* Brand — 5 cols */}
          <div className="sm:col-span-2 lg:col-span-5 lg:pr-8">

            {/* Logo */}
            <Link href={`/${locale}`} className="group mb-6 inline-flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30 transition-shadow group-hover:shadow-lg group-hover:shadow-primary/40">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-extrabold tracking-tight">DocuMind</span>
            </Link>

            {/* Tagline */}
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("description")}
            </p>

            {/* Social icons */}
            <div className="mt-7 flex items-center gap-2.5">
              {[
                {
                  href: "https://github.com/Safwen-bm",
                  label: "GitHub",
                  Icon: Github,
                },
                {
                  href: "https://www.linkedin.com/in/safwen-ben-mabrouk-494721362",
                  label: "LinkedIn",
                  Icon: Linkedin,
                },
              ].map(({ href, label, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition-all duration-200 hover:scale-105 hover:border-primary/40 hover:bg-primary/8 hover:text-primary hover:shadow-sm hover:shadow-primary/15"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>

            {/* Built with note */}
            <p className="mt-7 text-[11px] text-muted-foreground/50">
              {t("builtWith")}
            </p>
          </div>

          {/* Spacer */}
          <div className="hidden lg:col-span-1 lg:block" />

          {/* Product links — 3 cols */}
          <div className="lg:col-span-3">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-foreground/70">
              {t("product")}
            </p>
            <ul className="space-y-3.5">
              {productLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group/link flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    <span
                      aria-hidden
                      className="h-px w-0 rounded-full bg-primary transition-all duration-200 group-hover/link:w-3"
                    />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account links — 3 cols */}
          <div className="lg:col-span-3">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-foreground/70">
              {t("account")}
            </p>
            <ul className="space-y-3.5">
              {accountLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group/link flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    <span
                      aria-hidden
                      className="h-px w-0 rounded-full bg-primary transition-all duration-200 group-hover/link:w-3"
                    />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} DocuMind. {t("copyright")}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/login`}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("signIn")}
            </Link>
            <span aria-hidden className="h-3 w-px bg-border" />
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-opacity hover:opacity-75"
            >
              {tNav("getStarted")} →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}