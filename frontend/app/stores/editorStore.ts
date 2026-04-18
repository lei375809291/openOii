import { create } from "zustand";
import type {
  AgentMessage,
  Character,
  ProjectProviderSettings,
  RecoveryControlRead,
  RecoverySummaryRead,
  RunAwaitingConfirmEventData,
  Shot,
  WorkflowStage,
} from "~/types";

interface EditorState {
  // Selection state
  selectedShotId: number | null;
  selectedCharacterId: number | null;
  highlightedMessageIndex: number | null;

  // Agent state
  isGenerating: boolean;
  currentStage: WorkflowStage;
  currentAgent: string | null;
  progress: number;
  messages: AgentMessage[];

  // Recovery state
  recoveryControl: RecoveryControlRead | null;
  recoverySummary: RecoverySummaryRead | null;
  recoveryGate: RunAwaitingConfirmEventData | null;

  // 确认状态
  awaitingConfirm: boolean;
  awaitingAgent: string | null;
  currentRunId: number | null;
  currentRunProviderSnapshot: ProjectProviderSettings | null;

  // Data cache
  characters: Character[];
  shots: Shot[];
  projectVideoUrl: string | null;  // 最终拼接视频 URL
  projectUpdatedAt: number | null; // 项目更新时间戳（用于触发刷新）

  // Actions
  setSelectedShot: (id: number | null) => void;
  setSelectedCharacter: (id: number | null) => void;
  setHighlightedMessage: (index: number | null) => void;
  setGenerating: (isGenerating: boolean) => void;
  setCurrentStage: (stage: WorkflowStage) => void;
  setCurrentAgent: (agent: string | null) => void;
  setProgress: (progress: number) => void;
  addMessage: (message: AgentMessage) => void;
  setMessages: (messages: AgentMessage[]) => void;
  clearMessages: () => void;
  setRecoveryControl: (control: RecoveryControlRead | null) => void;
  setRecoverySummary: (summary: RecoverySummaryRead | null) => void;
  setRecoveryGate: (gate: RunAwaitingConfirmEventData | null) => void;
  setCharacters: (characters: Character[]) => void;
  setShots: (shots: Shot[]) => void;
  setProjectVideoUrl: (url: string | null) => void;
  setProjectUpdatedAt: (timestamp: number) => void;
  setAwaitingConfirm: (awaiting: boolean, agent?: string | null, runId?: number | null) => void;
  setCurrentRunId: (runId: number | null) => void;
  setCurrentRunProviderSnapshot: (snapshot: ProjectProviderSettings | null) => void;
  // 精细化控制 Actions
  updateCharacter: (character: Character) => void;
  updateShot: (shot: Shot) => void;
  removeCharacter: (characterId: number) => void;
  removeShot: (shotId: number) => void;
  reset: () => void;
}

const initialState = {
  selectedShotId: null,
  selectedCharacterId: null,
  highlightedMessageIndex: null,
  isGenerating: false,
  currentStage: "ideate" as WorkflowStage,
  currentAgent: null,
  progress: 0,
  messages: [],
  recoveryControl: null,
  recoverySummary: null,
  recoveryGate: null,
  awaitingConfirm: false,
  awaitingAgent: null,
  currentRunId: null,
  currentRunProviderSnapshot: null,
  characters: [],
  shots: [],
  projectVideoUrl: null,
  projectUpdatedAt: null,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,

  setSelectedShot: (id) => set({ selectedShotId: id }),
  setSelectedCharacter: (id) => set({ selectedCharacterId: id }),
  setHighlightedMessage: (index) => set({ highlightedMessageIndex: index }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setCurrentStage: (stage) => set({ currentStage: stage }),
  setCurrentAgent: (agent) => set({ currentAgent: agent }),
  setProgress: (progress) => set({ progress }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [], highlightedMessageIndex: null }),
  setRecoveryControl: (control) => set({ recoveryControl: control }),
  setRecoverySummary: (summary) => set({ recoverySummary: summary }),
  setRecoveryGate: (gate) => set({ recoveryGate: gate }),
  setCharacters: (characters) => set({ characters }),
  setShots: (shots) => set({ shots }),
  setProjectVideoUrl: (url) => set({ projectVideoUrl: url }),
  setProjectUpdatedAt: (timestamp) => set({ projectUpdatedAt: timestamp }),
  setAwaitingConfirm: (awaiting, agent = null, runId) =>
    set((state) => ({
      awaitingConfirm: awaiting,
      awaitingAgent: agent,
      currentRunId: runId !== undefined ? runId : state.currentRunId
    })),
  setCurrentRunId: (runId) => set({ currentRunId: runId }),
  setCurrentRunProviderSnapshot: (snapshot) => set({ currentRunProviderSnapshot: snapshot }),
  // 精细化控制 Actions
  updateCharacter: (character) =>
    set((state) => ({
      characters: state.characters.some((c) => c.id === character.id)
        ? state.characters.map((c) => (c.id === character.id ? character : c))
        : [...state.characters, character],
    })),
  updateShot: (shot) =>
    set((state) => ({
      shots: state.shots.some((s) => s.id === shot.id)
        ? state.shots.map((s) => (s.id === shot.id ? shot : s))
        : [...state.shots, shot],
    })),
  removeCharacter: (characterId) =>
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== characterId),
    })),
  removeShot: (shotId) =>
    set((state) => ({
      shots: state.shots.filter((s) => s.id !== shotId),
    })),
  reset: () => set(initialState),
}));
