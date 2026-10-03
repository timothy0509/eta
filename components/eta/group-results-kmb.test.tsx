import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen, waitFor, within } from '@/lib/test-utils'
import { GroupResultsKmb } from '@/components/eta/group-results-kmb'
import { fetchKmbStopEtas } from '@/lib/eta/client'
import type { KmbGroupMember } from '@/lib/eta/group-view'

vi.mock('@/lib/eta/client', () => ({
  fetchKmbStopEtas: vi.fn(),
  fetchKmbRouteInfo: vi.fn(),
}))

const mockFetchKmbStopEtas = vi.mocked(fetchKmbStopEtas)

const member: KmbGroupMember = { id: 'm1', mode: 'kmb', title: 'Test Stop', stopId: 'S1' }

function renderView() {
  return render(
    <GroupResultsKmb lang="en" groupName="Group A" members={[member]} onBack={() => {}} />
  )
}

describe('GroupResultsKmb', () => {
  beforeEach(() => {
    mockFetchKmbStopEtas.mockReset()
  })

  it('never surfaces AbortError in member sections', async () => {
    mockFetchKmbStopEtas.mockRejectedValue(
      new DOMException('The operation was aborted.', 'AbortError')
    )

    const { container } = renderView()

    // Wait for the section to settle out of loading, then assert no abort
    // text leaked into the UI (previously every section showed it as error).
    await waitFor(() => expect(container.querySelector('.ui-spin')).toBeNull())
    expect(document.body.textContent).not.toMatch(/abort/i)
  })

  it('still shows genuine errors with a retry action', async () => {
    mockFetchKmbStopEtas.mockRejectedValue(new Error('Network down'))

    renderView()

    await screen.findByText('Network down')
    const statuses = screen.getAllByRole('status')
    const errorStatus = statuses.find((el) => el.textContent?.includes('Network down'))
    expect(errorStatus).toBeTruthy()
    expect(within(errorStatus as HTMLElement).getByRole('button')).toBeTruthy()
  })
})
