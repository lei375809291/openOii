import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Tldraw, type Editor, type TLComponents, type TLShapePartial } from "tldraw";
import "tldraw/tldraw.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEditorStore } from "~/stores/editorStore";
import {
  projectsApi,
  shotsApi,
  charactersApi,
  getStaticUrl,
} from "~/services/api";
import { customShapeUtils } from "./shapes";
import { useCanvasLayout } from "~/hooks/useCanvasLayout";
import { buildWorkspaceStatus } from "~/utils/workspaceStatus";
import { CanvasToolbar } from "./CanvasToolbar";
import type { Character, Shot } from "~/types";
import { EditModal } from "~/components/ui/EditModal";
import { ConfirmModal } from "~/components/ui/ConfirmModal";
import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";
import { canvasEvents } from "./canvasEvents";

interface InfiniteCanvasProps {
  projectId: number;
}

// 隐藏 tldraw 默认 UI
const components: TLComponents = {
  PageMenu: null,
  MainMenu: null,
  Toolbar: null,
  StylePanel: null,
  NavigationPanel: null,
  HelpMenu: null,
  DebugPanel: null,
  DebugMenu: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  ActionsMenu: null,
  QuickActions: null,
  KeyboardShortcutsDialog: null,
  HelperButtons: null,
  ZoomMenu: null,
};

export function InfiniteCanvas({ projectId }: InfiniteCanvasProps) {
  const editorRef = useRef<Editor | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastAppliedShapesSignatureRef = useRef<string | null>(null);
  const shapesRef = useRef<TLShapePartial[]>([]);
  const shapesSignatureRef = useRef("");

  // Store 数据
  const {
    characters,
    shots,
    projectVideoUrl,
    currentStage,
    isGenerating,
    recoverySummary,
    updateCharacter,
    updateShot,
    removeCharacter,
    removeShot,
  } = useEditorStore();

  // 项目数据
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  // Modal 状态
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(null);
  const [deletingShot, setDeletingShot] = useState<Shot | null>(null);

  // Mutations
  const updateCharacterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Character> }) =>
      charactersApi.update(id, data),
    onSuccess: (updatedChar) => {
      updateCharacter(updatedChar);
      setEditingCharacter(null);
    },
  });

  const regenerateCharacterMutation = useMutation({
    mutationFn: (id: number) => charactersApi.regenerate(id),
  });

  const approveCharacterMutation = useMutation({
    mutationFn: (id: number) => charactersApi.approve(id),
    onSuccess: (approvedCharacter) => {
      updateCharacter(approvedCharacter);
    },
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: (id: number) => charactersApi.delete(id),
    onSuccess: (_, deletedId) => {
      removeCharacter(deletedId);
      setDeletingCharacter(null);
    },
  });

  const updateShotMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Shot> }) =>
      shotsApi.update(id, data),
    onSuccess: (updatedShot) => {
      updateShot(updatedShot);
      setEditingShot(null);
    },
  });

  const regenerateShotMutation = useMutation({
    mutationFn: ({ id, type }: { id: number; type: "image" | "video" }) =>
      shotsApi.regenerate(id, type),
  });

  const approveShotMutation = useMutation({
    mutationFn: (id: number) => shotsApi.approve(id),
    onSuccess: (approvedShot) => {
      updateShot(approvedShot);
    },
  });

  const deleteShotMutation = useMutation({
    mutationFn: (id: number) => shotsApi.delete(id),
    onSuccess: (_, deletedId) => {
      removeShot(deletedId);
      setDeletingShot(null);
    },
  });

  // 视频 URL
  const rawVideoUrl = projectVideoUrl || project?.video_url;
  const finalVideoUrl = rawVideoUrl ? getStaticUrl(rawVideoUrl) : null;

  // 计算布局
  const shapes = useCanvasLayout({
    summary: project?.summary || null,
    characters,
    shots,
    videoUrl: finalVideoUrl,
    videoTitle: project?.title || "最终视频",
    workspaceStatus: useMemo(() => {
      if (!project) {
        return undefined;
      }

      return buildWorkspaceStatus({
        project,
        currentStage: recoverySummary?.current_stage ?? currentStage,
        runState: project.status || (isGenerating ? "running" : "draft"),
        characters,
        shots,
        recoverySummary,
      });
    }, [project, recoverySummary, currentStage, isGenerating, characters, shots]),
  });
  const shapesSignature = useMemo(() => JSON.stringify(shapes), [shapes]);
  shapesRef.current = shapes;
  shapesSignatureRef.current = shapesSignature;

  // 监听类型安全的画布事件
  useEffect(() => {
    const unsubscribers = [
      canvasEvents.on("preview-image", setPreviewImage),
      canvasEvents.on("preview-video", setPreviewVideo),
      canvasEvents.on("edit-character", setEditingCharacter),
      canvasEvents.on("approve-character", (data) => {
        approveCharacterMutation.mutate(data.id);
      }),
      canvasEvents.on("regenerate-character", (id) => {
        regenerateCharacterMutation.mutate(id);
      }),
      canvasEvents.on("delete-character", setDeletingCharacter),
      canvasEvents.on("edit-shot", setEditingShot),
      canvasEvents.on("approve-shot", (data) => {
        approveShotMutation.mutate(data.id);
      }),
      canvasEvents.on("regenerate-shot", (data) => {
        regenerateShotMutation.mutate(data);
      }),
      canvasEvents.on("delete-shot", setDeletingShot),
    ];

    return () => {
      unsubscribers.forEach((unsub) => {
        unsub();
      });
    };
  }, [approveCharacterMutation, approveShotMutation, regenerateCharacterMutation, regenerateShotMutation]);

  // 初始化画布
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      const currentShapes = shapesRef.current;
      const currentSignature = shapesSignatureRef.current;

      // 创建初始 shapes
      if (currentShapes.length > 0) {
        editor.createShapes(currentShapes as any);
        lastAppliedShapesSignatureRef.current = currentSignature;

        // 缩放到适合视图
        setTimeout(() => {
          editor.zoomToFit({ animation: { duration: 300 } });
        }, 100);
      } else {
        lastAppliedShapesSignatureRef.current = currentSignature;
      }

      setIsInitialized(true);
    },
    []
  );

  // 数据变化时更新画布
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isInitialized) return;
    if (lastAppliedShapesSignatureRef.current === shapesSignature) return;

    // 获取当前所有 shape
    const currentShapes = editor.getCurrentPageShapes();
    const currentIds = new Set(currentShapes.map((s) => s.id));
    const newIds = new Set(shapes.map((s) => s.id));

    // 删除不再存在的 shapes
    const toDelete = currentShapes.filter((s) => !newIds.has(s.id));
    if (toDelete.length > 0) {
      editor.deleteShapes(toDelete.map((s) => s.id));
    }

    // 更新或创建 shapes
    shapes.forEach((shape) => {
      if (currentIds.has(shape.id as any)) {
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          props: shape.props,
        } as any);
      } else {
        editor.createShape(shape as any);
      }
    });

    lastAppliedShapesSignatureRef.current = shapesSignature;
  }, [shapes, shapesSignature, isInitialized]);

  return (
    <>
      <div className="h-full w-full infinite-canvas-container relative">
        <Tldraw
          shapeUtils={customShapeUtils}
          components={components}
          onMount={handleMount}
          hideUi
        >
          <CanvasToolbar />
        </Tldraw>
      </div>

      {/* 图片预览 Modal */}
      {previewImage && (
        <ImagePreviewModal
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* 视频预览 Modal */}
      {previewVideo && (
        <VideoPreviewModal
          src={previewVideo.src}
          title={previewVideo.title}
          onClose={() => setPreviewVideo(null)}
          showDownload={false}
        />
      )}

      {/* 角色编辑 Modal */}
      {editingCharacter && (
        <EditModal
          isOpen={true}
          onClose={() => setEditingCharacter(null)}
          onSave={async (data) => {
            await updateCharacterMutation.mutateAsync({
              id: editingCharacter.id,
              data: { name: data.name, description: data.description },
            });
          }}
          title="编辑角色"
          fields={[
            { name: "name", label: "角色名称", type: "text" },
            { name: "description", label: "角色描述", type: "textarea" },
          ]}
          initialData={{
            name: editingCharacter.name,
            description: editingCharacter.description || "",
          }}
          isLoading={updateCharacterMutation.isPending}
        />
      )}

      {/* 分镜编辑 Modal */}
      {editingShot && (
        <EditModal
          isOpen={true}
          onClose={() => setEditingShot(null)}
          onSave={async (data) => {
            await updateShotMutation.mutateAsync({
              id: editingShot.id,
              data: {
                description: data.description,
                prompt: data.prompt,
                image_prompt: data.image_prompt,
              },
            });
          }}
          title="编辑分镜"
          fields={[
            { name: "description", label: "分镜描述", type: "textarea" },
            { name: "prompt", label: "视频提示词", type: "textarea" },
            { name: "image_prompt", label: "图片提示词", type: "textarea" },
          ]}
          initialData={{
            description: editingShot.description,
            prompt: editingShot.prompt || "",
            image_prompt: editingShot.image_prompt || "",
          }}
          isLoading={updateShotMutation.isPending}
        />
      )}

      {/* 删除确认 Modals */}
      {deletingCharacter && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeletingCharacter(null)}
          onConfirm={async () => {
            await deleteCharacterMutation.mutateAsync(deletingCharacter.id);
          }}
          title="删除角色"
          message={`确定要删除角色「${deletingCharacter.name}」吗？此操作不可撤销。`}
          confirmText="删除"
          variant="danger"
          isLoading={deleteCharacterMutation.isPending}
        />
      )}

      {deletingShot && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeletingShot(null)}
          onConfirm={async () => {
            await deleteShotMutation.mutateAsync(deletingShot.id);
          }}
          title="删除分镜"
          message={`确定要删除「镜头 ${deletingShot.order}」吗？此操作不可撤销。`}
          confirmText="删除"
          variant="danger"
          isLoading={deleteShotMutation.isPending}
        />
      )}
    </>
  );
}
