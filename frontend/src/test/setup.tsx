import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// ── ResizeObserver polyfill (jsdom doesn't include it) ────────────────────────
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

process.on('unhandledRejection', () => {})

// Clean up after every test so state never leaks between tests
afterEach(() => {
  cleanup()
})

// ── next/navigation ────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ locale: 'en', workspaceId: 'ws-1' }),
  usePathname: () => '/en/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// ── next/link ─────────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// ── next-intl ─────────────────────────────────────────────────────────────────
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, any>) => {
      let result = namespace ? `${namespace}.${key}` : key
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v))
        })
      }
      return result
    }
    t.raw = (key: string) => {
      const defaults: Record<string, string[]> = {
        'pro.features': ['3 workspaces', '50 documents', '100 AI/day'],
        'enterprise.features': ['Unlimited workspaces', 'Unlimited documents', 'Unlimited AI'],
      }
      return defaults[key] ?? []
    }
    return t
  },
  useLocale: () => 'en',
}))

// ── sonner (toast) ────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}))