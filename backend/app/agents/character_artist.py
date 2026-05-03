from __future__ import annotations

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent
from app.models.project import Character


class CharacterArtistAgent(BaseAgent):
    """为角色生成参考图片"""
    name = "character_artist"

    async def _generate_character_image(self, ctx: AgentContext, character: Character) -> None:
        # 生成图片 URL
        image_prompt = self._build_image_prompt(character, style=ctx.project.style)
        external_url = await self.generate_and_cache_image(ctx, prompt=image_prompt)

        # 保存图片 URL（优先为本地缓存 URL；缓存失败时可能仍为外部 URL）
        character.image_url = external_url
        ctx.session.add(character)
        await ctx.session.flush()

        # 发送角色更新事件
        await self.send_character_event(ctx, character, "character_updated")

    def _build_image_prompt(self, character: Character, *, style: str) -> str:
        """根据角色描述构建图片生成 prompt"""
        desc = character.description or character.name
        style = style.strip()
        # 强制动漫风格：添加更具体的风格关键词
        anime_style = "anime, 2D illustration, cel-shading, vibrant colors, Japanese animation style"
        if style:
            return f"{desc}, {anime_style}, {style}"
        return f"{desc}, {anime_style}"

    async def run_for_character(self, ctx: AgentContext, character: Character) -> None:
        await self.send_message(
            ctx,
            f"🎨 开始为角色 {character.name} 生成形象图...",
            progress=0.0,
            is_loading=True,
        )

        updated = False
        try:
            await self._generate_character_image(ctx, character)
            updated = True
        except Exception as e:
            await self.send_message(ctx, f"⚠️ 角色 {character.name} 图片生成失败: {str(e)[:50]}")

        await ctx.session.commit()

        if updated:
            await self.send_message(
                ctx,
                f"✅ 已为角色 {character.name} 生成形象图。",
                progress=1.0,
                is_loading=False,
            )

    async def run(self, ctx: AgentContext) -> None:
        # 查找没有图片的角色
        res = await ctx.session.execute(
            select(Character).where(
                Character.project_id == ctx.project.id,
                Character.image_url.is_(None)
            )
        )
        characters = res.scalars().all()
        if not characters:
            await self.send_message(ctx, "所有角色已有图片。")
            return

        total = len(characters)
        await self.send_message(ctx, f"🎨 开始为 {total} 个角色生成形象图...", progress=0.0, is_loading=True)

        updated_count = 0
        for i, char in enumerate(characters):
            try:
                await self.send_progress_batch(
                    ctx,
                    total=total,
                    current=i,
                    message=f"   正在绘制：{char.name} ({i+1}/{total})",
                )

                await self._generate_character_image(ctx, char)
                updated_count += 1
            except Exception as e:
                # 单个失败不影响其他
                await self.send_message(ctx, f"⚠️ 角色 {char.name} 图片生成失败: {str(e)[:50]}")

        await ctx.session.commit()
        if updated_count > 0:
            summary = f"为{updated_count}个角色生成了形象图"
            await self.send_message(ctx, f"✅ 已为 {updated_count} 个角色生成形象图，接下来将绘制分镜。", summary=summary, progress=1.0)


class SingleCharacterArtistAgent(CharacterArtistAgent):
    name = "character_artist"

    def __init__(self, character_id: int):
        super().__init__()
        self.character_id = character_id

    async def run(self, ctx: AgentContext) -> None:
        character = await ctx.session.get(Character, self.character_id)
        if not character or character.project_id != ctx.project.id:
            await self.send_message(ctx, "未找到指定角色，无法重新生成。")
            await ctx.session.commit()
            return

        await self.run_for_character(ctx, character)
