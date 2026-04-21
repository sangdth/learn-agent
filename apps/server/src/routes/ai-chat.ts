import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { getChatService } from '../services/chat-service'
import { createRouter } from '../utils/create-router'
import type { ChatMessage } from '@repo/schemas'

const uiMessageToText = (message: UIMessage): string =>
  message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')

const toChatMessages = (messages: readonly UIMessage[]): ChatMessage[] =>
  messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => ({
      role: m.role as ChatMessage['role'],
      content: uiMessageToText(m),
    }))

export const aiChatRoute = createRouter().post('/chat', async (c) => {
  const body = (await c.req.json()) as { messages: UIMessage[] }
  const chatMessages = toChatMessages(body.messages ?? [])

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
    onError: (error) =>
      error instanceof Error ? error.message : 'stream_error',
  })

  return createUIMessageStreamResponse({ stream })
})

export type AiChatRoute = typeof aiChatRoute
