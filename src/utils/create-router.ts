import { Hono } from 'hono'

export interface AppVariables {
  requestId: string
}

export type AppEnv = { Variables: AppVariables }

export const createRouter = (): Hono<AppEnv> => new Hono<AppEnv>()
