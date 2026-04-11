import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '~/stores/editorStore';
import { applyWsEvent } from '~/hooks/useWebSocket';
import type { Character, RecoverySummaryRead, Shot } from '~/types';

describe('applyWsEvent review hydration', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('hydrates currentStage from backend current_stage fields during progress and confirm events', () => {
    applyWsEvent(
      {
        type: 'run_progress',
        data: {
          run_id: 7,
          project_id: 9,
          current_agent: 'director',
          current_stage: 'visualize',
          progress: 0.42,
        },
      },
      useEditorStore.getState()
    );

    expect(useEditorStore.getState().currentStage).toBe('visualize');
    expect(useEditorStore.getState().currentAgent).toBe('director');
    expect(useEditorStore.getState().progress).toBe(0.42);

    const recoverySummary: RecoverySummaryRead = {
      project_id: 9,
      run_id: 7,
      thread_id: 'agent-run-7',
      current_stage: 'animate',
      next_stage: 'deploy',
      preserved_stages: ['ideate'],
      stage_history: [],
      resumable: true,
    };

    applyWsEvent(
      {
        type: 'run_awaiting_confirm',
        data: {
          run_id: 7,
          project_id: 9,
          agent: 'director',
          gate: 'director',
          current_stage: 'animate',
          recovery_summary: recoverySummary,
          preserved_stages: ['ideate'],
          message: '需要你确认下一步',
        },
      },
      useEditorStore.getState()
    );

    expect(useEditorStore.getState().awaitingConfirm).toBe(true);
    expect(useEditorStore.getState().currentStage).toBe('animate');
    expect(useEditorStore.getState().recoverySummary).toEqual(recoverySummary);
  });

  it('hydrates character approval state from websocket updates', () => {
    const character: Character = {
      id: 1,
      project_id: 9,
      name: 'Mika Prime',
      description: 'A confident creator',
      image_url: '/static/characters/mika-approved.png',
      approval_state: 'approved',
      approval_version: 2,
      approved_at: '2026-04-11T10:00:00.000Z',
      approved_name: 'Mika Prime',
      approved_description: 'A confident creator',
      approved_image_url: '/static/characters/mika-approved.png',
    };

    applyWsEvent(
      { type: 'character_updated', data: { character } },
      useEditorStore.getState()
    );

    expect(useEditorStore.getState().characters).toEqual([character]);
  });

  it('hydrates shot approval state from websocket updates', () => {
    const shot: Shot = {
      id: 11,
      project_id: 9,
      order: 1,
      description: 'Opening shot, tightened',
      prompt: 'A tighter opening at dawn',
      image_prompt: 'dawn over a city roof',
      image_url: '/static/shots/11-approved.png',
      video_url: '/static/shots/11-approved.mp4',
      duration: 8.5,
      camera: 'wide',
      motion_note: 'slow pan in',
      character_ids: [1],
      approval_state: 'approved',
      approval_version: 3,
      approved_at: '2026-04-11T10:15:00.000Z',
      approved_description: 'Opening shot',
      approved_prompt: 'A quiet opening at dawn',
      approved_image_prompt: 'dawn over a city roof',
      approved_duration: 8.5,
      approved_camera: 'wide',
      approved_motion_note: 'slow pan in',
      approved_character_ids: [1],
    };

    applyWsEvent({ type: 'shot_updated', data: { shot } }, useEditorStore.getState());

    expect(useEditorStore.getState().shots).toEqual([shot]);
  });
});
