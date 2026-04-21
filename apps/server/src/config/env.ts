import { z } from 'zod';

const openAICompatibleBaseUrlSchema = z
  .url('LLM_BASE_URL must be a valid URL')
  .transform((value) => value.replace(/\/+$/, ''))
  .refine(
    (value) =>
      !value.endsWith('/chat/completions') && !value.endsWith('/messages'),
    {
      message:
        'LLM_BASE_URL must be the API root (for example https://opencode.ai/zen/go/v1), not /chat/completions or /messages',
    },
  );

const modelIdSchema = z
  .string()
  .regex(/^[^/]+\/[^/]+$/, {
    message:
      'DEFAULT_MODEL must be in "provider/model" form (e.g. opencode-go/minimax-m2.7)',
  })
  .transform((value) => value as `${string}/${string}`);

const envSchema = z.object({
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_BASE_URL: openAICompatibleBaseUrlSchema,
  DEFAULT_MODEL: modelIdSchema.default('opencode-go/minimax-m2.7'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const path = issue.path.join('.') || '<root>';
    return `  - ${path}: ${issue.message}`;
  });
  throw new Error(
    `Invalid environment configuration:\n${lines.join('\n')}\n` +
      'Copy .env.example to .env and fill in the missing values.',
  );
};

export const env: Env = parseEnv();
