// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\page.tsx

import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { HeroSection } from '@/components/home/hero-section'
import { FeaturesSection } from '@/components/home/features-section'
import { HowItWorksSection } from '@/components/home/how-it-works-section'
import { AISection } from '@/components/home/ai-section'
import { SecuritySection } from '@/components/home/security-section'
import { PricingSection } from '@/components/home/pricing-section'
import { CTASection } from '@/components/home/cta-section'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return (
    <div className="min-h-screen bg-background">
      <Navbar locale={locale} />
      <main>
        <HeroSection locale={locale} />
        <FeaturesSection locale={locale} />
        <HowItWorksSection locale={locale} />
        <AISection locale={locale} />
        <SecuritySection locale={locale} />
        <PricingSection locale={locale} />
        <CTASection locale={locale} />
      </main>
      <Footer locale={locale} />
    </div>
  )
}