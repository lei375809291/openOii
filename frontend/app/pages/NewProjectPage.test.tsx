import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewProjectPage } from './NewProjectPage';
import { projectsApi } from '~/services/api';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('~/services/api', () => ({
  projectsApi: {
    create: vi.fn(),
  },
}));

vi.mock('~/utils/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NewProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the current bootstrap payload and navigates on success', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(projectsApi.create).mockResolvedValue({ id: 7 } as never);

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <NewProjectPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('项目标题'), 'Bootstrap Story');
    await user.type(screen.getByPlaceholderText('很久很久以前...'), 'A creator starts a new comic-drama.');
    await user.click(screen.getByRole('button', { name: '下一步 →' }));
    await user.click(screen.getByRole('button', { name: '下一步 →' }));
    await user.click(screen.getByRole('button', { name: '创建项目' }));

    const [payload] = vi.mocked(projectsApi.create).mock.calls[0];
    expect(payload).toEqual({
      title: 'Bootstrap Story',
      story: 'A creator starts a new comic-drama.',
      style: 'cinematic',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
    expect(mockNavigate).toHaveBeenCalledWith('/project/7?autoStart=true');
  });
});
