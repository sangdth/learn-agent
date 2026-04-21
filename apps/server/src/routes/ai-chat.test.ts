import { describe, it, expect, vi, beforeEach } from 'vitest';

const { streamMock } = vi.hoisted(() => ({
  streamMock: vi.fn(),
}));

vi.mock('../services/chat-service', () => ({
  getChatService: () => ({
    generate: vi.fn(),
    stream: streamMock,
  }),
}));

const loadRoute = async () => {
  const mod = await import('./ai-chat');
  return mod.aiChatRoute;
};

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

const validRequest = (messages: unknown) =>
  new Request('http://localhost/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

describe('POST /chat (AI SDK UI stream)', () => {
  beforeEach(() => {
    streamMock.mockReset();
  });

  it('streams text-start, text-delta, text-end parts for a valid request', async () => {
    streamMock.mockResolvedValueOnce({
      textStream: toAsync(['Hello', ' world']),
    });

    const route = await loadRoute();
    const res = await route.request(
      '/chat',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
          ],
        }),
      },
    );

    expect(res.status).toBe(200);
    const frames = await collectSSE(res);
    const parsed = frames
      .filter((f) => f !== '[DONE]')
      .map((f) => JSON.parse(f) as { type: string; delta?: string });

    const types = parsed.map((p) => p.type);
    expect(types).toContain('text-start');
    expect(types).toContain('text-delta');
    expect(types).toContain('text-end');

    const deltas = parsed
      .filter((p) => p.type === 'text-delta')
      .map((p) => p.delta);
    expect(deltas).toEqual(['Hello', ' world']);

    expect(streamMock).toHaveBeenCalledTimes(1);
    const passedMessages = streamMock.mock.calls[0]?.[0] as Array<{
      role: string;
      content: string;
    }>;
    expect(passedMessages).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('returns 400 on invalid body (missing messages)', async () => {
    const route = await loadRoute();
    const res = await route.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it('returns 400 on empty messages array', async () => {
    const route = await loadRoute();
    const res = await route.request(
      '/chat',
      validRequest([]),
    );
    expect(res.status).toBe(400);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it('surfaces an error-type frame when the underlying stream throws', async () => {
    async function* throwingStream(): AsyncIterable<string> {
      yield 'partial';
      throw new Error('boom');
    }
    streamMock.mockResolvedValueOnce({
      textStream: throwingStream(),
    });

    const route = await loadRoute();
    const res = await route.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const frames = await collectSSE(res);
    const parsed = frames
      .filter((f) => f !== '[DONE]')
      .map((f) => JSON.parse(f) as { type: string; errorText?: string });

    const errorFrame = parsed.find((p) => p.type === 'error');
    expect(errorFrame).toBeDefined();
    expect(errorFrame?.errorText).toBe('boom');
  });
});
