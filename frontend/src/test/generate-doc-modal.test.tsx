import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from './helpers'
import { GenerateDocModal } from '@/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/_components/GenerateDocModal'
import { aiApi } from '@/lib/ai.api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ locale: 'en', workspaceId: 'ws-1' }),
  usePathname: () => '/en/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/ai.api', () => ({
  aiApi: { generateDocument: vi.fn() },
}))

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  workspaceId: 'ws-1',
}

describe('GenerateDocModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when open is false', () => {
    render(<GenerateDocModal {...defaultProps} open={false} />)
    expect(screen.queryByText('dashboard.generate.title')).toBeNull()
  })

  it('renders the modal when open is true', () => {
    render(<GenerateDocModal {...defaultProps} />)
    expect(screen.getByText('dashboard.generate.title')).toBeInTheDocument()
    expect(screen.getByText('dashboard.generate.subtitle')).toBeInTheDocument()
  })

  it('renders titre and description inputs', () => {
    render(<GenerateDocModal {...defaultProps} />)
    expect(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
    ).toBeInTheDocument()
  })

  it('generate button is disabled when both fields are empty', () => {
    render(<GenerateDocModal {...defaultProps} />)
    const btn = screen.getByText('dashboard.generate.submit').closest('button')!
    expect(btn).toBeDisabled()
  })

  it('generate button is disabled when only titre is filled', () => {
    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    expect(screen.getByText('dashboard.generate.submit').closest('button')!).toBeDisabled()
  })

  it('generate button is disabled when only description is filled', () => {
    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    expect(screen.getByText('dashboard.generate.submit').closest('button')!).toBeDisabled()
  })

  it('generate button is enabled when both fields are filled', () => {
    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    expect(
      screen.getByText('dashboard.generate.submit').closest('button')!,
    ).not.toBeDisabled()
  })

  it('prefillDescription populates description field', () => {
    render(<GenerateDocModal {...defaultProps} prefillDescription="Write a tech spec" />)
    const textarea = screen.getByPlaceholderText(
      'dashboard.generate.descPlaceholder',
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('Write a tech spec')
  })

  it('updates description when prefillDescription prop changes', async () => {
    const { rerender } = render(<GenerateDocModal {...defaultProps} prefillDescription="" />)
    rerender(<GenerateDocModal {...defaultProps} prefillDescription="New prefill content" />)

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        'dashboard.generate.descPlaceholder',
      ) as HTMLTextAreaElement
      expect(textarea.value).toBe('New prefill content')
    })
  })

  it('shows 4 example suggestion buttons', () => {
    render(<GenerateDocModal {...defaultProps} />)
    expect(screen.getByText('dashboard.generate.example1')).toBeInTheDocument()
    expect(screen.getByText('dashboard.generate.example2')).toBeInTheDocument()
    expect(screen.getByText('dashboard.generate.example3')).toBeInTheDocument()
    expect(screen.getByText('dashboard.generate.example4')).toBeInTheDocument()
  })

  it('clicking an example fills the description field', () => {
    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.click(screen.getByText('dashboard.generate.example1'))
    const textarea = screen.getByPlaceholderText(
      'dashboard.generate.descPlaceholder',
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('dashboard.generate.example1')
  })

  it('calls aiApi.generateDocument with correct args', async () => {
    vi.mocked(aiApi.generateDocument).mockResolvedValue({ documentId: 'doc-gen-1' } as any)

    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    fireEvent.click(screen.getByText('dashboard.generate.submit').closest('button')!)

    await waitFor(() => {
      expect(aiApi.generateDocument).toHaveBeenCalledWith(
        'ws-1', 'My Doc', 'Some description', undefined,
      )
    })
  })

  it('passes dossierId to generateDocument when provided', async () => {
    vi.mocked(aiApi.generateDocument).mockResolvedValue({ documentId: 'doc-gen-1' } as any)

    render(<GenerateDocModal {...defaultProps} dossierId="folder-99" />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    fireEvent.click(screen.getByText('dashboard.generate.submit').closest('button')!)

    await waitFor(() => {
      expect(aiApi.generateDocument).toHaveBeenCalledWith(
        'ws-1', 'My Doc', 'Some description', 'folder-99',
      )
    })
  })

  it('shows generating state while API call is in flight', async () => {
    vi.mocked(aiApi.generateDocument).mockImplementation(() => new Promise(() => {}))

    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    fireEvent.click(screen.getByText('dashboard.generate.submit').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('dashboard.generate.generating')).toBeInTheDocument()
    })
  })

  it('calls onCreated with documentId on success', async () => {
    vi.mocked(aiApi.generateDocument).mockResolvedValue({ documentId: 'doc-gen-42' } as any)
    const onCreated = vi.fn()

    render(<GenerateDocModal {...defaultProps} onCreated={onCreated} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    fireEvent.click(screen.getByText('dashboard.generate.submit').closest('button')!)

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('doc-gen-42')
    })
  })

  it('returns to form and shows error toast on API failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(aiApi.generateDocument).mockRejectedValue(new Error('server error'))

    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    fireEvent.click(screen.getByText('dashboard.generate.submit').closest('button')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('dashboard.generate.errorToast')
      expect(screen.getByText('dashboard.generate.submit')).toBeInTheDocument()
    })
  })

  it('close button is disabled while loading', async () => {
    vi.mocked(aiApi.generateDocument).mockImplementation(() => new Promise(() => {}))

    render(<GenerateDocModal {...defaultProps} />)
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.titrePlaceholder'),
      { target: { value: 'My Doc' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('dashboard.generate.descPlaceholder'),
      { target: { value: 'Some description' } },
    )
    fireEvent.click(screen.getByText('dashboard.generate.submit').closest('button')!)

    await waitFor(() => screen.getByText('dashboard.generate.generating'))

    const disabledBtns = document.querySelectorAll('button[disabled]')
    expect(disabledBtns.length).toBeGreaterThan(0)
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<GenerateDocModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('dashboard.documents.createDocModal.cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})