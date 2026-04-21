import { Mastra } from '@mastra/core/mastra'
import { defaultAgent } from './agents/default-agent'

export const mastra = new Mastra({
  agents: { defaultAgent },
})

export const getDefaultAgent = (): typeof defaultAgent => defaultAgent
