from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent, CompletionInfo
from app.agents.prompts.plan import SYSTEM_PROMPT
from app.agents.utils import extract_json
from app.db.utils import utcnow
from app.models.project import Character, Shot


def _character_to_description(item: dict) -> str:
    parts: list[str] = []
    for key in ["personality_traits", "goals", "fears", "voice_notes", "costume_notes"]:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(f"{key}: {value.strip()}")
        elif isinstance(value, list):
            vals = [v for v in value if isinstance(v, str) and v.strip()]
            if vals:
                parts.append(f"{key}: {', '.join(vals)}")

    description = item.get("description")
    if isinstance(description, str) and description.strip():
        parts.insert(0, description.strip())

    return "\n".join(parts) if parts else json.dumps(item, ensure_ascii=False)


def _compose_image_prompt(shot_data: dict, visual_bible: str) -> str:
    if isinstance(shot_data.get("image_prompt"), str) and shot_data["image_prompt"].strip():
        return shot_data["image_prompt"].strip()

    parts = []
    scene = shot_data.get("scene")
    if isinstance(scene, str) and scene.strip():
        parts.append(scene.strip())
    action = shot_data.get("action")
    if isinstance(action, str) and action.strip():
        parts.append(action.strip())
    expression = shot_data.get("expression")
    if isinstance(expression, str) and expression.strip():
        parts.append(expression.strip())
    camera = shot_data.get("camera")
    if isinstance(camera, str) and camera.strip():
        parts.append(camera.strip())
    lighting = shot_data.get("lighting")
    if isinstance(lighting, str) and lighting.strip():
        parts.append(lighting.strip())

    if parts:
        composed = "，".join(parts)
        if visual_bible:
            composed = f"{composed}。{visual_bible}"
        return composed

    return shot_data.get("description", "")


def _compose_video_prompt(shot_data: dict) -> str:
    if isinstance(shot_data.get("video_prompt"), str) and shot_data["video_prompt"].strip():
        return shot_data["video_prompt"].strip()

    parts = []
    camera = shot_data.get("camera")
    if isinstance(camera, str) and camera.strip():
        parts.append(camera.strip())
    action = shot_data.get("action")
    if isinstance(action, str) and action.strip():
        parts.append(action.strip())

    if parts:
        return "，".join(parts)

    return shot_data.get("description", "")


class PlanAgent(BaseAgent):
    name = "plan"

    async def _get_existing_state(self, ctx: AgentContext) -> dict[str, Any]:
        char_res = await ctx.session.execute(
            select(Character).where(Character.project_id == ctx.project.id)
        )
        characters = [
            {"id": c.id, "name": c.name, "description": c.description}
            for c in char_res.scalars().all()
        ]

        shot_res = await ctx.session.execute(
            select(Shot).where(Shot.project_id == ctx.project.id).order_by(Shot.order)
        )
        shots = [
            {
                "id": s.id,
                "order": s.order,
                "description": s.description,
                "scene": s.scene,
                "action": s.action,
                "expression": s.expression,
                "camera": s.camera,
                "lighting": s.lighting,
                "dialogue": s.dialogue,
                "sfx": s.sfx,
            }
            for s in shot_res.scalars().all()
        ]

        return {"characters": characters, "shots": shots}

    async def _apply_incremental_changes(
        self, ctx: AgentContext, data: dict, visual_bible: str
    ) -> tuple[int, int]:
        preserve_ids = data.get("preserve_ids") or {}
        preserve_char_ids = set(preserve_ids.get("characters") or [])
        preserve_shot_ids = set(preserve_ids.get("shots") or [])

        char_res = await ctx.session.execute(
            select(Character).where(Character.project_id == ctx.project.id)
        )
        deleted_char_ids = []
        for char in char_res.scalars().all():
            if char.id not in preserve_char_ids:
                deleted_char_ids.append(char.id)
                await ctx.session.delete(char)

        deleted_shot_ids = []
        shot_res = await ctx.session.execute(select(Shot).where(Shot.project_id == ctx.project.id))
        for shot in shot_res.scalars().all():
            if shot.id not in preserve_shot_ids:
                deleted_shot_ids.append(shot.id)
                await ctx.session.delete(shot)

        await ctx.session.flush()

        for char_id in deleted_char_ids:
            await ctx.ws.send_event(
                ctx.project.id,
                {"type": "character_deleted", "data": {"character_id": char_id}},
            )
        for shot_id in deleted_shot_ids:
            await ctx.ws.send_event(
                ctx.project.id,
                {"type": "shot_deleted", "data": {"shot_id": shot_id}},
            )

        new_char_count = 0
        raw_characters = data.get("characters") or []
        if isinstance(raw_characters, list):
            for item in raw_characters:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                if not (isinstance(name, str) and name.strip()):
                    continue
                char_id = item.get("id")
                if char_id is None:
                    new_char = Character(
                        project_id=ctx.project.id,
                        name=name.strip(),
                        description=_character_to_description(item),
                        image_url=None,
                    )
                    ctx.session.add(new_char)
                    new_char_count += 1
                else:
                    existing_char = await ctx.session.get(Character, char_id)
                    if existing_char and existing_char.project_id == ctx.project.id:
                        existing_char.name = name.strip()
                        existing_char.description = _character_to_description(item)
                        ctx.session.add(existing_char)

        await ctx.session.flush()

        new_shot_count = 0
        raw_shots = data.get("shots") or []
        if isinstance(raw_shots, list):
            for idx, shot_data in enumerate(raw_shots):
                if not isinstance(shot_data, dict):
                    continue
                shot_id = shot_data.get("id")
                shot_desc = shot_data.get("description")
                if not (isinstance(shot_desc, str) and shot_desc.strip()):
                    continue
                shot_order = (
                    shot_data.get("order") if isinstance(shot_data.get("order"), int) else idx + 1
                )
                image_prompt = _compose_image_prompt(shot_data, visual_bible)
                video_prompt = _compose_video_prompt(shot_data)

                if shot_id is None:
                    new_shot = Shot(
                        project_id=ctx.project.id,
                        order=shot_order,
                        description=shot_desc.strip(),
                        prompt=video_prompt,
                        image_prompt=image_prompt,
                        scene=shot_data.get("scene"),
                        action=shot_data.get("action"),
                        expression=shot_data.get("expression"),
                        camera=shot_data.get("camera"),
                        lighting=shot_data.get("lighting"),
                        dialogue=shot_data.get("dialogue"),
                        sfx=shot_data.get("sfx"),
                        video_url=None,
                        image_url=None,
                    )
                    ctx.session.add(new_shot)
                    new_shot_count += 1
                else:
                    existing_shot = await ctx.session.get(Shot, shot_id)
                    if existing_shot and existing_shot.project_id == ctx.project.id:
                        existing_shot.order = shot_order
                        existing_shot.description = shot_desc.strip()
                        existing_shot.prompt = video_prompt
                        existing_shot.image_prompt = image_prompt
                        existing_shot.scene = shot_data.get("scene")
                        existing_shot.action = shot_data.get("action")
                        existing_shot.expression = shot_data.get("expression")
                        existing_shot.camera = shot_data.get("camera")
                        existing_shot.lighting = shot_data.get("lighting")
                        existing_shot.dialogue = shot_data.get("dialogue")
                        existing_shot.sfx = shot_data.get("sfx")
                        ctx.session.add(existing_shot)

        await ctx.session.flush()
        return new_char_count, new_shot_count

    async def _call_plan_llm(self, ctx: AgentContext) -> dict[str, Any]:
        """Call LLM for planning and cache the result in ctx."""
        is_incremental = ctx.rerun_mode == "incremental"
        payload: dict[str, Any] = {
            "project": {
                "id": ctx.project.id,
                "title": ctx.project.title,
                "story": ctx.project.story,
                "style": ctx.project.style,
                "status": ctx.project.status,
                "target_shot_count": getattr(ctx.project, "target_shot_count", None),
                "character_hints": getattr(ctx.project, "character_hints", None) or None,
            },
            "mode": ctx.rerun_mode,
        }
        if ctx.user_feedback:
            payload["user_feedback"] = ctx.user_feedback

        if is_incremental:
            existing_state = await self._get_existing_state(ctx)
            payload["existing_state"] = existing_state

        user_prompt = json.dumps(payload, ensure_ascii=False)
        resp = await self.call_llm(
            ctx, system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt, max_tokens=4096
        )
        data = extract_json(resp.text)

        # Apply project updates from LLM
        project_update = data.get("project_update") or {}
        updated_fields: dict = {}
        if isinstance(project_update, dict):
            for key in ("title", "style", "status", "summary"):
                val = project_update.get(key)
                if isinstance(val, str) and val.strip():
                    setattr(ctx.project, key, val.strip())
                    updated_fields[key] = val.strip()

        if "status" not in updated_fields:
            ctx.project.status = "planning"
            updated_fields["status"] = ctx.project.status

        ctx.project.updated_at = utcnow()
        ctx.session.add(ctx.project)
        await ctx.session.commit()

        if updated_fields:
            await ctx.ws.send_event(
                ctx.project.id,
                {
                    "type": "project_updated",
                    "data": {"project": {"id": ctx.project.id, **updated_fields}},
                },
            )

        # Cache for run_shots()
        ctx.plan_data = data
        return data

    async def run_characters(self, ctx: AgentContext) -> None:
        is_incremental = ctx.rerun_mode == "incremental"
        if is_incremental:
            await self.send_message(ctx, "正在增量更新角色...", progress=0.0, is_loading=True)
        else:
            await self.send_message(ctx, "正在规划角色设定...", progress=0.0, is_loading=True)

        data = await self._call_plan_llm(ctx)
        user_message = data.get("user_message") or ""

        if is_incremental:
            visual_bible = data.get("visual_bible") or ""
            new_char_count, _ = await self._apply_incremental_changes(ctx, data, visual_bible)

            char_res = await ctx.session.execute(
                select(Character).where(Character.project_id == ctx.project.id)
            )
            final_chars = list(char_res.scalars().all())
            for char in final_chars:
                await self.send_character_event(ctx, char, "character_updated")

            char_names = [c.name for c in final_chars]
            ctx.completion_info = CompletionInfo(
                completed=user_message or "角色增量更新完成",
                details=f"更新后共 {len(final_chars)} 个角色",
                next="接下来生成分镜脚本",
                question="角色设定是否满意？",
            )
            await self.send_message(
                ctx,
                user_message or f"角色更新完成（{len(final_chars)} 个）",
                summary=f"{len(final_chars)} 个角色",
                progress=1.0,
            )
            return

        raw_characters = data.get("characters") or []
        lines: list[str] = []
        new_characters: list[Character] = []
        if isinstance(raw_characters, list) and raw_characters:
            char_names: list[str] = []
            for item in raw_characters:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                if not (isinstance(name, str) and name.strip()):
                    continue
                char_names.append(name.strip())
                new_characters.append(
                    Character(
                        project_id=ctx.project.id,
                        name=name.strip(),
                        description=_character_to_description(item),
                        image_url=None,
                    )
                )
            if new_characters:
                ctx.session.add_all(new_characters)
                await ctx.session.flush()
                for character in new_characters:
                    await self.send_character_event(ctx, character, "character_created")
                lines.append(f"角色：{', '.join(char_names)}")

        ctx.completion_info = CompletionInfo(
            completed=user_message or "角色设定已生成",
            details=f"共 {len(new_characters) if isinstance(raw_characters, list) else 0} 个角色",
            next="接下来生成分镜脚本",
            question="角色设定是否满意？",
        )
        await self.send_message(
            ctx, user_message or "\n".join(lines) or "角色规划完成", progress=1.0
        )

    async def run_shots(self, ctx: AgentContext) -> None:
        data = getattr(ctx, "plan_data", None)
        if not data:
            raise RuntimeError(
                "run_shots called without cached plan_data; run_characters must run first"
            )

        is_incremental = ctx.rerun_mode == "incremental"
        visual_bible = data.get("visual_bible") or ""
        user_message = data.get("user_message") or ""

        if is_incremental:
            await self.send_message(ctx, "正在增量更新分镜...", progress=0.0, is_loading=True)
            _, new_shot_count = await self._apply_incremental_changes(ctx, data, visual_bible)

            shot_res = await ctx.session.execute(
                select(Shot).where(Shot.project_id == ctx.project.id).order_by(Shot.order.asc())
            )
            final_shots = list(shot_res.scalars().all())
            for shot in final_shots:
                await self.send_shot_event(ctx, shot, "shot_updated")

            lines = [f"{len(final_shots)} 个分镜"]
            summary = ctx.project.summary or f"{len(final_shots)}个分镜"
            ctx.completion_info = CompletionInfo(
                completed=user_message or "分镜增量更新完成",
                details=f"更新后共 {len(final_shots)} 个分镜",
                next="接下来为角色和分镜生成参考图片",
                question="分镜是否符合预期？",
            )
            await self.send_message(
                ctx,
                user_message or "\n".join(lines) or "分镜更新完成",
                summary=summary,
                progress=1.0,
            )
            return

        await self.send_message(ctx, "正在生成分镜脚本...", progress=0.0, is_loading=True)

        raw_shots = data.get("shots") or []
        if not isinstance(raw_shots, list) or not raw_shots:
            raise ValueError("LLM 响应未返回任何分镜")

        new_shots: list[Shot] = []
        fallback_order = 1
        for idx, shot_data in enumerate(raw_shots):
            if not isinstance(shot_data, dict):
                continue
            shot_desc = shot_data.get("description")
            if not (isinstance(shot_desc, str) and shot_desc.strip()):
                continue
            order = shot_data.get("order")
            if isinstance(order, int) and order > 0:
                shot_order = order
            else:
                shot_order = fallback_order
            fallback_order = max(fallback_order, shot_order + 1)

            image_prompt = _compose_image_prompt(shot_data, visual_bible)
            video_prompt = _compose_video_prompt(shot_data)

            new_shots.append(
                Shot(
                    project_id=ctx.project.id,
                    order=shot_order,
                    description=shot_desc.strip(),
                    prompt=video_prompt,
                    image_prompt=image_prompt,
                    scene=shot_data.get("scene"),
                    action=shot_data.get("action"),
                    expression=shot_data.get("expression"),
                    camera=shot_data.get("camera"),
                    lighting=shot_data.get("lighting"),
                    dialogue=shot_data.get("dialogue"),
                    sfx=shot_data.get("sfx"),
                    video_url=None,
                    image_url=None,
                )
            )

        if not new_shots:
            raise ValueError("LLM 响应的分镜列表为空或无效")

        new_shots.sort(key=lambda s: s.order)
        ctx.session.add_all(new_shots)
        await ctx.session.flush()
        for shot in new_shots:
            await self.send_shot_event(ctx, shot, "shot_created")
        await ctx.session.commit()

        raw_characters = data.get("characters") or []
        char_count = len(raw_characters) if isinstance(raw_characters, list) else 0

        summary = ctx.project.summary or f"{char_count}个角色，{len(new_shots)}个分镜"
        ctx.project.summary = summary
        ctx.project.updated_at = utcnow()
        ctx.session.add(ctx.project)

        ctx.completion_info = CompletionInfo(
            completed=user_message or "分镜脚本已生成",
            details=f"共 {len(new_shots)} 个分镜",
            next="接下来为角色和分镜生成参考图片",
            question="分镜是否符合预期？",
        )
        await self.send_message(
            ctx, user_message or f"{len(new_shots)} 个分镜已生成", summary=summary, progress=1.0
        )

    async def run(self, ctx: AgentContext) -> None:
        """Legacy entry point — runs both sub-steps sequentially."""
        await self.run_characters(ctx)
        await self.run_shots(ctx)
