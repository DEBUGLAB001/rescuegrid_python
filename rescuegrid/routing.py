"""Road network shortest path routing logic.

CONTEST BUG #5:
Compute a valid lowest-cost route between locations while strictly excluding
closed road segments (is_closed == True).

In this baseline implementation, the pathfinder ignores segment closure status,
allowing emergency vehicles to be routed straight through closed and hazardous
road corridors (SEG-WC), reporting an invalid direct cost of 4.0 km instead of
routing around the closure via North District (cost 6.5 km).
"""

import heapq
from typing import List, Dict, Optional, Tuple, Any
from rescuegrid.models import RoadSegment


def find_shortest_route(
    start_node: str,
    end_node: str,
    segments: List[RoadSegment]
) -> Dict[str, Any]:
    """Compute lowest-cost route between two nodes.
    
    Returns route dictionary containing path nodes, segments used, total cost,
    and avoided closures.
    """
    # Build adjacency graph
    # BUGGY BASELINE: Includes closed segments in graph search!
    adj: Dict[str, List[Tuple[str, float, RoadSegment]]] = {}
    closures_on_map = [s for s in segments if s.is_closed]

    for s in segments:
        # BUG: The router fails to filter out closed road segments!
        # Intended: if s.is_closed: continue
        if s.from_node not in adj:
            adj[s.from_node] = []
        if s.to_node not in adj:
            adj[s.to_node] = []
        adj[s.from_node].append((s.to_node, s.distance, s))
        adj[s.to_node].append((s.from_node, s.distance, s))

    # Dijkstra shortest path search
    pq = [(0.0, start_node, [start_node], [])]
    visited = set()

    shortest_path = None
    min_cost = float("inf")
    used_segments = []

    while pq:
        cost, current, path, segs = heapq.heappop(pq)
        if current in visited:
            continue
        visited.add(current)

        if current == end_node:
            shortest_path = path
            min_cost = cost
            used_segments = segs
            break

        for neighbor, weight, seg in adj.get(current, []):
            if neighbor not in visited:
                heapq.heappush(pq, (cost + weight, neighbor, path + [neighbor], segs + [seg]))

    if not shortest_path:
        return {
            "start": start_node,
            "destination": end_node,
            "path": [],
            "segment_ids": [],
            "total_cost": 0.0,
            "has_closed_roads": False,
            "closures_avoided": [],
            "error": "No route found"
        }

    traversed_closed = [s.id for s in used_segments if s.is_closed]
    avoided = [s.id for s in closures_on_map if s.id not in [s2.id for s2 in used_segments]]

    return {
        "start": start_node,
        "destination": end_node,
        "path": shortest_path,
        "segments": [s.to_dict() for s in used_segments],
        "segment_ids": [s.id for s in used_segments],
        "total_cost": round(min_cost, 2),
        "traversed_closed_roads": traversed_closed,
        "is_valid": len(traversed_closed) == 0,
        "closures_avoided": [s.to_dict() for s in closures_on_map if s.id not in [s2.id for s2 in used_segments]]
    }
