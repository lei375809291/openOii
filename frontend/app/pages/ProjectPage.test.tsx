import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectPage } from './ProjectPage';
import { projectsApi } from '~/services/api';

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
  provider_settings: {
    text: {
      override_key: 'openai',
      effective_key: 'openai',
      source: 'project',
    },
    image: {
      override_key: null,
      effective_key: 'openai',
      source: 'default',
    },
    video: {
      override_key: 'doubao',
      effective_key: 'doubao',
      source: 'project',
    },
  },
  text_provider_override: 'openai',
  image_provider_override: null,
  video_provider_override: 'doubao',
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
const mutateSpy = vi.fn();

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
    mutate: mutateSpy,
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
  useEditorStore: Object.assign(
    (selector?: (state: typeof storeState) => unknown) =>
      selector ? selector(storeState) : storeState,
    {
      getState: () => storeState,
    }
  ),
}));

vi.mock('~/services/api', () => ({
  projectsApi: {
    get: vi.fn(),
    update: vi.fn(),
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
    vi.mocked(projectsApi.update).mockResolvedValue(projectData as never);
  });

  it('renders creator-visible provider proof with effective keys and source badges', () => {
    render(<ProjectPage />);

    expect(screen.getByText('Provider 选择')).toBeInTheDocument();
    expect(screen.getByText('文本')).toBeInTheDocument();
    expect(screen.getByText('图像')).toBeInTheDocument();
    expect(screen.getByText('视频')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('doubao')).toBeInTheDocument();
    expect(screen.getAllByText('项目覆盖')).toHaveLength(2);
    expect(screen.getByText('默认继承')).toBeInTheDocument();
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

  it('saves provider overrides without resetting recovery and live progress state', async () => {
    const user = userEvent.setup();

    render(<ProjectPage />);

    await user.click(screen.getByRole('button', { name: '编辑 Provider' }));
    await user.click(screen.getByRole('radio', { name: '继承默认（当前：OpenAI）' }));
    await user.click(screen.getByRole('button', { name: '保存 Provider 设置' }));

    expect(mutateSpy).toHaveBeenCalledWith({
      text_provider_override: 'openai',
      image_provider_override: null,
      video_provider_override: null,
    });

    expect(storeState.setGenerating).not.toHaveBeenCalled();
    expect(storeState.setProgress).not.toHaveBeenCalled();
    expect(storeState.setRecoveryControl).not.toHaveBeenCalled();
    expect(storeState.setRecoverySummary).not.toHaveBeenCalled();
    expect(storeState.isGenerating).toBe(true);
    expect(storeState.progress).toBe(0.35);
  });
});
