import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import {
  chatCompletionRequestSchema,
  type ChatCompletionChunk,
  type ChatCompletionResponse,
} from '../schemas/openai.js'

const newId = (): string =>
  `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

const echoReply = (lastUserContent: string): string =>
  `Echo: ${lastUserContent}`

const approxTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / 4))

export const chatRoute = new Hono().post(
  '/completions',
  zValidator('json', chatCompletionRequestSchema),
  (c) => {
    const body = c.req.valid('json')
    const lastUser =
      [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const replyText = echoReply(lastUser)
    const id = newId()
    const created = Math.floor(Date.now() / 1000)

    if (!body.stream) {
      const response: ChatCompletionResponse = {
        id,
        object: 'chat.completion',
        created,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: replyText },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: approxTokens(lastUser),
          completion_tokens: approxTokens(replyText),
          total_tokens: approxTokens(lastUser) + approxTokens(replyText),
        },
      }
      return c.json(response)
    }

    return streamSSE(c, async (stream) => {
      const roleChunk: ChatCompletionChunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: body.model,
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      }
      await stream.writeSSE({ data: JSON.stringify(roleChunk) })

      for (const token of replyText.split(/(\s+)/)) {
        if (!token) continue
        const chunk: ChatCompletionChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: body.model,
          choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
        }
        await stream.writeSSE({ data: JSON.stringify(chunk) })
      }

      const doneChunk: ChatCompletionChunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: body.model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }
      await stream.writeSSE({ data: JSON.stringify(doneChunk) })
      await stream.writeSSE({ data: '[DONE]' })
    })
  },
)

export type ChatRoute = typeof chatRoute
