import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { charactersApi, projectsApi, shotsApi } from './api';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('review api helpers', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('keeps the existing fetch endpoints intact and adds approve endpoints', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));
    await projectsApi.getCharacters(9);
    expect((fetchSpy.mock.calls[0][0] as Request).url).toContain('/api/v1/projects/9/characters');

    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 11 }));
    await shotsApi.update(11, { description: 'Updated shot' });
    expect((fetchSpy.mock.calls[1][0] as Request).url).toContain('/api/v1/shots/11');

    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1 }));
    await charactersApi.approve(1);
    expect((fetchSpy.mock.calls[2][0] as Request).url).toContain('/api/v1/characters/1/approve');

    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 11 }));
    await shotsApi.approve(11);
    expect((fetchSpy.mock.calls[3][0] as Request).url).toContain('/api/v1/shots/11/approve');
  });
});
