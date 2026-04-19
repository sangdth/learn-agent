import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateMock, streamMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  streamMock: vi.fn(),
}))

vi.mock('../mastra/index.js', () => ({
  getDefaultAgent: () => ({
    generate: generateMock,
    stream: streamMock,
  }),
}))

const loadRoute = async () => {
  const mod = await import('./chat.js')
  return mod.chatRoute
}

describe('POST /completions (non-streaming)', () => {
  beforeEach(() => {
    generateMock.mockReset()
    streamMock.mockReset()
  })

  it('calls the agent and returns an openai-shaped response', async () => {
    generateMock.mockResolvedValueOnce({ text: 'Hi from agent' })

    const route = await loadRoute()
    const res = await route.request('/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello?' }],
        stream: false,
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      object: string
      model: string
      choices: Array<{
        message: { role: string; content: string }
        finish_reason: string
      }>
    }
    expect(body.object).toBe('chat.completion')
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.choices[0]?.message).toEqual({
      role: 'assistant',
      content: 'Hi from agent',
    })
    expect(body.choices[0]?.finish_reason).toBe('stop')
    expect(generateMock).toHaveBeenCalledTimes(1)
  })

  it('returns 400 on invalid request body', async () => {
    const route = await loadRoute()
    const res = await route.request('/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini' }),
    })
    expect(res.status).toBe(400)
    expect(generateMock).not.toHaveBeenCalled()
  })
})
