import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import { type ScriptSectionShape } from "./types";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import type { Character, Shot } from "~/types";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusBadgeClass,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

export class ScriptSectionShapeUtil extends ShapeUtil<ScriptSectionShape> {
  static override type = "script-section" as const;

  static override props: RecordProps<ScriptSectionShape> = {
    w: T.number,
    h: T.number,
    summary: T.string,
    characters: T.any,
    shots: T.any,
    sectionState: T.string,
    placeholder: T.boolean,
    statusLabel: T.string,
    placeholderText: T.string,
  };

  getDefaultProps(): ScriptSectionShape["props"] {
    return {
      w: 800,
      h: 600,
      summary: "",
      characters: [],
      shots: [],
      sectionState: "draft",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("draft"),
      placeholderText: getWorkspaceSectionPlaceholderText("script"),
    };
  }

  override canEdit() {
    return false;
  }

  override canResize() {
    return false;
  }

  override hideSelectionBoundsFg() {
    return true;
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  getGeometry(shape: ScriptSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: ScriptSectionShape) {
    const { summary, characters, shots, placeholder, placeholderText, statusLabel, sectionState } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
        }}
        className="h-full"
      >
        <ScriptSectionContent
          summary={summary}
          characters={characters}
          shots={shots}
          placeholder={placeholder}
          placeholderText={placeholderText}
          statusLabel={statusLabel}
          sectionState={sectionState}
        />
      </HTMLContainer>
    );
  }

  indicator() {
    return null;
  }
}

function ScriptSectionContent({
  summary,
  characters,
  shots,
  placeholder,
  placeholderText,
  statusLabel,
  sectionState,
}: {
  summary: string;
  characters: Character[];
  shots: Shot[];
  placeholder: boolean;
  placeholderText: string;
  statusLabel: string;
  sectionState: ScriptSectionShape["props"]["sectionState"];
}) {
  return (
    <div className="card-doodle bg-base-100 p-5 h-full flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <PencilSquareIcon className="w-4 h-4 text-secondary" />
          </div>
          <h2 className="text-lg font-heading font-bold text-base-content">编剧</h2>
        </div>
        <span className={`badge badge-sm ${getWorkspaceSectionStatusBadgeClass(sectionState)}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        {/* 剧本摘要 */}
        {summary && (
          <div>
            <h3 className="text-sm font-bold text-base-content mb-2">剧本摘要</h3>
            <div className="bg-base-200 rounded-lg p-3 border-l-4 border-secondary">
              <p className="text-sm text-base-content/80 whitespace-pre-wrap line-clamp-6">{summary}</p>
            </div>
          </div>
        )}

        {/* 角色列表 */}
        {characters.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-base-content mb-2">角色列表</h3>
            <div className="grid grid-cols-2 gap-3">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="bg-base-200 rounded-lg p-3"
                >
                  <h4 className="font-bold text-sm text-base-content">{char.name}</h4>
                  {char.description && (
                    <p className="text-xs text-base-content/70 mt-1 line-clamp-3">
                      {char.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 分镜描述 */}
        {shots.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-base-content mb-2">分镜描述</h3>
            <div className="space-y-2">
              {[...shots]
                .sort((a, b) => a.order - b.order)
                .map((shot) => (
                  <div
                    key={shot.id}
                    className="flex gap-2 text-sm"
                  >
                    <span className="font-bold text-base-content shrink-0">
                      镜头 {shot.order}
                    </span>
                    <span className="text-base-content/70 border-l-2 border-base-content/20 pl-2 line-clamp-2">
                      {shot.description}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {placeholder && !summary && characters.length === 0 && shots.length === 0 && (
          <div className="text-center py-8 text-base-content/50">
            <p className="text-sm">{placeholderText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
