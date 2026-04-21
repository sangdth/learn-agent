import { describe, it, expect } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { z, ZodError } from 'zod'
import { toErrorResponse, registerErrorHandler } from './error-handler'
import { createRouter } from './create-router'
import { requestId } from '../middleware/request-id'

describe('toErrorResponse', () => {
  const rid = 'req-1'

  it('maps HTTPException to its status and derived code', () => {
    const { status, body } = toErrorResponse(
      new HTTPException(404, { message: 'thing missing' }),
      rid,
    )
    expect(status).toBe(404)
    expect(body).toEqual({
      error: { code: 'not_found', message: 'thing missing', requestId: rid },
    })
  })

  it('maps ZodError to 400 validation_error with joined issue paths', () => {
    const schema = z.object({ foo: z.string().min(2), bar: z.number() })
    const parse = schema.safeParse({ foo: 'a', bar: 'x' })
    expect(parse.success).toBe(false)
    const err = (parse as { success: false; error: ZodError }).error

    const { status, body } = toErrorResponse(err, rid)
    expect(status).toBe(400)
    expect(body.error.code).toBe('validation_error')
    expect(body.error.requestId).toBe(rid)
    expect(body.error.message).toContain('foo')
    expect(body.error.message).toContain('bar')
  })

  it('maps unknown errors to generic 500 without leaking the message', () => {
    const { status, body } = toErrorResponse(
      new Error('SECRET-internal-detail'),
      rid,
    )
    expect(status).toBe(500)
    expect(body.error.code).toBe('internal_error')
    expect(body.error.message).toBe('Internal Server Error')
    expect(body.error.message).not.toContain('SECRET')
  })

  it('includes requestId for bare non-Error throws', () => {
    const { status, body } = toErrorResponse('boom', rid)
    expect(status).toBe(500)
    expect(body.error.requestId).toBe(rid)
  })
})

describe('registerErrorHandler', () => {
  it('serializes HTTPException through the envelope with requestId', async () => {
    const app = createRouter()
    app.use('*', requestId())
    app.get('/boom', () => {
      throw new HTTPException(418, { message: 'teapot' })
    })
    registerErrorHandler(app)

    const res = await app.request('/boom', {
      headers: { 'x-request-id': 'rid-xyz' },
    })
    expect(res.status).toBe(418)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'error', message: 'teapot', requestId: 'rid-xyz' },
    })
  })

  it('returns 404 envelope for unknown routes', async () => {
    const app = createRouter()
    app.use('*', requestId())
    app.get('/known', (c) => c.text('ok'))
    registerErrorHandler(app)

    const res = await app.request('/unknown', {
      headers: { 'x-request-id': 'rid-404' },
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string }
    }
    expect(body.error.code).toBe('not_found')
    expect(body.error.requestId).toBe('rid-404')
    expect(body.error.message).toContain('/unknown')
  })
})
