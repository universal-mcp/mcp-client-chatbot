import { UIMessage } from "ai";

export type UIMessageWithCompleted = UIMessage & { completed: boolean };

export interface VoiceChatSession {
  isActive: boolean;
  isListening: boolean;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
  isLoading: boolean;
  messages: UIMessageWithCompleted[];
  error: Error | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
}

export type VoiceChatHook = (props?: {
  [key: string]: any;
}) => VoiceChatSession;
