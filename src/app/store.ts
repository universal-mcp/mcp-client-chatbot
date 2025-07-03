import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AppDefaultToolkit,
  ChatModel,
  ChatThread,
  Project,
} from "app-types/chat";
import { AllowedMCPServer, MCPServerInfo } from "app-types/mcp";
import { OPENAI_VOICE } from "lib/ai/speech/open-ai/use-voice-chat.openai";
import { mutate } from "swr";
import { organization } from "@/lib/auth/client";

export interface AppState {
  threadList: ChatThread[];
  mcpList: (MCPServerInfo & { id: string })[];
  projectList: Omit<Project, "instructions">[];
  currentThreadId: ChatThread["id"] | null;
  currentProjectId: Project["id"] | null;
  toolChoice: "auto" | "none" | "manual";
  allowedMcpServers?: Record<string, AllowedMCPServer>;
  allowedAppDefaultToolkit?: AppDefaultToolkit[];
  toolPresets: {
    allowedMcpServers?: Record<string, AllowedMCPServer>;
    allowedAppDefaultToolkit?: AppDefaultToolkit[];
    name: string;
  }[];
  chatModel?: ChatModel;
  openShortcutsPopup: boolean;
  openChatPreferences: boolean;
  mcpCustomizationPopup?: MCPServerInfo & { id: string };
  temporaryChat: {
    isOpen: boolean;
    instructions: string;
    chatModel?: ChatModel;
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
}

export interface AppDispatch {
  mutate: (state: Mutate<AppState>) => void;
  invalidateOrganizationData: () => void;
  handleSwitchOrganization: (
    orgId: string | null,
    currentActiveOrgId?: string | null,
  ) => Promise<boolean>;
}

const initialState: AppState = {
  threadList: [],
  projectList: [],
  mcpList: [],
  currentThreadId: null,
  currentProjectId: null,
  toolChoice: "auto",
  allowedMcpServers: undefined,
  allowedAppDefaultToolkit: [],
  toolPresets: [],
  openShortcutsPopup: false,
  openChatPreferences: false,
  mcpCustomizationPopup: undefined,
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
};

export const appStore = create<AppState & AppDispatch>()(
  persist(
    (set, get) => ({
      ...initialState,
      mutate: set,
      invalidateOrganizationData: () => {
        // Invalidate all organization-scoped SWR keys
        mutate("projects");
        mutate("threads");
        mutate("mcp-integrations");
        mutate("chat-models");
        mutate("user-role");

        // Clear current selections since they might not exist in the new organization
        set({
          currentThreadId: null,
          currentProjectId: null,
          threadList: [],
          projectList: [],
          mcpList: [],
        });
      },
      handleSwitchOrganization: async (
        orgId: string | null,
        currentActiveOrgId?: string | null,
      ) => {
        try {
          // Don't do anything if trying to switch to current org
          if (orgId === currentActiveOrgId) {
            return false;
          }

          // Set the new active organization
          await organization.setActive({
            organizationId: orgId,
          });

          // Invalidate organization data
          get().invalidateOrganizationData();

          return true;
        } catch (error) {
          console.error("Failed to switch organization:", error);
          return false;
        }
      },
    }),
    {
      name: "mc-app-store-v2.0.0",
      partialize: (state) => ({
        chatModel: state.chatModel || initialState.chatModel,
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
        toolPresets: state.toolPresets || initialState.toolPresets,
        voiceChat: {
          ...initialState.voiceChat,
          ...state.voiceChat,
          threadId: undefined,
          projectId: undefined,
          isOpen: false,
        },
      }),
    },
  ),
);
