from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent
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

    async def _apply_incremental_changes(self, ctx: AgentContext, data: dict, visual_bible: str) -> tuple[int, int]:
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
        shot_res = await ctx.session.execute(
            select(Shot).where(Shot.project_id == ctx.project.id)
        )
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
                shot_order = shot_data.get("order") if isinstance(shot_data.get("order"), int) else idx + 1
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

    async def run(self, ctx: AgentContext) -> None:
        is_incremental = ctx.rerun_mode == "incremental"
        if is_incremental:
            await self.send_message(ctx, "📋 正在增量更新规划...", progress=0.0, is_loading=True)
        else:
            await self.send_message(ctx, "📋 正在规划创作方案...", progress=0.0, is_loading=True)

        payload: dict[str, Any] = {
            "project": {
                "id": ctx.project.id,
                "title": ctx.project.title,
                "story": ctx.project.story,
                "style": ctx.project.style,
                "status": ctx.project.status,
                "creation_mode": getattr(ctx.project, "creation_mode", None),
                "target_shot_count": getattr(ctx.project, "target_shot_count", None),
            },
            "mode": ctx.rerun_mode,
        }
        if ctx.user_feedback:
            payload["user_feedback"] = ctx.user_feedback

        if is_incremental:
            existing_state = await self._get_existing_state(ctx)
            payload["existing_state"] = existing_state

        user_prompt = json.dumps(payload, ensure_ascii=False)

        resp = await self.call_llm(ctx, system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt, max_tokens=4096)
        data = extract_json(resp.text)

        visual_bible = data.get("visual_bible") or ""

        project_update = data.get("project_update") or {}
        updated_fields: dict = {}
        if isinstance(project_update, dict):
            title = project_update.get("title")
            style = project_update.get("style")
            status = project_update.get("status")
            summary = project_update.get("summary")

            if isinstance(title, str) and title.strip():
                ctx.project.title = title.strip()
                updated_fields["title"] = ctx.project.title
            if isinstance(style, str) and style.strip():
                ctx.project.style = style.strip()
                updated_fields["style"] = ctx.project.style
            if isinstance(status, str) and status.strip():
                ctx.project.status = status.strip()
                updated_fields["status"] = ctx.project.status
            if isinstance(summary, str) and summary.strip():
                ctx.project.summary = summary.strip()
                updated_fields["summary"] = ctx.project.summary

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
                    "data": {
                        "project": {
                            "id": ctx.project.id,
                            **updated_fields,
                        }
                    },
                },
            )

        lines = []

        story_breakdown = data.get("story_breakdown") or {}
        logline = story_breakdown.get("logline")
        if logline:
            lines.append(f"📖 故事概括：{logline}")

        genre = story_breakdown.get("genre") or []
        themes = story_breakdown.get("themes") or []
        if genre or themes:
            parts = []
            if genre:
                parts.append(f"类型：{', '.join(genre)}")
            if themes:
                parts.append(f"主题：{', '.join(themes)}")
            lines.append(f"🎭 {' | '.join(parts)}")

        if visual_bible:
            lines.append(f"🎨 视觉指南：{visual_bible[:80]}")

        if is_incremental:
            new_char_count, new_shot_count = await self._apply_incremental_changes(ctx, data, visual_bible)

            char_res = await ctx.session.execute(
                select(Character).where(Character.project_id == ctx.project.id)
            )
            final_chars = list(char_res.scalars().all())
            shot_res = await ctx.session.execute(
                select(Shot).where(Shot.project_id == ctx.project.id).order_by(Shot.order.asc())
            )
            final_shots = list(shot_res.scalars().all())

            for char in final_chars:
                await self.send_character_event(ctx, char, "character_updated")
            for shot in final_shots:
                await self.send_shot_event(ctx, shot, "shot_updated")

            char_names = [c.name for c in final_chars]
            if char_names:
                lines.append(f"👥 角色：{', '.join(char_names)}")
            lines.append(f"🎬 {len(final_shots)} 个分镜")

            summary = ctx.project.summary or f"增量更新：{len(final_chars)}个角色、{len(final_shots)}个分镜"
            await self.send_message(ctx, "\n".join(lines) if lines else "✅ 增量更新完成", summary=summary, progress=1.0)
            return

        raw_characters = data.get("characters") or []
        if isinstance(raw_characters, list) and raw_characters:
            new_characters: list[Character] = []
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
                lines.append(f"👥 角色：{', '.join(char_names)}")

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

        char_count = len(raw_characters) if isinstance(raw_characters, list) else 0
        lines.append(f"🎬 {len(new_shots)} 个分镜")

        summary = ctx.project.summary or f"{char_count}个角色，{len(new_shots)}个分镜"
        ctx.project.summary = summary
        ctx.project.updated_at = utcnow()
        ctx.session.add(ctx.project)

        await self.send_message(ctx, "\n".join(lines) if lines else "✅ 规划完成", summary=summary, progress=1.0)
