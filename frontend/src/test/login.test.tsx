// src/test/login.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from './helpers'
import LoginPage from '@/app/[locale]/(auth)/login/page'

// ── Mock api ──────────────────────────────────────────────────────────────────
const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...args: any[]) => mockPost(...args) },
}))

// ── Mock auth store ───────────────────────────────────────────────────────────
const mockSetPendingEmail = vi.fn()
vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: any) =>
    selector({ setPendingEmail: mockSetPendingEmail }),
}))

// ── Mock router ───────────────────────────────────────────────────────────────
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ locale: 'en' }),
}))

// ─────────────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('renders email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/auth\.login\.email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.login\.password/i)).toBeInTheDocument()
  })

  it('renders the DocuMind brand name', () => {
    render(<LoginPage />)
    expect(screen.getByText('DocuMind')).toBeInTheDocument()
  })

  it('renders the submit button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /auth\.login\.submit/i })).toBeInTheDocument()
  })

  it('renders a link to the register page', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /auth\.login\.createOne/i })
    expect(link).toHaveAttribute('href', '/en/register')
  })

  it('renders the forgot password link', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /auth\.login\.forgotPassword/i })
    expect(link).toHaveAttribute('href', '/en/forgot-password')
  })

  // ── Password visibility toggle ──────────────────────────────────────────────

  it('password field starts as type="password"', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/auth\.login\.password/i)).toHaveAttribute('type', 'password')
  })

  it('toggles password visibility when the eye button is clicked', async () => {
    render(<LoginPage />)
    const passwordInput = screen.getByLabelText(/auth\.login\.password/i)
    const toggleBtn = screen.getByRole('button', { name: '' }) // the icon button has no text

    expect(passwordInput).toHaveAttribute('type', 'password')
    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  // ── No error banner initially ───────────────────────────────────────────────

  it('does not show an error banner on initial render', () => {
    render(<LoginPage />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // The error div has no role, check by text absence
    expect(screen.queryByText(/auth\.errors\./)).not.toBeInTheDocument()
  })

  // ── Successful submission ───────────────────────────────────────────────────

  it('calls api.post with email and motDePasse on submit', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/auth\.login\.email/i), 'user@test.com')
    await userEvent.type(screen.getByLabelText(/auth\.login\.password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /auth\.login\.submit/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'user@test.com',
        motDePasse: 'password123',
      })
    })
  })

  it('calls setPendingEmail and redirects to verify-otp on success', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/auth\.login\.email/i), 'user@test.com')
    await userEvent.type(screen.getByLabelText(/auth\.login\.password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /auth\.login\.submit/i }))

    await waitFor(() => {
      expect(mockSetPendingEmail).toHaveBeenCalledWith('user@test.com')
      expect(mockPush).toHaveBeenCalledWith('/en/verify-otp')
    })
  })

  // ── Loading state ───────────────────────────────────────────────────────────

  it('disables the submit button while loading', async () => {
    // Never resolve so we stay in loading state
    mockPost.mockReturnValueOnce(new Promise(() => {}))
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/auth\.login\.email/i), 'user@test.com')
    await userEvent.type(screen.getByLabelText(/auth\.login\.password/i), 'password123')

    const submitBtn = screen.getByRole('button', { name: /auth\.login\.submit/i })
    fireEvent.submit(submitBtn.closest('form')!)

    await waitFor(() => {
      expect(submitBtn).toBeDisabled()
    })
  })

  // ── Error states ────────────────────────────────────────────────────────────

  it('shows invalidCredentials error on 401', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/auth\.login\.email/i), 'bad@test.com')
    await userEvent.type(screen.getByLabelText(/auth\.login\.password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /auth\.login\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.invalidCredentials/i)).toBeInTheDocument()
    })
  })

  it('shows accountLocked error when response message includes "verrouillé"', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Compte verrouillé pour 10 minutes' } },
    })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/auth\.login\.email/i), 'locked@test.com')
    await userEvent.type(screen.getByLabelText(/auth\.login\.password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /auth\.login\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.accountLocked/i)).toBeInTheDocument()
    })
  })

  it('clears previous error when submitting again', async () => {
    // First attempt fails
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'bad' } },
    })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/auth\.login\.email/i), 'user@test.com')
    await userEvent.type(screen.getByLabelText(/auth\.login\.password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /auth\.login\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.invalidCredentials/i)).toBeInTheDocument()
    })

    // Second attempt succeeds
    mockPost.mockResolvedValueOnce({ data: {} })
    await userEvent.click(screen.getByRole('button', { name: /auth\.login\.submit/i }))

    await waitFor(() => {
      expect(screen.queryByText(/auth\.errors\./)).not.toBeInTheDocument()
    })
  })
})