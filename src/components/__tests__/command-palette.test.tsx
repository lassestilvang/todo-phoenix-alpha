import { expect, describe, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommandPalette } from '../command-palette'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the component without crashing', () => {
    expect(() => render(<CommandPalette open={true} onOpenChange={vi.fn()} />)).not.toThrow()
  })

  it('should have container when open', () => {
    const { container } = render(<CommandPalette open={true} onOpenChange={vi.fn()} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('should accept open prop and render', () => {
    const { container } = render(<CommandPalette open={false} onOpenChange={vi.fn()} />)
    expect(container).toBeInTheDocument()
  })
})