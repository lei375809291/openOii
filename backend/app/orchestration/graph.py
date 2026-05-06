from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import (
    character_approval_node,
    character_node,
    compose_node,
    plan_approval_node,
    plan_node,
    review_node,
    route_after_plan_approval,
    route_after_character_approval,
    route_after_shot_approval,
    route_after_review,
    route_from_start,
    shot_approval_node,
    shot_node,
)
from .state import Phase2RuntimeContext, Phase2State


def build_phase2_graph() -> StateGraph[Phase2State, Phase2RuntimeContext]:
    graph = StateGraph(state_schema=Phase2State, context_schema=Phase2RuntimeContext)
    graph.add_node("plan", plan_node)
    graph.add_node("plan_approval", plan_approval_node)
    graph.add_node("character", character_node)
    graph.add_node("character_approval", character_approval_node)
    graph.add_node("shot", shot_node)
    graph.add_node("shot_approval", shot_approval_node)
    graph.add_node("compose", compose_node)
    graph.add_node("review", review_node)

    graph.add_conditional_edges(
        START,
        route_from_start,
        {
            "plan": "plan",
            "character": "character",
            "shot": "shot",
            "compose": "compose",
            "review": "review",
        },
    )
    graph.add_edge("plan", "plan_approval")
    graph.add_conditional_edges(
        "plan_approval",
        route_after_plan_approval,
        {
            "review": "review",
            "character": "character",
        },
    )
    graph.add_edge("character", "character_approval")
    graph.add_conditional_edges(
        "character_approval",
        route_after_character_approval,
        {
            "review": "review",
            "shot": "shot",
        },
    )
    graph.add_edge("shot", "shot_approval")
    graph.add_conditional_edges(
        "shot_approval",
        route_after_shot_approval,
        {
            "review": "review",
            "compose": "compose",
        },
    )
    graph.add_conditional_edges(
        "review",
        route_after_review,
        {
            "plan": "plan",
            "character": "character",
            "shot": "shot",
            "compose": "compose",
        },
    )
    graph.add_edge("compose", END)
    return graph


phase2_graph = build_phase2_graph()
