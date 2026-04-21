import { z } from 'zod';

const envSchema = z.object({
  OPENCODE_API_KEY: z.string().min(1, 'OPENCODE_API_KEY is required'),
  OPENCODE_BASE_URL: z.url('OPENCODE_BASE_URL must be a valid URL'),
  DEFAULT_MODEL: z
    .string()
    .default('opencode-go/minimax-m2.7')
    .refine((v) => v.includes('/'), {
      message:
        'DEFAULT_MODEL must be in "provider/model" form (e.g. opencode-go/minimax-m2.7)',
    }),
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
