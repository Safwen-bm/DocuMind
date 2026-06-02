// src/test/helpers.tsx
import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { vi } from 'vitest'

// ── QueryClient wrapper ───────────────────────────────────────────────────────
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>          {/* ← wrap here */}
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  )
}

// Drop-in replacement for RTL render — adds all providers automatically
function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { renderWithProviders as render }

// ── Common mock factories ─────────────────────────────────────────────────────

export function makeDocument(overrides = {}) {
  return {
    id: 'doc-1',
    titre: 'My Document',
    contenu: null,
    workspaceId: 'ws-1',
    dossierId: null,
    authorId: 'user-1',
    isFavori: false,
    estArchive: false,
    estIndexe: false,
    tags: [],
    dateCreation: new Date().toISOString(),
    dateMiseAJour: new Date().toISOString(),
    author: { id: 'user-1', nom: 'Alice Dupont', avatarUrl: null },
    dossier: null,
    views: [],
    ...overrides,
  }
}

export function makeUsage(overrides = {}) {
  return {
    plan: 'FREE' as const,
    ownedWorkspaces: 1,
    members:   { current: 2,  limit: 5,   isUnlimited: false },
    documents: { current: 8,  limit: 10,  isUnlimited: false },
    aiToday:   { current: 5,  limit: 20,  isUnlimited: false },
    ...overrides,
  }
}