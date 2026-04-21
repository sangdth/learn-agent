import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { getChatService } from '@/services/chat-service';
import { createRouter } from '@/utils/create-router';
import {
  chatCompletionRequestSchema,
  type ChatCompletionChunk,
} from '@repo/schemas';
import { newId, toOpenAIChunk, toOpenAIResponse } from './chat-mapping';
import type { ApiErrorBody } from '../utils/error-handler';

export const chatRoute = createRouter().post(
  '/completions',
  zValidator('json', chatCompletionRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const service = getChatService();
    const id = newId();
    const created = Math.floor(Date.now() / 1000);

    if (!body.stream) {
      const result = await service.generate(body.messages);
      return c.json(
        toOpenAIResponse({
          id,
          created,
          model: body.model,
          content: result.text,
          promptText: result.promptText,
        }),
      );
    }

    return streamSSE(c, async (stream) => {
      const { textStream } = await service.stream(body.messages);

      const roleChunk: ChatCompletionChunk = toOpenAIChunk({
        id,
        created,
        model: body.model,
        delta: { role: 'assistant' },
      });
      await stream.writeSSE({ data: JSON.stringify(roleChunk) });

      try {
        for await (const text of textStream) {
          if (!text) continue;
          const chunk: ChatCompletionChunk = toOpenAIChunk({
            id,
            created,
            model: body.model,
            delta: { content: text },
          });
          await stream.writeSSE({ data: JSON.stringify(chunk) });
        }
      } catch {
        // onError can't reach an already-open SSE stream; emit a terminal error frame instead.
        const errorBody: ApiErrorBody = {
          error: {
            code: 'stream_error',
            message: 'Streaming failed',
            requestId: c.get('requestId') ?? '',
          },
        };
        await stream.writeSSE({ data: JSON.stringify(errorBody) });
        await stream.writeSSE({ data: '[DONE]' });
        return;
      }

      const doneChunk: ChatCompletionChunk = toOpenAIChunk({
        id,
        created,
        model: body.model,
        delta: {},
        finishReason: 'stop',
      });
      await stream.writeSSE({ data: JSON.stringify(doneChunk) });
      await stream.writeSSE({ data: '[DONE]' });
    });
  },
);

export type ChatRoute = typeof chatRoute;
