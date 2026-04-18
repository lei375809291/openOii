import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  FilmIcon,
  MoonIcon,
  PlusIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ConfirmModal } from "~/components/ui/ConfirmModal";
import { projectsApi } from "~/services/api";
import { cleanupDeletedProjectCaches } from "~/features/projects/deleteProject";
import { useSettingsStore } from "~/stores/settingsStore";
import { useSidebarStore } from "~/stores/sidebarStore";
import { useThemeStore } from "~/stores/themeStore";
import type { Project } from "~/types";

export function Sidebar() {
  const { isOpen, toggle } = useSidebarStore();
  const { theme, toggleTheme } = useThemeStore();
  const { openModal: openSettingsModal } = useSettingsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<number[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleSettingsClick = () => {
    openSettingsModal();
  };

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => {
      if (ids.length > 1) {
        return projectsApi.deleteMany(ids);
      }
      return projectsApi.delete(ids[0]);
    },
    onSuccess: (_, deletedIds) => {
      cleanupDeletedProjectCaches(queryClient, deletedIds);
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      setDeleteTarget(null);
      if (deletedIds.some((id) => location.pathname === `/project/${id}`)) {
        navigate("/");
      }
    },
  });

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (deleteMutation.isPending) return;
    setDeleteTarget([id]);
  };

  const handleBatchDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (deleteMutation.isPending || selectedIds.length === 0) return;
    setDeleteTarget([...selectedIds]);
  };

  const handleToggleSelect = (projectId: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, projectId] : prev.filter((id) => id !== projectId),
    );
  };

  const isMultiSelectMode = selectedIds.length > 0;

  useEffect(() => {
    if (!projects) {
      return;
    }

    setSelectedIds((prev) =>
      prev.filter((id) => projects.some((project) => project.id === id)),
    );
  }, [projects]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (!projects) return;
    setSelectedIds(checked ? projects.map((project) => project.id) : []);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget !== null && deleteTarget.length > 0) {
      deleteMutation.mutate(deleteTarget);
    }
  };

  const handleNewProject = () => {
    navigate("/");
  };

  // 从路径中提取当前项目 ID
  const currentProjectId = location.pathname.match(/\/project\/(\d+)/)?.[1];

  return (
    <>
      {/* 收起状态下的展开按钮 */}
      {!isOpen && (
        <button
          onClick={toggle}
          className="fixed top-4 left-4 z-50 p-2 bg-base-100 border-3 border-black rounded-lg shadow-brutal hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer touch-target"
          title="展开侧边栏"
          aria-label="展开侧边栏"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      )}

      {/* 移动端遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed top-0 left-0 h-full bg-base-100 border-r-3 border-black z-40 flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? "w-full sm:w-80 md:w-72 translate-x-0" : "w-full sm:w-80 md:w-72 -translate-x-full"
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b-3 border-black">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-heading font-bold inline-flex items-center gap-2">
              <FilmIcon className="w-6 h-6 text-primary" aria-hidden="true" />
              openOii
            </span>
          </Link>
          <button
            onClick={toggle}
            className="p-2 hover:bg-base-200 rounded-lg transition-colors cursor-pointer"
            title="收起侧边栏"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>

        {/* 新建按钮 */}
        <div className="p-3">
          <button
            onClick={handleNewProject}
            className="w-full flex items-center gap-2 px-4 py-3 bg-primary text-primary-content border-3 border-black rounded-lg shadow-brutal hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-200 font-bold cursor-pointer"
          >
            <PlusIcon className="w-5 h-5" />
            <span>新建故事</span>
          </button>
        </div>

        {/* 项目列表 */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2 px-2">
            历史记录
          </div>

          {selectedIds.length > 0 ? (
            <div className="mx-2 mb-2 px-2 py-2 border border-black bg-base-200 rounded-lg">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-base-content">
                <span>已选 {selectedIds.length} 项</span>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="btn btn-xs"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="btn btn-xs"
                >
                  清空
                </button>
                <button
                  type="button"
                  onClick={(e) => handleBatchDeleteClick(e)}
                  className="btn btn-xs btn-error"
                  disabled={selectedIds.length === 0}
                >
                  删除
                </button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-sm"></span>
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="space-y-1">
              {projects.map((project: Project) => {
                const isActive = currentProjectId === String(project.id);
                const rowChecked = selectedIds.includes(project.id);
                const rowClassName = `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-primary/20 border-2 border-black"
                    : "hover:bg-base-200 border-2 border-transparent"
                }`;

                const rowContent = (
                  <>
                    <input
                      type="checkbox"
                      checked={rowChecked}
                      onChange={(e) => handleToggleSelect(project.id, e.target.checked)}
                      className="checkbox checkbox-xs"
                    />
                    <ChatBubbleLeftRightIcon className="w-4 h-4 flex-shrink-0 text-base-content/60" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{project.title}</div>
                      {project.story && (
                        <div className="text-xs text-base-content/50 truncate">
                          {project.story.slice(0, 30)}
                          {project.story.length > 30 ? "..." : ""}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteClick(project.id, e)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-error/20 rounded transition-all cursor-pointer"
                      title="删除"
                    >
                      <TrashIcon className="w-4 h-4 text-error" />
                    </button>
                  </>
                );

                return isMultiSelectMode ? (
                  <div
                    key={project.id}
                    className={rowClassName}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("input,button,a")) {
                        return;
                      }
                      handleToggleSelect(project.id, !rowChecked);
                    }}
                  >
                    {rowContent}
                  </div>
                ) : (
                  <Link key={project.id} to={`/project/${project.id}`} className={rowClassName}>
                    {rowContent}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/50">
              <ChatBubbleLeftRightIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">还没有项目</p>
              <p className="text-xs">点击上方按钮创作第一个故事</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-3 border-t-3 border-black space-y-3">
          {/* 设置按钮 - 涂鸦风格 */}
          <button
            onClick={handleSettingsClick}
            className="w-full flex items-center gap-3 px-4 py-3 bg-base-200 hover:bg-base-300 border-3 border-base-content/30 rounded-lg shadow-brutal-sm hover:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
            title="系统设置"
            aria-label="系统设置"
          >
            <Cog6ToothIcon className="w-5 h-5 text-accent group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-medium text-sm">系统设置</span>
          </button>

          {/* 主题切换 */}
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-base-content/60 font-medium">主题模式</span>
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-base-200 hover:bg-base-300 border-2 border-base-content/20 rounded-lg transition-all duration-200 cursor-pointer"
              title={theme === "doodle" ? "切换到深色模式" : "切换到浅色模式"}
              aria-label={
                theme === "doodle" ? "切换到深色模式" : "切换到浅色模式"
              }
            >
              {theme === "doodle" ? (
                <MoonIcon className="w-5 h-5" />
              ) : (
                <SunIcon className="w-5 h-5 text-warning" />
              )}
            </button>
          </div>

          {/* 底部标语 */}
          <div className="text-xs text-center text-base-content/50 font-sketch flex items-center justify-center gap-1 pt-1">
            <span>openOii - AI 漫剧生成器</span>
            <SparklesIcon className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
      </aside>

      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="删除项目"
        message={`确定要删除选中的${deleteTarget ? deleteTarget.length : 0}个项目吗？删除后无法恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
