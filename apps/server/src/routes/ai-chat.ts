import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { zValidator } from '@hono/zod-validator'
import { getChatService } from '../services/chat-service'
import { createRouter } from '../utils/create-router'
import { aiChatRequestSchema, type ChatMessage, type UiMessage } from '@repo/schemas'

const uiMessageToText = (message: UiMessage): string =>
  message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')

const toChatMessages = (messages: readonly UiMessage[]): ChatMessage[] =>
  messages.map((m) => ({
    role: m.role,
    content: uiMessageToText(m),
  }))

export const aiChatRoute = createRouter().post(
  '/chat',
  zValidator('json', aiChatRequestSchema),
  async (c) => {
    const body = c.req.valid('json')
    const chatMessages = toChatMessages(body.messages)

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const { textStream } = await getChatService().stream(chatMessages)
        const textId = crypto.randomUUID()
        writer.write({ type: 'text-start', id: textId })
        for await (const delta of textStream) {
          if (!delta) continue
          writer.write({ type: 'text-delta', id: textId, delta })
        }
        writer.write({ type: 'text-end', id: textId })
      },
      onError: (error) => (error instanceof Error ? error.message : 'stream_error'),
    })

    return createUIMessageStreamResponse({ stream })
  },
)

export type AiChatRoute = typeof aiChatRoute
