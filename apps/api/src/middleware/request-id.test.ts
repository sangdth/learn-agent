import { describe, it, expect } from 'vitest'
import { createRouter } from '../utils/create-router'
import { requestId } from './request-id'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const buildApp = () => {
  const app = createRouter()
  app.use('*', requestId())
  app.get('/echo', (c) => c.json({ id: c.get('requestId') }))
  return app
}

describe('requestId middleware', () => {
  it('generates a UUID and mirrors it back in the response header', async () => {
    const app = buildApp()
    const res = await app.request('/echo')

    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string }
    expect(body.id).toMatch(UUID_RE)
    expect(res.headers.get('x-request-id')).toBe(body.id)
  })

  it('honors an incoming x-request-id header', async () => {
    const app = buildApp()
    const res = await app.request('/echo', {
      headers: { 'x-request-id': 'trace-123' },
    })

    const body = (await res.json()) as { id: string }
    expect(body.id).toBe('trace-123')
    expect(res.headers.get('x-request-id')).toBe('trace-123')
  })

  it('ignores an empty incoming x-request-id and generates a new one', async () => {
    const app = buildApp()
    const res = await app.request('/echo', {
      headers: { 'x-request-id': '   ' },
    })

    const body = (await res.json()) as { id: string }
    expect(body.id).toMatch(UUID_RE)
  })
})
