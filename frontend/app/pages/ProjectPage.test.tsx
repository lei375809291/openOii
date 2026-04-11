import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectPage } from './ProjectPage';

const invalidateQueries = vi.fn();
const setSearchParams = vi.fn();
const projectData = {
  id: 9,
  title: 'Realtime Story',
  story: 'A story about live progress syncing.',
  style: 'cinematic',
  summary: 'A story about live progress syncing.',
  video_url: null,
  status: 'active',
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
};
const emptyCharacters: never[] = [];
const emptyShots: never[] = [];
const emptyMessages: never[] = [];
const storeState = {
  isGenerating: false,
  progress: 0,
  currentStage: 'ideate',
  currentAgent: null,
  awaitingConfirm: false,
  awaitingAgent: null,
  currentRunId: null as number | null,
  recoveryControl: null,
  recoverySummary: null,
  recoveryGate: null,
  projectUpdatedAt: null as number | null,
  characters: emptyCharacters,
  shots: emptyShots,
  projectVideoUrl: null,
  messages: emptyMessages,
  clearMessages: vi.fn(),
  setGenerating: vi.fn(),
  setProgress: vi.fn(),
  setCurrentAgent: vi.fn(),
  setCurrentStage: vi.fn(),
  setAwaitingConfirm: vi.fn(),
  setCurrentRunId: vi.fn(),
  setSelectedShot: vi.fn(),
  setSelectedCharacter: vi.fn(),
  setHighlightedMessage: vi.fn(),
  setProjectVideoUrl: vi.fn(),
  setCharacters: vi.fn(),
  setShots: vi.fn(),
  setRecoveryControl: vi.fn(),
  setRecoverySummary: vi.fn(),
  setRecoveryGate: vi.fn(),
  setProjectUpdatedAt: vi.fn((timestamp: number) => {
    storeState.projectUpdatedAt = timestamp;
  }),
  addMessage: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useParams: () => ({ id: '9' }),
    useSearchParams: () => [new URLSearchParams(), setSearchParams],
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useQuery: ({ queryKey }: { queryKey: [string, number] }) => {
    if (queryKey[0] === 'project') {
      return {
        data: projectData,
        isLoading: false,
        error: null,
      };
    }

    if (queryKey[0] === 'characters') {
      return { data: emptyCharacters, isLoading: false, error: null };
    }

    if (queryKey[0] === 'shots') {
      return { data: emptyShots, isLoading: false, error: null };
    }

    if (queryKey[0] === 'messages') {
      return { data: emptyMessages, isLoading: false, error: null };
    }

    return { data: undefined, isLoading: false, error: null };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('~/hooks/useWebSocket', () => ({
  useProjectWebSocket: () => ({
    send: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  }),
}));

vi.mock('~/stores/editorStore', () => ({
  useEditorStore: (selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

vi.mock('~/services/api', () => ({
  projectsApi: {
    get: vi.fn(),
    getCharacters: vi.fn(),
    getShots: vi.fn(),
    getMessages: vi.fn(),
    generate: vi.fn(),
    feedback: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
  },
}));

vi.mock('~/components/chat/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}));

vi.mock('~/components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('~/components/layout/StageView', () => ({
  StageView: () => <div data-testid="stage-view" />,
}));

vi.mock('~/components/settings/SettingsModal', () => ({
  SettingsModal: () => null,
}));

describe('ProjectPage live hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.isGenerating = true;
    storeState.progress = 0.35;
    storeState.currentStage = 'visualize';
    storeState.projectUpdatedAt = null;
  });

  it('invalidates project caches when projectUpdatedAt changes without clobbering live progress state', async () => {
    const { rerender } = render(<ProjectPage />);

    storeState.projectUpdatedAt = Date.now();
    rerender(<ProjectPage />);

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['project', 9] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    });

    expect(storeState.isGenerating).toBe(true);
    expect(storeState.progress).toBe(0.35);
    expect(storeState.currentStage).toBe('visualize');
  });
});
