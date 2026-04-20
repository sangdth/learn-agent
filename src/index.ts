import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { chatRoute } from './routes/chat.js'
import { createRouter } from './utils/create-router.js'
import { registerErrorHandler } from './utils/error-handler.js'
import { requestId } from './middleware/request-id.js'
import { env } from './config/env.js'

const app = createRouter()

app.use('*', logger())
app.use('*', cors())
app.use('*', requestId())

app.get('/', (c) => c.text('Hello Hono!'))
app.get('/healthz', (c) => c.json({ ok: true }))

app.route('/v1/chat', chatRoute)

registerErrorHandler(app)

export type AppType = typeof app

if (process.env.NODE_ENV !== 'test') {
  serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`)
    },
  )
}

export default app
