import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../utils/create-router'

const HEADER = 'x-request-id'

export const requestId = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const incoming = c.req.header(HEADER)
    const id = incoming && incoming.trim().length > 0 ? incoming : crypto.randomUUID()
    c.set('requestId', id)
    c.header(HEADER, id)
    await next()
  })
