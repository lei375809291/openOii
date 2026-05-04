from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import (
    compose_node,
    plan_approval_node,
    plan_node,
    render_approval_node,
    render_node,
    review_node,
    route_after_plan_approval,
    route_after_render_approval,
    route_after_review,
    route_from_start,
)
from .state import Phase2RuntimeContext, Phase2State


def build_phase2_graph() -> StateGraph[Phase2State, Phase2RuntimeContext]:
    graph = StateGraph(state_schema=Phase2State, context_schema=Phase2RuntimeContext)
    graph.add_node("plan", plan_node)
    graph.add_node("plan_approval", plan_approval_node)
    graph.add_node("render", render_node)
    graph.add_node("render_approval", render_approval_node)
    graph.add_node("compose", compose_node)
    graph.add_node("review", review_node)

    graph.add_conditional_edges(
        START,
        route_from_start,
        {
            "plan": "plan",
            "render": "render",
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
            "render": "render",
        },
    )
    graph.add_edge("render", "render_approval")
    graph.add_conditional_edges(
        "render_approval",
        route_after_render_approval,
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
            "render": "render",
            "compose": "compose",
        },
    )
    graph.add_edge("compose", END)
    return graph


phase2_graph = build_phase2_graph()
