import { useState } from "react";
import type { ComponentType, SVGProps } from "react";

type ActionVariant = "primary" | "secondary" | "accent" | "ghost" | "error";

// 支持 heroicons 风格的图标组件
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

interface ActionItem {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  variant?: ActionVariant;
  loading?: boolean;
}

interface HoverActionBarProps {
  actions: ActionItem[];
  children: React.ReactNode;
  className?: string;
}

export function HoverActionBar({
  actions,
  children,
  className,
}: HoverActionBarProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative ${className || ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <div
        className={`absolute top-1.5 right-1.5 z-[var(--z-dropdown)] flex items-center gap-0.5 rounded-[var(--radius-md)] border border-base-content/10 bg-base-100/95 p-0.5 shadow-brutal-sm transition-all duration-200 ${
          isHovered
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        {actions.map((action, index) => {
          const btnColor =
            action.variant === "error"
              ? "btn-error"
              : `btn-${action.variant || "ghost"}`;

          const Icon = action.icon;

          return (
            <div key={index} className="tooltip" data-tip={action.label}>
              <button
                type="button"
                className={`btn btn-xs btn-circle h-7 min-h-7 w-7 ${btnColor} ${
                  action.loading ? "loading" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  action.onClick();
                }}
                disabled={action.loading}
                aria-label={action.label}
              >
                {!action.loading && <Icon className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
