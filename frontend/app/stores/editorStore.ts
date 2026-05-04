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

export type RunMode = "manual" | "yolo";

interface EditorState {
  selectedShotId: number | null;
  selectedCharacterId: number | null;
  highlightedMessageIndex: number | null;
  isGenerating: boolean;
  currentStage: WorkflowStage;
  currentAgent: string | null;
  progress: number;
  messages: AgentMessage[];
  recoveryControl: RecoveryControlRead | null;
  recoverySummary: RecoverySummaryRead | null;
  recoveryGate: RunAwaitingConfirmEventData | null;
  awaitingConfirm: boolean;
  awaitingAgent: string | null;
  currentRunId: number | null;
  currentRunProviderSnapshot: ProjectProviderSettings | null;
  runMode: RunMode;
  characters: Character[];
  shots: Shot[];
  projectVideoUrl: string | null;
  projectStatus: string | null;
  projectUpdatedAt: number | null;

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
  setProjectStatus: (status: string | null) => void;
  setProjectUpdatedAt: (timestamp: number) => void;
  setAwaitingConfirm: (awaiting: boolean, agent?: string | null, runId?: number | null) => void;
  setCurrentRunId: (runId: number | null) => void;
  setCurrentRunProviderSnapshot: (snapshot: ProjectProviderSettings | null) => void;
  setRunMode: (mode: RunMode) => void;
  updateCharacter: (character: Character) => void;
  updateShot: (shot: Shot) => void;
  removeCharacter: (characterId: number) => void;
  removeShot: (shotId: number) => void;
  resetRunState: () => void;
  reset: () => void;
}

const initialRunState = {
  isGenerating: false,
  currentAgent: null,
  progress: 0,
  recoveryControl: null,
  recoverySummary: null,
  recoveryGate: null,
  awaitingConfirm: false,
  awaitingAgent: null,
  currentRunId: null,
  currentRunProviderSnapshot: null,
};

const initialState = {
  selectedShotId: null,
  selectedCharacterId: null,
  highlightedMessageIndex: null,
  currentStage: "ideate" as WorkflowStage,
  runMode: "manual" as RunMode,
  messages: [],
  characters: [],
  shots: [],
  projectVideoUrl: null,
  projectStatus: null,
  projectUpdatedAt: null,
  ...initialRunState,
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
  setProjectStatus: (status) => set({ projectStatus: status }),
  setProjectUpdatedAt: (timestamp) => set({ projectUpdatedAt: timestamp }),
  setAwaitingConfirm: (awaiting, agent = null, runId) =>
    set((state) => ({
      awaitingConfirm: awaiting,
      awaitingAgent: agent,
      currentRunId: runId !== undefined ? runId : state.currentRunId
    })),
  setCurrentRunId: (runId) => set({ currentRunId: runId }),
  setCurrentRunProviderSnapshot: (snapshot) => set({ currentRunProviderSnapshot: snapshot }),
  setRunMode: (mode) => set({ runMode: mode }),
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
  resetRunState: () => set(initialRunState),
  reset: () => set(initialState),
}));
