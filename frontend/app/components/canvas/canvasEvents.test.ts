import { describe, expect, it, vi } from 'vitest';

import { canvasEvents } from './canvasEvents';

describe('canvasEvents review actions', () => {
  it('supports explicit character approval events', () => {
    const handler = vi.fn();

    const unsubscribe = canvasEvents.on('approve-character', handler);
    canvasEvents.emit('approve-character', { id: 1 });

    expect(handler).toHaveBeenCalledWith({ id: 1 });
    unsubscribe();
  });

  it('supports explicit shot approval events', () => {
    const handler = vi.fn();

    const unsubscribe = canvasEvents.on('approve-shot', handler);
    canvasEvents.emit('approve-shot', { id: 11 });

    expect(handler).toHaveBeenCalledWith({ id: 11 });
    unsubscribe();
  });
});
