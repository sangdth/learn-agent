import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { getDefaultAgent } from '../mastra/index.js'
import {
  chatCompletionRequestSchema,
  type ChatCompletionChunk,
  type ChatMessage,
} from '../schemas/openai.js'
import {
  newId,
  toOpenAIChunk,
  toOpenAIResponse,
} from './chat-mapping.js'

const toAgentMessages = (
  messages: readonly ChatMessage[],
): Array<{ role: ChatMessage['role']; content: string }> =>
  messages.map((m) => ({ role: m.role, content: m.content }))

const lastUserContent = (messages: readonly ChatMessage[]): string =>
  [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

export const chatRoute = new Hono().post(
  '/completions',
  zValidator('json', chatCompletionRequestSchema),
  async (c) => {
    const body = c.req.valid('json')
    const agent = getDefaultAgent()
    const id = newId()
    const created = Math.floor(Date.now() / 1000)
    const promptText = lastUserContent(body.messages)

    if (!body.stream) {
      const result = await agent.generate(toAgentMessages(body.messages))
      return c.json(
        toOpenAIResponse({
          id,
          created,
          model: body.model,
          content: result.text,
          promptText,
        }),
      )
    }

    return streamSSE(c, async (stream) => {
      const agentStream = await agent.stream(toAgentMessages(body.messages))

      const roleChunk: ChatCompletionChunk = toOpenAIChunk({
        id,
        created,
        model: body.model,
        delta: { role: 'assistant' },
      })
      await stream.writeSSE({ data: JSON.stringify(roleChunk) })

      for await (const text of agentStream.textStream) {
        if (!text) continue
        const chunk: ChatCompletionChunk = toOpenAIChunk({
          id,
          created,
          model: body.model,
          delta: { content: text },
        })
        await stream.writeSSE({ data: JSON.stringify(chunk) })
      }

      const doneChunk: ChatCompletionChunk = toOpenAIChunk({
        id,
        created,
        model: body.model,
        delta: {},
        finishReason: 'stop',
      })
      await stream.writeSSE({ data: JSON.stringify(doneChunk) })
      await stream.writeSSE({ data: '[DONE]' })
    })
  },
)

export type ChatRoute = typeof chatRoute
