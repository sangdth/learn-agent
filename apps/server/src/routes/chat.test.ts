import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateMock, streamMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  streamMock: vi.fn(),
}));

vi.mock('@/services/chat-service', () => ({
  getChatService: () => ({
    generate: generateMock,
    stream: streamMock,
  }),
}));

const loadRoute = async () => {
  const mod = await import('./chat');
  return mod.chatRoute;
};

describe('POST /completions (non-streaming)', () => {
  beforeEach(() => {
    generateMock.mockReset();
    streamMock.mockReset();
  });

  it('calls the service and returns an openai-shaped response', async () => {
    generateMock.mockResolvedValueOnce({
      text: 'Hi from agent',
      promptText: 'Hello?',
    });

    const route = await loadRoute();
    const res = await route.request('/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello?' }],
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      model: string;
      choices: Array<{
        message: { role: string; content: string };
        finish_reason: string;
      }>;
    };
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.choices[0]?.message).toEqual({
      role: 'assistant',
      content: 'Hi from agent',
    });
    expect(body.choices[0]?.finish_reason).toBe('stop');
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it('returns 400 on invalid request body', async () => {
    const route = await loadRoute();
    const res = await route.request('/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini' }),
    });
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });
});

async function* toAsync<T>(values: readonly T[]): AsyncIterable<T> {
  for (const v of values) yield v;
}

async function collectSSE(res: Response): Promise<string[]> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('no body');
  const decoder = new TextDecoder();
  let buf = '';
  const events: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (line) events.push(line.slice('data: '.length));
    }
  }
  return events;
}

describe('POST /completions (streaming)', () => {
  beforeEach(() => {
    generateMock.mockReset();
    streamMock.mockReset();
  });

  it('emits role, content, stop, and [DONE] frames', async () => {
    streamMock.mockResolvedValueOnce({
      textStream: toAsync(['Hello', ' world']),
      promptText: 'Hi',
    });

    const route = await loadRoute();
    const res = await route.request('/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const frames = await collectSSE(res);
    expect(frames.at(-1)).toBe('[DONE]');

    const parsed = frames.slice(0, -1).map(
      (f) =>
        JSON.parse(f) as {
          choices: Array<{
            delta: { role?: string; content?: string };
            finish_reason: string | null;
          }>;
        },
    );

    expect(parsed[0]?.choices[0]?.delta).toEqual({ role: 'assistant' });
    expect(parsed[1]?.choices[0]?.delta).toEqual({ content: 'Hello' });
    expect(parsed[2]?.choices[0]?.delta).toEqual({ content: ' world' });
    expect(parsed.at(-1)?.choices[0]?.finish_reason).toBe('stop');
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('emits a terminal error frame when the underlying stream throws', async () => {
    async function* throwingStream(): AsyncIterable<string> {
      yield 'partial';
      throw new Error('boom');
    }
    streamMock.mockResolvedValueOnce({
      textStream: throwingStream(),
      promptText: 'Hi',
    });

    const route = await loadRoute();
    const res = await route.request('/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      }),
    });

    expect(res.status).toBe(200);
    const frames = await collectSSE(res);
    expect(frames.at(-1)).toBe('[DONE]');
    const errorFrame = frames.at(-2);
    expect(errorFrame).toBeDefined();
    const parsed = JSON.parse(errorFrame ?? '{}') as {
      error?: { code: string; message: string };
    };
    expect(parsed.error?.code).toBe('stream_error');
  });
});
