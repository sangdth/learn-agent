import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionUsage,
} from '../schemas/openai'

export const approxTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / 4))

export const newId = (): string =>
  `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

interface BuildResponseArgs {
  id: string
  created: number
  model: string
  content: string
  promptText: string
  usage?: ChatCompletionUsage
}

export const toOpenAIResponse = (
  args: BuildResponseArgs,
): ChatCompletionResponse => {
  const prompt = approxTokens(args.promptText)
  const completion = approxTokens(args.content)
  const usage: ChatCompletionUsage = args.usage ?? {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  }

  return {
    id: args.id,
    object: 'chat.completion',
    created: args.created,
    model: args.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: args.content },
        finish_reason: 'stop',
      },
    ],
    usage,
  }
}

interface BuildChunkArgs {
  id: string
  created: number
  model: string
  delta: { role?: 'assistant'; content?: string }
  finishReason?: 'stop' | null
}

export const toOpenAIChunk = (args: BuildChunkArgs): ChatCompletionChunk => ({
  id: args.id,
  object: 'chat.completion.chunk',
  created: args.created,
  model: args.model,
  choices: [
    {
      index: 0,
      delta: args.delta,
      finish_reason: args.finishReason ?? null,
    },
  ],
})
