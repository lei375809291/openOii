// 事件类型定义 — 只保留仍在使用的事件
export interface CanvasEvents {
  "preview-image": { src: string; alt: string };
  "preview-video": { src: string; title: string };
}

type EventCallback<T> = (data: T) => void;

// 事件总线单例
class CanvasEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<keyof CanvasEvents, Set<EventCallback<any>>> = new Map();

  on<K extends keyof CanvasEvents>(
    event: K,
    callback: EventCallback<CanvasEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit<K extends keyof CanvasEvents>(event: K, data: CanvasEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback(data);
      });
    }
  }

  off<K extends keyof CanvasEvents>(
    event: K,
    callback?: EventCallback<CanvasEvents[K]>
  ): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const canvasEvents = new CanvasEventBus();
