import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MessageList } from "./MessageList";

vi.mock("~/components/ui/TypewriterText", () => ({
  TypewriterText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("./CollapsibleMessage", () => ({
  CollapsibleMessage: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const baseMsg = {
  id: "m1",
  project_id: 1,
  agent: "plan",
  role: "assistant" as const,
  content: "Hello world this is a very long message that should trigger typewriter effect because it exceeds fifty chars minimum",
  isLoading: false,
  timestamp: new Date().toISOString(),
};

describe("MessageList", () => {
  it("renders empty state", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText("暂无消息")).toBeInTheDocument();
  });

  it("renders messages", () => {
    render(<MessageList messages={[baseMsg]} />);
    expect(screen.getByText(baseMsg.content)).toBeInTheDocument();
  });

  it("renders separator role as divider", () => {
    const sep = { ...baseMsg, id: "sep1", role: "separator" as const, content: "---" };
    const { container } = render(<MessageList messages={[sep]} />);
    expect(container.querySelector(".border-t-2")).toBeInTheDocument();
  });

  it("renders handoff role as badge", () => {
    const handoff = { ...baseMsg, id: "h1", role: "handoff" as const, content: "切换到编剧" };
    render(<MessageList messages={[handoff]} />);
    expect(screen.getByText("切换到编剧")).toBeInTheDocument();
  });

  it("returns null for system info messages", () => {
    const sysInfo = { ...baseMsg, id: "s1", role: "info" as const, agent: "system" };
    const { container } = render(<MessageList messages={[sysInfo]} />);
    expect(container.querySelector(".chat")).toBeNull();
  });

  it("renders loading indicator for loading messages", () => {
    const loading = { ...baseMsg, isLoading: true };
    render(<MessageList messages={[loading]} />);
    expect(screen.getByText("处理中")).toBeInTheDocument();
  });

  it("renders agent badge with correct text", () => {
    render(<MessageList messages={[baseMsg]} />);
    expect(screen.getByText("plan")).toBeInTheDocument();
  });
});
