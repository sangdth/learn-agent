import { Agent } from '@mastra/core/agent'

const apiKey = process.env.OPENCODE_API_KEY
if (!apiKey) {
  throw new Error(
    'OPENCODE_API_KEY is not set. Copy .env.example to .env and fill it in.',
  )
}

const baseURL = process.env.OPENCODE_BASE_URL
if (!baseURL) {
  throw new Error(
    'OPENCODE_BASE_URL is not set. See .env.example for a default (https://opencode.ai/zen/v1).',
  )
}

const rawModelId = process.env.DEFAULT_MODEL ?? 'opencode/qwen3.5-plus'
if (!rawModelId.includes('/')) {
  throw new Error(
    `DEFAULT_MODEL must be in "provider/model" form, got: ${rawModelId}`,
  )
}

export const defaultAgent = new Agent({
  id: 'default-agent',
  name: 'Default Agent',
  instructions:
    'You are a helpful assistant. Answer concisely and accurately. ' +
    'If a question is ambiguous, ask one brief clarifying question.',
  model: {
    id: rawModelId as `${string}/${string}`,
    url: baseURL,
    apiKey,
  },
})

export type DefaultAgent = typeof defaultAgent
