---
status: testing
phase: 01-foundation-project-bootstrap
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-04-11T05:29:56Z
updated: 2026-04-11T05:51:00Z
---

## Current Test

number: 7
name: Reveal a Sensitive Value
expected: |
  Clicking the eye icon on a sensitive config item reveals the real value for that
  field and shows a warning that the raw value is currently visible.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running frontend/backend processes, then start the application from scratch. The backend should boot without schema/bootstrap errors, the frontend should load normally, and you should be able to reach the homepage or project creation flow instead of seeing an immediate startup failure.
result: pass

### 2. Create Project from Story Input
expected: In the project creation flow, entering 项目标题 / 故事内容 / 风格 and clicking 创建项目 creates a project successfully, shows a success confirmation, and does not return a validation or server error.
result: pass

### 3. Creation Redirects into Workspace
expected: After project creation, the app navigates to the new `/project/:id` workspace and the first-load autoStart handoff completes instead of leaving the page stuck in a loading or retry loop.
result: pass

### 4. Project Appears in History
expected: The newly created project appears in the sidebar 历史记录 with its title and a short story excerpt, so it can be reopened from the project list.
result: pass

### 5. Open Provider Settings
expected: From the project page, clicking the sidebar 系统设置 button opens 环境变量配置管理 and loads grouped tabs such as 数据库 / 文本生成 / 图像服务 / 视频服务.
result: pass

### 6. Sensitive Values Stay Masked by Default
expected: Sensitive config items are not shown in plain text by default. They appear as masked values or placeholder dots and include the eye icon / helper text instead of exposing the raw secret immediately.
result: pass

### 7. Reveal a Sensitive Value
expected: Clicking the eye icon on a sensitive config item reveals the real value for that field and shows a warning that the raw value is currently visible.
result: [pending]

### 8. Save a Provider Configuration Change
expected: Editing a config value and clicking 保存配置 returns a visible confirmation (either immediate success or restart-required warning) instead of failing silently.
result: [pending]

## Summary

total: 8
passed: 6
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

[]
