import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from './Sidebar';
import type { Project } from '~/types';

const listMock = vi.fn();
const deleteMock = vi.fn();
const deleteManyMock = vi.fn();
const invalidateQueries = vi.fn();
const removeQueries = vi.fn();
const openSettingsModal = vi.fn();
const toggleTheme = vi.fn();
const navigate = vi.fn();

let queryState: {
  data: Project[] | undefined;
  isLoading: boolean;
};

const buildProject = (id: number): Project => ({
  id,
  title: `Project ${id}`,
  story: `Story ${id}`,
  style: 'cinematic',
  summary: null,
  video_url: null,
  status: 'active',
  target_shot_count: null,
  character_hints: [],
  created_at: '2026-04-11T00:00:00Z',
  updated_at: '2026-04-11T00:00:00Z',
  provider_settings: {
    text: {
      selected_key: 'anthropic',
      source: 'default',
      resolved_key: 'anthropic',
      valid: true,
      reason_code: null,
      reason_message: null,
    },
    image: {
      selected_key: 'openai',
      source: 'default',
      resolved_key: 'openai',
      valid: true,
      reason_code: null,
      reason_message: null,
    },
    video: {
      selected_key: 'openai',
      source: 'default',
      resolved_key: 'openai',
      valid: true,
      reason_code: null,
      reason_message: null,
    },
  },
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries, removeQueries }),
  useQuery: () => queryState,
  useMutation: (options: {
    mutationFn: (ids: number[]) => Promise<unknown>;
    onSuccess?: (data: unknown, ids: number[]) => void;
  }) => ({
    mutate: async (ids: number[]) => {
      const result = await options.mutationFn(ids);
      options.onSuccess?.(result, ids);
    },
    isPending: false,
  }),
}));

vi.mock('~/services/api', () => ({
  projectsApi: {
    list: () => listMock(),
    delete: (id: number) => deleteMock(id),
    deleteMany: (ids: number[]) => deleteManyMock(ids),
  },
}));

vi.mock('~/stores/sidebarStore', () => ({
  useSidebarStore: () => ({
    isOpen: true,
    toggle: vi.fn(),
  }),
}));

vi.mock('~/stores/themeStore', () => ({
  useThemeStore: () => ({
    theme: 'doodle',
    toggleTheme,
  }),
}));

vi.mock('~/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    openModal: openSettingsModal,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useLocation: () => ({ pathname: '/project/1' }),
    useNavigate: () => navigate,
  };
});

describe('Sidebar history selection and batch delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState = {
      data: [buildProject(1), buildProject(2)],
      isLoading: false,
    };
    listMock.mockResolvedValue(queryState.data);
    deleteMock.mockResolvedValue(undefined);
    deleteManyMock.mockResolvedValue(undefined);
  });

  it('supports single delete and keeps the current single-delete path', async () => {
    const user = userEvent.setup();

    render(<Sidebar />);

    await user.click(screen.getAllByTitle('删除')[0]);
    expect(screen.getByText('确定要删除选中的1个项目吗？删除后无法恢复。')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '删除' }).at(-1) as HTMLButtonElement);

    expect(deleteMock).toHaveBeenCalledWith(1);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it('opens batch action toolbar after selecting and supports batch delete', async () => {
    const user = userEvent.setup();

    render(<Sidebar />);

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(screen.getByText('已选 1 项')).toBeInTheDocument();
    const selectAllButton = screen.getByRole('button', { name: '全选' });
    await user.click(selectAllButton);

    const batchDeleteButtons = screen
      .getAllByRole('button', { name: '删除' })
      .filter((button) => button.classList.contains('btn-error'));
    const batchDeleteButton = batchDeleteButtons.at(-1);
    expect(batchDeleteButton).toBeDefined();
    expect(batchDeleteButton).toBeEnabled();
    await user.click(batchDeleteButton as HTMLButtonElement);

    expect(screen.getByText('确定要删除选中的2个项目吗？删除后无法恢复。')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '删除' }).at(-1) as HTMLButtonElement);

    expect(deleteManyMock).toHaveBeenCalledWith([1, 2]);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('prevents navigation when in multi-select mode and keeps row click as selection action', async () => {
    const user = userEvent.setup();

    const { rerender: rerenderSidebar } = render(<Sidebar />);

    const firstRowLink = screen.getByText('Project 1').closest('a');
    expect(firstRowLink).not.toBeNull();

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    await user.click(firstCheckbox);

    await user.click(screen.getAllByRole('checkbox')[1]);
    rerenderSidebar(<Sidebar />);

    const firstRowContainer = screen.getByText('Project 1').closest('div');
    expect(firstRowContainer).not.toBeNull();

    await user.click(firstRowContainer as Element);
    expect(screen.getByText('已选 1 项')).toBeInTheDocument();

    const stillFirstRowLink = screen.getByText('Project 1').closest('a');
    expect(stillFirstRowLink).toBeNull();
  });

  it('cleans up stale selections when project list refreshes', async () => {
    const user = userEvent.setup();

    const { rerender } = render(<Sidebar />);

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    const selectAllButton = screen.getByRole('button', { name: '全选' });
    await user.click(selectAllButton);

    expect(
      screen.getByText((_, element) =>
        element?.textContent?.replace(/\s+/g, "") === "已选2项",
      ),
    ).toBeInTheDocument();

    queryState.data = [buildProject(1)];
    rerender(<Sidebar />);

    expect(
      screen.getByText((_, element) =>
        element?.textContent?.replace(/\s+/g, "") === "已选1项",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('已选 2 项')).not.toBeInTheDocument();
  });
});
