import { z } from 'zod';

export const uiTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const uiMessagePartSchema = z.union([
  uiTextPartSchema,
  z.looseObject({ type: z.string() }),
]);

export const uiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['system', 'user', 'assistant']),
  parts: z.array(uiMessagePartSchema).min(1),
});

export const aiChatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
  id: z.string().optional(),
});

export type UiTextPart = z.infer<typeof uiTextPartSchema>;
export type UiMessagePart = z.infer<typeof uiMessagePartSchema>;
export type UiMessage = z.infer<typeof uiMessageSchema>;
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
