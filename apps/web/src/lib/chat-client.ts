import { chatCompletionRequestSchema, type ChatMessage } from '@repo/schemas'

export interface StreamChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: { role?: 'assistant'; content?: string }
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null
  }>
}

export interface StreamErrorFrame {
  error: { code: string; message: string; requestId: string }
}

export interface StreamChatArgs {
  model: string
  messages: readonly ChatMessage[]
  onDelta: (text: string) => void
  signal?: AbortSignal
}

export async function streamChat({
  model,
  messages,
  onDelta,
  signal,
}: StreamChatArgs): Promise<void> {
  const body = chatCompletionRequestSchema.parse({
    model,
    messages,
    stream: true,
  })

  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`chat request failed: ${res.status} ${text}`)
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += value

    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return

      const frame = JSON.parse(payload) as StreamChunk | StreamErrorFrame
      if ('error' in frame) {
        throw new Error(frame.error.message)
      }

      const delta = frame.choices[0]?.delta.content
      if (delta) onDelta(delta)
    }
  }
}
