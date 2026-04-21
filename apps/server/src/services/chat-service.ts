import { getDefaultAgent } from '../mastra/index';
import type { DefaultAgent } from '../mastra/agents/default-agent';
import type { ChatMessage } from '@repo/schemas';

export interface AgentMessage {
  role: ChatMessage['role'];
  content: string;
}

export interface GenerateResult {
  text: string;
  promptText: string;
}

export interface StreamResult {
  textStream: AsyncIterable<string>;
}

const toAgentMessages = (messages: readonly ChatMessage[]): AgentMessage[] =>
  messages.map((m) => ({ role: m.role, content: m.content }));

const lastUserContent = (messages: readonly ChatMessage[]): string =>
  [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

export interface ChatService {
  generate(messages: readonly ChatMessage[]): Promise<GenerateResult>;
  stream(messages: readonly ChatMessage[]): Promise<StreamResult>;
}

interface ChatServiceAgent {
  generate: DefaultAgent['generate'];
  stream: DefaultAgent['stream'];
}

export const createChatService = (agent: ChatServiceAgent): ChatService => ({
  async generate(messages) {
    const result = await agent.generate(toAgentMessages(messages));
    return {
      text: result.text,
      promptText: lastUserContent(messages),
    };
  },
  async stream(messages) {
    const agentStream = await agent.stream(toAgentMessages(messages));
    return {
      textStream: agentStream.textStream,
    };
  },
});

let defaultInstance: ChatService | undefined;

export const getChatService = (): ChatService => {
  defaultInstance ??= createChatService(getDefaultAgent());
  return defaultInstance;
};
