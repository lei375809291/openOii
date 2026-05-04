import { useEffect, useRef, useCallback } from "react";
import { useEditorStore, type RunMode } from "~/stores/editorStore";
import type {
  Character,
  ProjectProviderSettings,
  RecoverySummaryRead,
  RunAwaitingConfirmEventData,
  RunConfirmedEventData,
  RunProgressEventData,
  Shot,
  WsEvent,
  WorkflowStage,
} from "~/types";
import { toast } from "~/utils/toast";
import { isWorkflowStage } from "~/utils/workflowStage";
import { getWsBase } from "~/utils/runtimeBase";

const WS_BASE = getWsBase();
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

let messageIdCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

const globalConnections = new Map<number, WebSocket>();

const YOLO_AUTO_AGENTS = new Set(["scriptwriter", "video_generator"]);

function shouldAutoConfirm(agent: string | null, runMode: RunMode): boolean {
  if (runMode === "yolo") return true;
  return YOLO_AUTO_AGENTS.has(agent ?? "");
}

export function useProjectWebSocket(projectId: number | null) {
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef<(data: Record<string, unknown>) => void>(() => {});

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const clearAutoConfirm = useCallback(() => {
    if (autoConfirmTimerRef.current) {
      clearTimeout(autoConfirmTimerRef.current);
      autoConfirmTimerRef.current = null;
    }
  }, []);

  const scheduleAutoConfirm = useCallback((runId: number) => {
    clearAutoConfirm();
    autoConfirmTimerRef.current = setTimeout(() => {
      sendRef.current({ type: "confirm", data: { run_id: runId } });
    }, 1500);
  }, [clearAutoConfirm]);

  const connect = useCallback(() => {
    if (!projectId) return;
    clearReconnectTimer();

    const existingWs = globalConnections.get(projectId);
    let ws = existingWs;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      ws = new WebSocket(`${WS_BASE}/ws/projects/${projectId}`);
      globalConnections.set(projectId, ws);
    }

    ws.onopen = () => {
      const wasReconnecting = reconnectAttempts.current > 0;
      if (import.meta.env.DEV) {
        console.log("[WS] 已连接到项目", projectId);
      }
      reconnectAttempts.current = 0;
      if (wasReconnecting) {
        toast.success({ title: "重新连接成功", message: "可以继续创作了", duration: 2000 });
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WsEvent = JSON.parse(event.data);
        applyWsEvent(data, useEditorStore.getState(), scheduleAutoConfirm);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("[WS] 解析错误:", e);
        }
        toast.error({
          title: "数据格式错误",
          message: "服务器返回了无法识别的数据，请刷新页面重试",
          duration: 3000,
        });
      }
    };

    ws.onerror = (error) => {
      if (import.meta.env.DEV) {
        console.error("[WS] 连接错误:", error);
      }
      toast.error({
        title: "无法连接到服务器",
        message: "请检查网络连接，或稍后重试",
        duration: 0,
        actions: [{ label: "重新连接", onClick: () => { reconnectAttempts.current = 0; connect(); } }],
      });
    };

    ws.onclose = () => {
      if (import.meta.env.DEV) {
        console.log("[WS] 连接断开");
      }
      globalConnections.delete(projectId);

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        if (import.meta.env.DEV) {
          console.log(`[WS] ${RECONNECT_DELAY / 1000}秒后尝试重连 (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
        }
        toast.warning({
          title: "连接中断",
          message: `正在重新连接 (尝试 ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`,
          duration: RECONNECT_DELAY,
        });
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      } else {
        toast.error({
          title: "连接失败",
          message: "多次尝试后仍无法连接。请检查网络后刷新页面",
          duration: 0,
          actions: [{ label: "刷新页面", onClick: () => window.location.reload() }],
        });
      }
    };
  }, [projectId, clearReconnectTimer, scheduleAutoConfirm]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    clearAutoConfirm();
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS;
    if (projectId) {
      const ws = globalConnections.get(projectId);
      if (ws) {
        ws.close();
        globalConnections.delete(projectId);
      }
    }
  }, [projectId, clearReconnectTimer, clearAutoConfirm]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (!projectId) return;
    const ws = globalConnections.get(projectId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, [projectId]);

  sendRef.current = send;

  useEffect(() => {
    reconnectAttempts.current = 0;
    connect();
    return () => {
      clearReconnectTimer();
    };
  }, [connect, clearReconnectTimer]);

  return { send, disconnect, reconnect: connect, clearAutoConfirm };
}

function clearLoadingStates(
  store: ReturnType<typeof useEditorStore.getState>,
  agentFilter?: string
): void {
  const currentMessages = useEditorStore.getState().messages;
  const updatedMessages = currentMessages.map((msg) => {
    if (msg.isLoading && (!agentFilter || msg.agent === agentFilter)) {
      return { ...msg, isLoading: false };
    }
    return msg;
  });
  if (updatedMessages.some((msg, idx) => msg !== currentMessages[idx])) {
    store.setMessages(updatedMessages);
  }
}

function resolveEventStage(data: Record<string, unknown>): WorkflowStage | undefined {
  const stage = data.stage ?? data.current_stage;
  if (isWorkflowStage(stage)) return stage;
  return undefined;
}

function applyStage(store: ReturnType<typeof useEditorStore.getState>, data: Record<string, unknown>) {
  const stage = resolveEventStage(data);
  if (stage) store.setCurrentStage(stage);
}

type AutoConfirmFn = (runId: number) => void;

export function applyWsEvent(
  event: WsEvent,
  store: ReturnType<typeof useEditorStore.getState>,
  autoConfirm: AutoConfirmFn,
): void {
  switch (event.type) {
    case "connected":
      break;

    case "error": {
      const code = event.data.code as string | undefined;
      const msg = event.data.message as string | undefined;
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "error",
        content: msg || code || "Unknown error",
        timestamp: new Date().toISOString(),
      });
      toast.error({ title: "服务器错误", message: msg || code || "" });
      break;
    }

    case "run_started":
      store.setGenerating(true);
      store.setProgress(0);
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "separator",
        content: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        timestamp: new Date().toISOString(),
      });
      store.setCurrentRunId(event.data.run_id as number);
      store.setCurrentAgent((event.data.current_agent as string | null) ?? null);
      store.setAwaitingConfirm(false);
      store.setRecoveryGate(null);
      applyStage(store, event.data);
      if (event.data.recovery_summary) {
        store.setRecoverySummary(event.data.recovery_summary as RecoverySummaryRead);
      }
      if (Object.hasOwn(event.data, "provider_snapshot")) {
        store.setCurrentRunProviderSnapshot(event.data.provider_snapshot as ProjectProviderSettings | null);
      }
      break;

    case "run_progress": {
      const p = event.data as unknown as RunProgressEventData;
      if (!store.isGenerating && p.run_id) {
        store.setGenerating(true);
        store.setCurrentRunId(p.run_id);
      }
      store.setCurrentAgent(p.current_agent ?? null);
      store.setProgress(p.progress);
      if (p.recovery_summary) store.setRecoverySummary(p.recovery_summary);
      applyStage(store, event.data);
      break;
    }

    case "run_message": {
      const agent = event.data.agent as string;
      clearLoadingStates(store, agent);
      const msgProgress = event.data.progress as number | undefined;
      if (typeof msgProgress === "number" && msgProgress >= 0 && msgProgress <= 1) {
        store.setProgress(msgProgress);
      }
      store.addMessage({
        id: generateMessageId(),
        agent,
        role: event.data.role as string,
        content: event.data.content as string,
        summary: (event.data.summary as string | undefined) ?? undefined,
        timestamp: new Date().toISOString(),
        progress: msgProgress,
        isLoading: event.data.isLoading as boolean | undefined,
      });
      break;
    }

    case "agent_handoff":
      clearLoadingStates(store);
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "handoff",
        content: event.data.message as string,
        timestamp: new Date().toISOString(),
      });
      break;

    case "run_awaiting_confirm": {
      clearLoadingStates(store);
      const gate = event.data as unknown as RunAwaitingConfirmEventData;
      if (!store.isGenerating) {
        store.setGenerating(true);
        store.setCurrentRunId(gate.run_id);
      }
      store.setAwaitingConfirm(true, gate.agent, gate.run_id);
      store.setRecoveryGate(gate);
      store.setRecoverySummary(gate.recovery_summary);
      applyStage(store, event.data);
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "info",
        content: event.data.message as string,
        timestamp: new Date().toISOString(),
      });

      if (shouldAutoConfirm(gate.agent, store.runMode)) {
        autoConfirm(gate.run_id);
      }
      break;
    }

    case "run_confirmed": {
      const confirmed = event.data as unknown as RunConfirmedEventData;
      store.setAwaitingConfirm(false);
      store.setRecoveryGate(null);
      if (confirmed.recovery_summary) store.setRecoverySummary(confirmed.recovery_summary);
      applyStage(store, event.data);
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "info",
        content: "已确认，继续执行...",
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case "run_completed": {
      clearLoadingStates(store);
      store.resetRunState();
      store.setProgress(1);
      const completedStage = event.data?.current_stage as string | undefined;
      if (completedStage && isWorkflowStage(completedStage)) {
        store.setCurrentStage(completedStage);
      } else {
        store.setCurrentStage("merge");
      }
      if (typeof event.data?.message === "string" && event.data.message.trim()) {
        store.addMessage({
          id: generateMessageId(),
          agent: "system",
          role: "assistant",
          content: event.data.message,
          timestamp: new Date().toISOString(),
        });
      }
      break;
    }

    case "run_failed":
      clearLoadingStates(store);
      store.resetRunState();
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "error",
        content: `生成失败: ${event.data.error}`,
        timestamp: new Date().toISOString(),
      });
      toast.error({
        title: "生成失败",
        message: (event.data.error as string) || "未知错误",
        duration: 5000,
      });
      break;

    case "run_cancelled":
      clearLoadingStates(store);
      store.resetRunState();
      store.setProgress(0);
      store.addMessage({
        id: generateMessageId(),
        agent: "system",
        role: "info",
        content: "生成已停止",
        timestamp: new Date().toISOString(),
      });
      break;

    case "character_created":
    case "character_updated":
      if (event.data.character) {
        store.updateCharacter(event.data.character as Character);
      }
      break;

    case "shot_created":
    case "shot_updated":
      if (event.data.shot) {
        store.updateShot(event.data.shot as Shot);
      }
      break;

    case "character_deleted": {
      const charId = event.data.character_id as number | undefined;
      if (charId !== undefined) {
        store.setCharacters(store.characters.filter((c) => c.id !== charId));
      }
      break;
    }

    case "shot_deleted": {
      const shotId = event.data.shot_id as number | undefined;
      if (shotId !== undefined) {
        store.setShots(store.shots.filter((s) => s.id !== shotId));
      }
      break;
    }

    case "data_cleared": {
      const clearedTypes = event.data.cleared_types as string[] | undefined;
      if (clearedTypes) {
        if (clearedTypes.includes("characters")) store.setCharacters([]);
        if (clearedTypes.includes("shots")) store.setShots([]);
      }
      store.setProjectVideoUrl(null);
      break;
    }

    case "project_updated": {
      const projectData = event.data.project as {
        video_url?: string;
        title?: string;
        status?: string;
        summary?: string;
        story?: string;
        style?: string;
        blocking_clips?: Array<{ shot_id: number; order: number; status: string; reason: string }>;
      } | undefined;
      if (projectData) {
        if (projectData.video_url !== undefined) {
          store.setProjectVideoUrl(projectData.video_url || null);
        }
        if (projectData.status !== undefined) {
          store.setProjectStatus(projectData.status);
        }
      }
      store.setProjectUpdatedAt(Date.now());
      break;
    }
  }
}
