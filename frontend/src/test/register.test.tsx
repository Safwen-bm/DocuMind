// src/test/register.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from './helpers'
import RegisterPage from '@/app/[locale]/(auth)/register/page'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...args: any[]) => mockPost(...args) },
}))

const mockSetPendingEmail = vi.fn()
vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: any) =>
    selector({ setPendingEmail: mockSetPendingEmail }),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ locale: 'en' }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fillForm({
  name = 'Alice Dupont',
  email = 'alice@test.com',
  password = 'password123',
  confirm = 'password123',
} = {}) {
  await userEvent.type(screen.getByLabelText(/auth\.register\.fullName/i), name)
  await userEvent.type(screen.getByLabelText(/auth\.register\.email/i), email)
  // password field — get by id to avoid label ambiguity with confirmPassword
  await userEvent.type(screen.getByLabelText(/^auth\.register\.password$/i), password)
  await userEvent.type(screen.getByLabelText(/auth\.register\.confirmPassword/i), confirm)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('renders all four fields', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(/auth\.register\.fullName/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.register\.email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^auth\.register\.password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.register\.confirmPassword/i)).toBeInTheDocument()
  })

  it('renders DocuMind branding', () => {
    render(<RegisterPage />)
    expect(screen.getByText('DocuMind')).toBeInTheDocument()
  })

  it('renders a link to the login page', () => {
    render(<RegisterPage />)
    const link = screen.getByRole('link', { name: /auth\.register\.signIn/i })
    expect(link).toHaveAttribute('href', '/en/login')
  })

  it('does not show an error banner initially', () => {
    render(<RegisterPage />)
    expect(screen.queryByText(/auth\.errors\./)).not.toBeInTheDocument()
  })

  // ── Client-side validation ──────────────────────────────────────────────────

  it('shows passwordMismatch error when passwords do not match', async () => {
    render(<RegisterPage />)
    await fillForm({ password: 'password123', confirm: 'different456' })
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.passwordMismatch/i)).toBeInTheDocument()
    })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows passwordLength error when password is under 8 characters', async () => {
    render(<RegisterPage />)
    await fillForm({ password: 'short', confirm: 'short' })
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.passwordLength/i)).toBeInTheDocument()
    })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('does not call api when validation fails', async () => {
    render(<RegisterPage />)
    await fillForm({ password: 'abc', confirm: 'xyz' })
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\./)).toBeInTheDocument()
    })
    expect(mockPost).not.toHaveBeenCalled()
  })

  // ── Successful submission ───────────────────────────────────────────────────

  it('calls api.post with correct payload on valid submit', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    render(<RegisterPage />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        nom: 'Alice Dupont',
        email: 'alice@test.com',
        motDePasse: 'password123',
      })
    })
  })

  it('calls setPendingEmail and redirects to confirm-email on success', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    render(<RegisterPage />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(mockSetPendingEmail).toHaveBeenCalledWith('alice@test.com')
      expect(mockPush).toHaveBeenCalledWith('/en/confirm-email')
    })
  })

  // ── Password toggle ─────────────────────────────────────────────────────────

  it('toggles password field visibility', async () => {
    render(<RegisterPage />)
    const passwordInput = screen.getByLabelText(/^auth\.register\.password$/i)
    // There's exactly one toggle button (only password has the eye, not confirmPassword)
    const toggleBtn = screen.getByRole('button', { name: '' })

    expect(passwordInput).toHaveAttribute('type', 'password')
    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  // ── API error states ────────────────────────────────────────────────────────

  it('shows emailExists error when server response includes "déjà"', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Email déjà utilisé' } },
    })
    render(<RegisterPage />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.emailExists/i)).toBeInTheDocument()
    })
  })

  it('shows fillAll error for generic server errors', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Internal server error' } },
    })
    render(<RegisterPage />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /auth\.register\.submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/auth\.errors\.fillAll/i)).toBeInTheDocument()
    })
  })

  // ── Loading state ───────────────────────────────────────────────────────────

  it('disables submit button while request is in flight', async () => {
    mockPost.mockReturnValueOnce(new Promise(() => {}))
    render(<RegisterPage />)
    await fillForm()

    const submitBtn = screen.getByRole('button', { name: /auth\.register\.submit/i })
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(submitBtn).toBeDisabled()
    })
  })
})