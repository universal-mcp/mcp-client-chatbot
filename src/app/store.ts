import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatThread, Project } from "app-types/chat";
import { AllowedMCPServer, MCPServerInfo } from "app-types/mcp";
import { OPENAI_VOICE } from "lib/ai/speech/open-ai/use-voice-chat.openai";
import { AppDefaultToolkit } from "lib/ai/tools";

export interface AppState {
  threadList: ChatThread[];
  mcpList: (MCPServerInfo & { id: string })[];
  projectList: Omit<Project, "instructions">[];
  currentThreadId: ChatThread["id"] | null;
  currentProjectId: Project["id"] | null;
  selectedProjectForPrompt: Project["id"] | null;
  selectedProjectName: string | null;
  toolChoice: "auto" | "none" | "manual";
  allowedMcpServers?: Record<string, AllowedMCPServer>;
  openShortcutsPopup: boolean;
  openChatPreferences: boolean;
  mcpCustomizationPopup?: MCPServerInfo & { id: string };
  allowedAppDefaultToolkit?: AppDefaultToolkit[];
  generatingTitleThreadIds: string[];
  temporaryChat: {
    isOpen: boolean;
    instructions: string;
  };
  voiceChat: {
    isOpen: boolean;
    threadId?: string;
    projectId?: string;
    options: {
      provider: string;
      providerOptions?: Record<string, any>;
    };
  };
  isMcpClientListLoading: boolean;
  llmModel: string;
}

export interface AppDispatch {
  mutate: (state: Mutate<AppState>) => void;
}

const initialState: AppState = {
  threadList: [],
  projectList: [],
  mcpList: [],
  currentThreadId: null,
  currentProjectId: null,
  selectedProjectForPrompt: null,
  selectedProjectName: null,
  toolChoice: "auto",
  allowedMcpServers: undefined,
  openShortcutsPopup: false,
  openChatPreferences: false,
  mcpCustomizationPopup: undefined,
  allowedAppDefaultToolkit: [],
  temporaryChat: {
    isOpen: false,
    instructions: "",
  },
  voiceChat: {
    isOpen: false,
    options: {
      provider: "openai",
      providerOptions: {
        model: OPENAI_VOICE["Alloy"],
      },
    },
  },
  isMcpClientListLoading: true,
  generatingTitleThreadIds: [],
  llmModel: "anthropic/claude-sonnet-4",
};

export const appStore = create<AppState & AppDispatch>()(
  persist(
    (set, _get) => ({
      ...initialState,
      mutate: set,
    }),
    {
      name: "mc-app-store-v2.0.0",
      partialize: (state) => ({
        toolChoice: state.toolChoice || initialState.toolChoice,
        allowedMcpServers:
          state.allowedMcpServers || initialState.allowedMcpServers,
        allowedAppDefaultToolkit:
          state.allowedAppDefaultToolkit ||
          initialState.allowedAppDefaultToolkit,
        temporaryChat: {
          ...initialState.temporaryChat,
          ...state.temporaryChat,
          isOpen: false,
        },
        voiceChat: {
          ...initialState.voiceChat,
          ...state.voiceChat,
          threadId: undefined,
          projectId: undefined,
          isOpen: false,
        },
        llmModel: state.llmModel || initialState.llmModel,
      }),
    },
  ),
);
