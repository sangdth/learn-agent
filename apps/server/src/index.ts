import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { chatRoute } from './routes/chat';
import { aiChatRoute } from './routes/ai-chat';
import { createRouter } from './utils/create-router';
import { registerErrorHandler } from './utils/error-handler';
import { requestId } from './middleware/request-id';
import { env } from './config/env';

export const app = createRouter();

app.use('*', logger());
app.use('*', cors());
app.use('*', requestId());

app.get('/', (c) => c.text('Hello Hono!'));
app.get('/healthz', (c) => c.json({ ok: true }));

app.route('/v1/chat', chatRoute);
app.route('/v1/ai', aiChatRoute);

registerErrorHandler(app);

export type AppType = typeof app;

export default {
  port: env.PORT,
  fetch: app.fetch,
};
