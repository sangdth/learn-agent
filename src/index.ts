import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { chatRoute } from './routes/chat.js'

const app = new Hono()
  .get('/', (c) => c.text('Hello Hono!'))
  .route('/v1/chat', chatRoute)

export type AppType = typeof app

const port = Number(process.env.PORT ?? 3000)

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)

export default app
