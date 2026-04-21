import { Agent } from '@mastra/core/agent';
import { env } from '@/config/env';

export const defaultAgent = new Agent({
  id: 'default-agent',
  name: 'Default Agent',
  instructions:
    'You are a helpful assistant. Answer concisely and accurately. ' +
    'If a question is ambiguous, ask one brief clarifying question.',
  model: {
    id: env.DEFAULT_MODEL as `${string}/${string}`,
    url: env.OPENCODE_BASE_URL,
    apiKey: env.OPENCODE_API_KEY,
  },
});

export type DefaultAgent = typeof defaultAgent;
