import { useState, useRef, useEffect } from "react";
import { useEditorStore } from "~/stores/editorStore";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { Button } from "~/components/ui/Button";
import type { WorkflowStage } from "~/types";
import {
  CheckIcon,
  LightBulbIcon,
  PaintBrushIcon,
  RocketLaunchIcon,
  StopIcon,
  BoltIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import { getWorkflowStageInfo } from "~/utils/workflowStage";

interface ChatPanelProps {
  onSendFeedback: (content: string) => void;
  onConfirm: (feedback?: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  generateDisabled?: boolean;
  generateDisabledReason?: string;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

function getStageIcon(stage: WorkflowStage) {
  if (stage === "compose") return RocketLaunchIcon;
  if (stage === "render" || stage === "render_approval") return PaintBrushIcon;
  if (stage === "plan" || stage === "plan_approval") return LightBulbIcon;
  return LightBulbIcon;
}

const agentNameMap: Record<string, string> = {
  plan: "规划",
  render: "渲染",
  compose: "合成",
  review: "审查",
};

export function ChatPanel({
  onSendFeedback,
  onConfirm,
  onGenerate,
  onCancel,
  isGenerating,
  generateDisabled = false,
  generateDisabledReason,
  isPaused = false,
  onPause,
  onResume: _onResume,
}: ChatPanelProps) {
  const generateDisabledReasonId = generateDisabledReason ? "generate-disabled-reason" : undefined;
  const {
    messages,
    currentAgent,
    awaitingConfirm,
    awaitingAgent,
    currentStage,
    currentRunId,
    runMode,
  } = useEditorStore();

  const setRunMode = useEditorStore((s) => s.setRunMode);
  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (currentRunId || isGenerating || awaitingConfirm) {
      onConfirm(input.trim());
      setInput("");
      return;
    }
    onSendFeedback(input);
    setInput("");
  };

  const info = getWorkflowStageInfo(currentStage);
  const StageIcon = getStageIcon(currentStage);
  const hasMessages = messages.length > 0;
  const agentDisplayName = awaitingAgent ? agentNameMap[awaitingAgent] || awaitingAgent : "";
  const currentAgentDisplayName = currentAgent ? agentNameMap[currentAgent] || currentAgent : "";
  const isYolo = runMode === "yolo";

  const awaitingSummary = awaitingAgent
    ? [...messages].reverse().find((m) => m.agent === awaitingAgent && m.summary)?.summary
    : undefined;

  const showManualConfirm = awaitingConfirm && !isYolo;

  return (
    <div className="flex flex-col h-full bg-base-200 rounded-box shadow-lg">
      {/* Stage Header */}
      <div className="p-3 sm:p-4 border-b border-base-300">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading font-semibold text-primary text-sm sm:text-base">
            <span className="inline-flex items-center gap-2">
              <StageIcon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              {info.title}
            </span>
          </h3>

          <button
            type="button"
            onClick={() => setRunMode(isYolo ? "manual" : "yolo")}
            className={`btn btn-xs gap-1 ${isYolo ? "btn-primary" : "btn-ghost"}`}
            aria-label={isYolo ? "切换手动模式" : "切换YOLO模式"}
            title={isYolo ? "YOLO模式：自动确认所有阶段" : "手动模式：每个阶段需要确认"}
          >
            {isYolo ? (
              <>
                <BoltIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">YOLO</span>
              </>
            ) : (
              <>
                <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">手动</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs sm:text-sm text-base-content/80">{info.description}</p>

        <div className="mt-3 flex flex-col gap-2 text-sm text-base-content/70">
          {isGenerating && !awaitingConfirm && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="loading loading-dots loading-xs" />
                <span>{currentAgentDisplayName || "处理中"}...</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancel}
                className="text-error hover:bg-error/10 gap-1 min-w-[44px] min-h-[44px]"
                aria-label="停止生成"
              >
                <StopIcon className="w-5 h-5" aria-hidden="true" />
                <span>停止</span>
              </Button>
            </div>
          )}

          {isYolo && isGenerating && !awaitingConfirm && (
            <span className="badge badge-primary badge-outline badge-sm gap-1 w-fit">
              <BoltIcon className="w-3 h-3" />
              自动模式
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4">
        {!hasMessages && !isGenerating ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                <StageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-lg sm:text-xl font-heading font-bold mb-2">
                准备好了吗？
              </h2>
              <p className="text-sm sm:text-base text-base-content/80 mb-4 sm:mb-6 max-w-xs">
                {isYolo
                  ? "点击开始，AI 会全自动生成剧本、角色、分镜和视频"
                  : "点击开始，AI 会根据你的故事自动生成剧本、角色和分镜"}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={onGenerate}
                disabled={generateDisabled}
                className="gap-2 touch-target"
                aria-label="开始生成漫剧"
                aria-describedby={generateDisabledReasonId}
              >
                <RocketLaunchIcon className="w-5 h-5" aria-hidden="true" />
                <span>开始生成</span>
              </Button>
              {generateDisabledReason ? (
                <p id={generateDisabledReasonId} className="mt-3 max-w-xs text-xs text-warning" aria-live="polite">
                  当前无法开始生成：{generateDisabledReason}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>

      {/* Manual Confirm Bar */}
      {showManualConfirm && (
        <div className="p-3 sm:p-4 border-t border-base-300 bg-warning/20">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-warning badge-sm text-warning-content">等待确认</span>
              <span className="font-medium text-xs sm:text-sm">{agentDisplayName} 已完成</span>
            </div>
            {awaitingSummary ? (
              <p className="text-xs sm:text-sm text-base-content/80 mb-2">{awaitingSummary}</p>
            ) : (
              <p className="text-xs sm:text-sm text-base-content/80 mb-2">
                请在右侧查看生成结果。满意的话点击下方按钮继续
              </p>
            )}
            <p className="text-xs text-base-content/60">
              <span className="inline-flex items-center gap-1">
                <LightBulbIcon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                需要修改？在下方输入框描述调整意见后点击发送
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const feedback = input.trim();
                onConfirm(feedback || undefined);
                setInput("");
              }}
              className="flex-1 touch-target"
            >
              <span className="inline-flex items-center gap-2">
                <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                <span className="hidden sm:inline">满意，继续下一步</span>
                <span className="sm:hidden">继续</span>
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* YOLO pause */}
      {awaitingConfirm && isYolo && isPaused && onPause && (
        <div className="p-3 sm:p-4 border-t border-base-300 bg-primary/10">
          <div className="flex items-center gap-2 text-xs text-base-content/70">
            <BoltIcon className="w-4 h-4" />
            <span>YOLO 模式已暂停</span>
            <Button size="sm" variant="ghost" onClick={onPause} className="ml-auto">
              继续
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-base-300">
        <MessageInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={false}
          placeholder={
            awaitingConfirm
              ? "输入修改意见..."
              : isGenerating
                ? "输入反馈..."
                : "输入你的想法..."
          }
        />
      </div>
    </div>
  );
}
