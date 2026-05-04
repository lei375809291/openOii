import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '~/stores/editorStore';
import type { Character, Shot } from '~/types';

describe('useEditorStore review contract', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('stores server-authored character approval state', () => {
    const draftCharacter: Character = {
      id: 1,
      project_id: 9,
      name: 'Mika',
      description: 'A cautious creator',
      image_url: '/static/characters/mika-draft.png',
      approval_state: 'draft',
      approval_version: 0,
      approved_at: null,
      approved_name: null,
      approved_description: null,
      approved_image_url: null,
    };

    const approvedCharacter: Character = {
      ...draftCharacter,
      name: 'Mika Prime',
      image_url: '/static/characters/mika-approved.png',
      approval_state: 'approved',
      approval_version: 2,
      approved_at: '2026-04-11T10:00:00.000Z',
      approved_name: 'Mika Prime',
      approved_description: 'A confident creator',
      approved_image_url: '/static/characters/mika-approved.png',
    };

    useEditorStore.getState().setCharacters([draftCharacter]);
    useEditorStore.getState().updateCharacter(approvedCharacter);

    expect(useEditorStore.getState().characters[0]).toEqual(approvedCharacter);
  });

  it('stores server-authored shot approval state', () => {
    const draftShot: Shot = {
      id: 11,
      project_id: 9,
      order: 1,
      description: 'Opening shot',
      prompt: 'A quiet opening at dawn',
      image_prompt: 'dawn over a city roof',
      image_url: '/static/shots/11-draft.png',
      video_url: '/static/shots/11-draft.mp4',
      duration: 8.5,
      camera: 'wide',
      motion_note: 'slow pan in',
      scene: null, action: null, expression: null, lighting: null, dialogue: null, sfx: null,
      character_ids: [1],
      approval_state: 'draft',
      approval_version: 0,
      approved_at: null,
      approved_description: null,
      approved_prompt: null,
      approved_image_prompt: null,
      approved_duration: null,
      approved_camera: null,
      approved_motion_note: null,
      approved_scene: null, approved_action: null, approved_expression: null,
      approved_lighting: null, approved_dialogue: null, approved_sfx: null,
      approved_character_ids: [],
    };

    const supersededShot: Shot = {
      ...draftShot,
      description: 'Opening shot, tightened',
      prompt: 'A tighter opening at dawn',
      approval_state: 'superseded',
      approval_version: 3,
      approved_at: '2026-04-11T10:15:00.000Z',
      approved_description: 'Opening shot',
      approved_prompt: 'A quiet opening at dawn',
      approved_image_prompt: 'dawn over a city roof',
      approved_duration: 8.5,
      approved_camera: 'wide',
      approved_motion_note: 'slow pan in',
      approved_scene: null, approved_action: null, approved_expression: null,
      approved_lighting: null, approved_dialogue: null, approved_sfx: null,
      approved_character_ids: [1],
    };

    useEditorStore.getState().setShots([draftShot]);
    useEditorStore.getState().updateShot(supersededShot);

    expect(useEditorStore.getState().shots[0]).toEqual(supersededShot);
  });

  it('toggles runMode between manual and yolo', () => {
    expect(useEditorStore.getState().runMode).toBe('manual');
    useEditorStore.getState().setRunMode('yolo');
    expect(useEditorStore.getState().runMode).toBe('yolo');
    useEditorStore.getState().setRunMode('manual');
    expect(useEditorStore.getState().runMode).toBe('manual');
  });

  it('resetRunState clears run fields without touching data', () => {
    const store = useEditorStore.getState();
    store.setGenerating(true);
    store.setCurrentAgent('director');
    store.setProgress(0.5);
    store.setCurrentRunId(42);
    store.setAwaitingConfirm(true, 'director', 42);
    store.setCharacters([{ id: 1, project_id: 9, name: 'A', description: '', image_url: '', approval_state: 'draft', approval_version: 0, approved_at: null, approved_name: null, approved_description: null, approved_image_url: null }]);

    store.resetRunState();

    const s = useEditorStore.getState();
    expect(s.isGenerating).toBe(false);
    expect(s.currentAgent).toBeNull();
    expect(s.progress).toBe(0);
    expect(s.currentRunId).toBeNull();
    expect(s.awaitingConfirm).toBe(false);
    expect(s.awaitingAgent).toBeNull();
    expect(s.characters).toHaveLength(1);
    expect(s.currentStage).toBe('ideate');
  });
});
