from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import (
    character_approval_node,
    character_node,
    clip_node,
    ideate_node,
    merge_node,
    review_node,
    route_after_character_approval,
    route_after_review,
    route_after_storyboard_approval,
    route_from_start,
    script_node,
    storyboard_approval_node,
    storyboard_node,
)
from .state import Phase2RuntimeContext, Phase2State


def build_phase2_graph() -> StateGraph[Phase2State, Phase2RuntimeContext]:
    graph = StateGraph(state_schema=Phase2State, context_schema=Phase2RuntimeContext)
    graph.add_node("ideate", ideate_node)
    graph.add_node("script", script_node)
    graph.add_node("character", character_node)
    graph.add_node("character_approval", character_approval_node)
    graph.add_node("storyboard", storyboard_node)
    graph.add_node("storyboard_approval", storyboard_approval_node)
    graph.add_node("review", review_node)
    graph.add_node("clip", clip_node)
    graph.add_node("merge", merge_node)

    graph.add_conditional_edges(
        START,
        route_from_start,
        {
            "ideate": "ideate",
            "script": "script",
            "character": "character",
            "storyboard": "storyboard",
            "clip": "clip",
            "merge": "merge",
            "review": "review",
        },
    )
    graph.add_edge("ideate", "script")
    graph.add_edge("script", "character")
    graph.add_edge("character", "character_approval")
    graph.add_conditional_edges(
        "character_approval",
        route_after_character_approval,
        {
            "review": "review",
            "storyboard": "storyboard",
        },
    )
    graph.add_edge("storyboard", "storyboard_approval")
    graph.add_conditional_edges(
        "storyboard_approval",
        route_after_storyboard_approval,
        {
            "review": "review",
            "clip": "clip",
        },
    )
    graph.add_conditional_edges(
        "review",
        route_after_review,
        {
            "script": "script",
            "character": "character",
            "storyboard": "storyboard",
            "clip": "clip",
            "merge": "merge",
        },
    )
    graph.add_edge("clip", "merge")
    graph.add_edge("merge", END)
    return graph


phase2_graph = build_phase2_graph()
