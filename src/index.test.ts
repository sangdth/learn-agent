import { describe, it, expect, vi } from 'vitest'

vi.mock('./services/chat-service', () => ({
  getChatService: () => ({
    generate: vi.fn(),
    stream: vi.fn(),
  }),
}))

const loadApp = async () => {
  const mod = await import('./index')
  return mod.app
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('app', () => {
  it('GET /healthz returns { ok: true } with x-request-id header', async () => {
    const app = await loadApp()
    const res = await app.request('/healthz')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const rid = res.headers.get('x-request-id')
    expect(rid).toBeTruthy()
    expect(rid).toMatch(UUID_RE)
  })

  it('honors an incoming x-request-id on /healthz', async () => {
    const app = await loadApp()
    const res = await app.request('/healthz', {
      headers: { 'x-request-id': 'trace-42' },
    })
    expect(res.headers.get('x-request-id')).toBe('trace-42')
  })

  it('unknown route returns 404 error envelope with requestId', async () => {
    const app = await loadApp()
    const res = await app.request('/nope', {
      headers: { 'x-request-id': 'rid-nope' },
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string }
    }
    expect(body.error.code).toBe('not_found')
    expect(body.error.requestId).toBe('rid-nope')
    expect(body.error.message).toContain('/nope')
  })
})
