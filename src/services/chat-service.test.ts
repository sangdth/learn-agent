import { describe, it, expect, vi } from 'vitest'
import { createChatService } from './chat-service'
import type { ChatMessage } from '../schemas/openai'

async function* toAsync<T>(values: readonly T[]): AsyncIterable<T> {
  for (const v of values) yield v
}

describe('createChatService', () => {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'first user turn' },
    { role: 'assistant', content: 'okay' },
    { role: 'user', content: 'LAST user turn' },
  ]

  it('generate forwards mapped messages and returns last user content as promptText', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ text: 'hello' })
    const stream = vi.fn()
    const service = createChatService({ generate, stream } as never)

    const result = await service.generate(messages)

    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledWith([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'first user turn' },
      { role: 'assistant', content: 'okay' },
      { role: 'user', content: 'LAST user turn' },
    ])
    expect(result.text).toBe('hello')
    expect(result.promptText).toBe('LAST user turn')
  })

  it('stream forwards the textStream and exposes promptText', async () => {
    const textStream = toAsync(['chunk-a', 'chunk-b'])
    const generate = vi.fn()
    const stream = vi.fn().mockResolvedValueOnce({ textStream })
    const service = createChatService({ generate, stream } as never)

    const result = await service.stream(messages)

    expect(stream).toHaveBeenCalledTimes(1)
    expect(result.promptText).toBe('LAST user turn')

    const collected: string[] = []
    for await (const chunk of result.textStream) collected.push(chunk)
    expect(collected).toEqual(['chunk-a', 'chunk-b'])
  })

  it('promptText falls back to empty string when no user message exists', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ text: 'ok' })
    const stream = vi.fn()
    const service = createChatService({ generate, stream } as never)

    const result = await service.generate([
      { role: 'system', content: 'only system' },
      { role: 'assistant', content: 'only assistant' },
    ])

    expect(result.promptText).toBe('')
  })
})
