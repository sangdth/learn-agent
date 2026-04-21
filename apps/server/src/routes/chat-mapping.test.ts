import { describe, it, expect } from 'vitest'
import {
  approxTokens,
  newId,
  toOpenAIChunk,
  toOpenAIResponse,
} from './chat-mapping'
import type { ChatCompletionResponse } from '@repo/schemas'

describe('approxTokens', () => {
  it('returns at least 1 for empty text', () => {
    expect(approxTokens('')).toBe(1)
  })

  it('approximates 1 token per 4 chars, rounding up', () => {
    expect(approxTokens('abcd')).toBe(1)
    expect(approxTokens('abcde')).toBe(2)
    expect(approxTokens('a'.repeat(100))).toBe(25)
  })
})

describe('toOpenAIResponse', () => {
  it('builds a valid chat.completion response envelope', () => {
    const r: ChatCompletionResponse = toOpenAIResponse({
      id: 'chatcmpl-test',
      created: 1_700_000_000,
      model: 'gpt-4o-mini',
      content: 'Hello there',
      promptText: 'Hi',
    })

    expect(r.id).toBe('chatcmpl-test')
    expect(r.object).toBe('chat.completion')
    expect(r.created).toBe(1_700_000_000)
    expect(r.model).toBe('gpt-4o-mini')
    expect(r.choices).toHaveLength(1)
    expect(r.choices[0]?.index).toBe(0)
    expect(r.choices[0]?.message).toEqual({
      role: 'assistant',
      content: 'Hello there',
    })
    expect(r.choices[0]?.finish_reason).toBe('stop')
    expect(r.usage.prompt_tokens).toBe(approxTokens('Hi'))
    expect(r.usage.completion_tokens).toBe(approxTokens('Hello there'))
    expect(r.usage.total_tokens).toBe(
      r.usage.prompt_tokens + r.usage.completion_tokens,
    )
  })

  it('uses provided usage when supplied', () => {
    const r = toOpenAIResponse({
      id: 'x',
      created: 1,
      model: 'm',
      content: 'reply',
      promptText: 'prompt',
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    })
    expect(r.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    })
  })
})

describe('newId', () => {
  it('starts with chatcmpl- and is unique across calls', () => {
    const a = newId()
    const b = newId()
    expect(a.startsWith('chatcmpl-')).toBe(true)
    expect(b.startsWith('chatcmpl-')).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('toOpenAIChunk', () => {
  it('builds an initial role chunk with finish_reason=null', () => {
    const chunk = toOpenAIChunk({
      id: 'id1',
      created: 1,
      model: 'm',
      delta: { role: 'assistant' },
    })
    expect(chunk.object).toBe('chat.completion.chunk')
    expect(chunk.choices[0]?.delta).toEqual({ role: 'assistant' })
    expect(chunk.choices[0]?.finish_reason).toBeNull()
  })

  it('builds a content delta chunk', () => {
    const chunk = toOpenAIChunk({
      id: 'id1',
      created: 1,
      model: 'm',
      delta: { content: 'hello' },
    })
    expect(chunk.choices[0]?.delta).toEqual({ content: 'hello' })
    expect(chunk.choices[0]?.finish_reason).toBeNull()
  })

  it('builds a terminal chunk with finish_reason=stop', () => {
    const chunk = toOpenAIChunk({
      id: 'id1',
      created: 1,
      model: 'm',
      delta: {},
      finishReason: 'stop',
    })
    expect(chunk.choices[0]?.delta).toEqual({})
    expect(chunk.choices[0]?.finish_reason).toBe('stop')
  })
})
