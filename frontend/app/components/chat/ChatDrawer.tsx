import { XMarkIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useEditorStore } from "~/stores/editorStore";
import { ChatPanel } from "~/components/chat/ChatPanel";
import { BoltIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";

interface ChatDrawerProps {
  onSendFeedback: (content: string) => void;
  onConfirm: (feedback?: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  generateDisabled?: boolean;
  generateDisabledReason?: string;
}

export function ChatDrawer({
  onSendFeedback,
  onConfirm,
  onGenerate,
  onCancel,
  isGenerating,
  generateDisabled = false,
  generateDisabledReason,
}: ChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { awaitingConfirm, runMode, setRunMode } = useEditorStore();

  useEffect(() => {
    if (awaitingConfirm && runMode === "manual") {
      setIsOpen(true);
    }
  }, [awaitingConfirm, runMode]);

  useEffect(() => {
    if (isGenerating && !isOpen) {
      setIsOpen(true);
    }
  }, [isGenerating]);

  return (
    <>
      {!isOpen && (
        <button
          className="absolute top-3 right-3 z-30 btn btn-sm btn-circle btn-ghost bg-base-100/80 backdrop-blur-sm border border-base-300 shadow-sm hover:shadow-brutal transition-shadow"
          onClick={() => setIsOpen(true)}
          aria-label="打开对话面板"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5" />
        </button>
      )}

      {isOpen && (
        <div className="absolute top-0 right-0 z-30 h-full w-full sm:w-96 flex flex-col bg-base-100/95 backdrop-blur-md border-l-2 border-base-300 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-base-300">
            <div className="flex items-center gap-2">
              <span className="text-sm font-heading font-semibold">对话</span>
              <button
                className={`btn btn-xs ${runMode === "yolo" ? "btn-warning" : "btn-ghost"}`}
                onClick={() => setRunMode(runMode === "yolo" ? "manual" : "yolo")}
                title={runMode === "yolo" ? "切换手动模式" : "切换YOLO模式"}
                aria-label={runMode === "yolo" ? "切换手动模式" : "切换YOLO模式"}
              >
                {runMode === "yolo" ? (
                  <BoltIcon className="w-3.5 h-3.5" />
                ) : (
                  <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                )}
                <span className="text-xs">{runMode === "yolo" ? "YOLO" : "手动"}</span>
              </button>
            </div>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={() => setIsOpen(false)}
              aria-label="关闭对话面板"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatPanel
              onSendFeedback={onSendFeedback}
              onConfirm={onConfirm}
              onGenerate={onGenerate}
              onCancel={onCancel}
              isGenerating={isGenerating}
              generateDisabled={generateDisabled}
              generateDisabledReason={generateDisabledReason}
            />
          </div>
        </div>
      )}
    </>
  );
}
