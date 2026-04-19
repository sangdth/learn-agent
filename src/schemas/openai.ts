import { z } from 'zod'

export const chatRoleSchema = z.enum(['system', 'user', 'assistant', 'tool'])

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string(),
  name: z.string().optional(),
})

export const chatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  user: z.string().optional(),
})

export type ChatRole = z.infer<typeof chatRoleSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>

export interface ChatCompletionChoice {
  index: number
  message: ChatMessage
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null
}

export interface ChatCompletionUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: ChatCompletionChoice[]
  usage: ChatCompletionUsage
}

export interface ChatCompletionChunkChoice {
  index: number
  delta: Partial<ChatMessage>
  finish_reason: ChatCompletionChoice['finish_reason']
}

export interface ChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: ChatCompletionChunkChoice[]
}
