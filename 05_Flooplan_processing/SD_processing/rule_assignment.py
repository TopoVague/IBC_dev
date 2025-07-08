import os
import pandas as pd
from geopandas import GeoDataFrame as gdf
from shapely import wkt
from shapely.geometry import LineString, Polygon, MultiPolygon, Point
from shapely.ops import split, unary_union
import matplotlib.pyplot as plt
import networkx as nx
from math import sqrt
import math

FILE_PATH = "mds_V2_5.372k.csv"
WALL_ENT_TYPE = 'separator'
WALL_SUBTYPE = 'WALL'
IGNORE_ROOMTYPES = {'Structure', 'Door', 'Window', 'Entrance Door', 'Balcony'}
CMAP = plt.get_cmap('tab20')
WALL_COLOR = 'red'
ROOM_BOUND_COLOR = 'gray'

class CentralLineSegment:
    def __init__(self, segment_id: int, geometry: LineString, width: float):
        self.id = segment_id
        self.geom = geometry
        self.width = width
        self.wall_type = None
        self.adjacent = (None, None)

def wall_centerline(poly: Polygon) -> LineString:
    mrect = poly.minimum_rotated_rectangle
    coords = list(mrect.exterior.coords)
    sides = [LineString([coords[i], coords[i+1]]) for i in range(len(coords)-1)]
    sides.sort(key=lambda s: s.length)
    m1 = sides[0].interpolate(0.5, normalized=True)
    m2 = sides[1].interpolate(0.5, normalized=True)
    return LineString([m1, m2])

def extend_line(line: LineString, d: float) -> LineString:
    coords = list(line.coords)
    if len(coords) < 2:
        return line
    x0, y0 = coords[0]; x1, y1 = coords[1]
    dx0, dy0 = x1 - x0, y1 - y0
    L0 = sqrt(dx0*dx0 + dy0*dy0)
    ux0, uy0 = (dx0 / L0, dy0 / L0) if L0 != 0 else (0, 0)
    xn1, yn1 = coords[-2]; xn, yn = coords[-1]
    dxn, dyn = xn - xn1, yn - yn1
    Ln = sqrt(dxn*dxn + dyn*dyn)
    uxn, uyn = (dxn / Ln, dyn / Ln) if Ln != 0 else (0, 0)
    new_start = (x0 - d * ux0, y0 - d * uy0)
    new_end = (xn + d * uxn, yn + d * uyn)
    return LineString([new_start, new_end])

def compute_segment_width(seg_line: LineString, parent_poly: Polygon) -> float:
    midpoint = seg_line.interpolate(0.5, normalized=True)
    x0, y0 = seg_line.coords[0]; x1, y1 = seg_line.coords[-1]
    dx, dy = x1 - x0, y1 - y0
    mag = sqrt(dx*dx + dy*dy)
    if mag == 0:
        return 0.0
    ux, uy = dx / mag, dy / mag
    nx1, ny1 = -uy, ux
    bounds = parent_poly.bounds
    diag = max(bounds[2]-bounds[0], bounds[3]-bounds[1]) * 2
    p_start = (midpoint.x - diag * nx1, midpoint.y - diag * ny1)
    p_end = (midpoint.x + diag * nx1, midpoint.y + diag * ny1)
    perp_line = LineString([p_start, p_end])
    inter = parent_poly.intersection(perp_line)
    if inter.is_empty:
        return 0.0
    if inter.geom_type == 'MultiLineString':
        return sum(part.length for part in inter.geoms)
    if inter.geom_type == 'LineString':
        return inter.length
    return 0.0

def assign_wall_types_with_tracking(
    segments,
    G,
    room_types,
    corridor_adj_to_stair,
    room_apartments,
    shaft_polys  
):
    STAIR_LABELS = {'Stair', 'Stairs'}

    rule0_segs, rule1_segs, rule1a_segs, rule2_segs, rule3_segs, rule4_segs = [], [], [], [], [], []

    for seg in segments:
        if seg.wall_type is not None:
            continue

        # adjacent room IDs and their types
        rid0, rid1 = seg.adjacent
        adjs   = [r for r in (rid0, rid1) if r is not None]
        labels = [room_types[r] for r in adjs]

        # Rule 1: any side is Stair/Stairs or a Corridor that touches a Stair
        apply_rule1 = False
        for r in adjs:
            rtype = room_types[r]
            apt   = room_apartments[r]
            if (rtype in STAIR_LABELS) or (rtype == 'Corridor' and (apt is None or (isinstance(apt, float) and math.isnan(apt)))):
                apply_rule1 = True
                break

        if apply_rule1:
            seg.wall_type = 'WAL_20_STD_REN'
            rule0_segs.append(seg)

        # Rule 2: One-edge (exterior or shaft boundary)
        elif len(adjs) <= 1:
            is_shaft_boundary = False
            SHAFT_BOUNDARY_BUFFER = 0.12  # adjust as needed (meters for metric data)
            for shaft_poly in shaft_polys:
                polygons = shaft_poly.geoms if isinstance(shaft_poly, MultiPolygon) else [shaft_poly]
                for poly in polygons:
                    buffered = poly.buffer(SHAFT_BOUNDARY_BUFFER)
                    if seg.geom.intersects(buffered):
                        is_shaft_boundary = True
                        break
                if is_shaft_boundary:
                    break
            if is_shaft_boundary:
                seg.wall_type = 'WAL_02_CNI_REN'  
                rule1a_segs.append(seg)
            else:
                seg.wall_type = 'WAL_01_CNI_REN'  
                rule1_segs.append(seg)

        # Rule 3: Apartment‐division (rooms in different apartments)
        elif (len(adjs) == 2
              and room_apartments[adjs[0]] != room_apartments[adjs[1]]
        ):
            seg.wall_type = 'WAL_22_STD_REN'
            rule2_segs.append(seg)

        # Rule 4: Bath–Kitchen/Bedroom
        elif 'Bathroom' in labels and any(r in labels for r in ['Kitchen','Bedroom']):
            seg.wall_type = 'WAL_40+45_STD_REN'
            rule3_segs.append(seg)

        # Rule 5: Bath–Corridor/Livingroom
        elif 'Bathroom' in labels and any(r in labels for r in ['Corridor','Livingroom']):
            seg.wall_type = 'WAL_43+45_STD_REN'
            rule4_segs.append(seg)

    # Rule 6: Remaining segments
    rule5_segs = []
    for seg in segments:
        if seg.wall_type is None:
            seg.wall_type = 'WAL_40_STD_REN'
            rule5_segs.append(seg)

    rule_steps = [
        ("Rule 1: Stair–Corridor Wall",   'WAL_20_STD_REN',   rule0_segs),
        ("Rule 2: Exterior Wall",        'WAL_01_CNI_REN',   rule1_segs),
        ("Rule 3: Shaft Wall ", 'WAL_02_CNI_REN', rule1a_segs),
        ("Rule 4: Apartment-Division",        'WAL_22_STD_REN',   rule2_segs),
        ("Rule 5: Bath–Kitchen/Bedroom wall",      'WAL_40+45_STD_REN',rule3_segs),
        ("Rule 6: Bath–Corridor/Livingroom Wall",  'WAL_43+45_STD_REN',rule4_segs),
        ("Rule 7: Remaining Wall Segments",        'WAL_40_STD_REN',   rule5_segs),
    ]

    return rule_steps 

def plot_graph_overlay(G, room_polys, segments):
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.set_aspect('equal')
    ax.axis('off')

    for poly, rid in room_polys:
        color = CMAP(rid % CMAP.N)
        polys = poly.geoms if isinstance(poly, MultiPolygon) else [poly]
        for p in polys:
            ax.fill(*p.exterior.xy, facecolor=color, alpha=0.5, edgecolor='none')
            ax.plot(*p.exterior.xy, color=ROOM_BOUND_COLOR, linewidth=0.5)

    for seg in segments:
        x, y = seg.geom.xy
        ax.plot(x, y, color='black', linewidth=1.2)

    pos = nx.get_node_attributes(G, 'pos')
    for u, v, d in G.edges(data=True):
        x1, y1 = pos[u]
        x2, y2 = pos[v]
        ax.plot([x1, x2], [y1, y2], color='black', linewidth=0.5)

    rx, ry, sx, sy = [], [], [], []
    for n, d in G.nodes(data=True):
        x, y = d['pos']
        if d['node_type'] == 'room':
            rx.append(x)
            ry.append(y)
        else:
            sx.append(x)
            sy.append(y)

    ax.scatter(rx, ry, color='green', s=20, label='Room')
    ax.scatter(sx, sy, color='black', s=10, label='Segment')
    ax.set_title("Graph Overlay: Room & Segment Nodes with Edges", fontsize=12)
    plt.tight_layout()
    plt.show()

WALL_TYPE_COLORS = {
    'WAL_01_CNI_REN':    '#00FFFF',  
    'WAL_02_CNI_REN':    '#008080',  
    'WAL_20_STD_REN':    '#800080',  
    'WAL_22_STD_REN':    '#FFFF00',  
    'WAL_40+45_STD_REN': '#0000FF',  
    'WAL_43+45_STD_REN': '#00AA00',  
    'WAL_40_STD_REN':    '#FFA500',  
}

def plot_floor_with_room_segment_graph(
    df_floor,
    floor_id,
    extension=0.2,
    split_epsilon=1e-6,
    min_length=0.5,
    probe_offset=0.2,
    probe_buffer=0.02
):
    # 1. Extract wall geometries
    walls = df_floor[
        (df_floor.entity_type == WALL_ENT_TYPE) &
        (df_floor.entity_subtype == WALL_SUBTYPE)
    ]['geom'].tolist()

    # 2. Build extended centerlines 
    centerline_to_poly = []
    for w in walls:
        if isinstance(w, (Polygon, MultiPolygon)):
            polys = w.geoms if isinstance(w, MultiPolygon) else [w]
            for p in polys:
                cl = wall_centerline(p)
                cl_ext = extend_line(cl, extension)
                centerline_to_poly.append((cl_ext, p))
        elif isinstance(w, LineString):
            cl_ext = extend_line(w, extension)
            centerline_to_poly.append((cl_ext, None))

    # 3. Detect intersections between centerlines
    centrelines = [cl for cl, _ in centerline_to_poly]
    intersections = [[] for _ in centrelines]
    for i, c1 in enumerate(centrelines):
        if c1.length <= min_length:
            continue
        for j in range(i + 1, len(centrelines)):
            c2 = centrelines[j]
            if c2.length <= min_length:
                continue
            pt = c1.intersection(c2)
            if isinstance(pt, Point):
                intersections[i].append(pt)
                intersections[j].append(pt)

    # 4. Extract room polygons, room types AND apartment IDs
    raw_rooms = df_floor[
        (df_floor.entity_type != WALL_ENT_TYPE) &
        (~df_floor.roomtype.isin(IGNORE_ROOMTYPES))
    ][['geom', 'roomtype', 'apartment_id']].values.tolist()     
    rooms = [
        (rid, poly, typ, apt)
        for rid, (poly, typ, apt) in enumerate(raw_rooms, start=1)
    ]
    room_polys      = [(poly, rid) for rid, poly, _, _ in rooms]
    room_types      = {rid: typ for rid, _, typ, _ in rooms}
    room_apartments = {rid: apt for rid, _, _, apt in rooms}    

    # --- Extract SHAFT polygons for this floor ---
    shaft_rows = df_floor[
        (df_floor.entity_type == 'area') &
        (df_floor.entity_subtype == 'SHAFT')
    ]
    shaft_polys = list(shaft_rows['geom'])
    # ---------------------------------------------

    # 5. Split centerlines into segments, compute width and adjacency
    segments = []
    seg_id = 0
    for idx, (cl, parent_poly) in enumerate(centerline_to_poly):
        pts = intersections[idx]
        pieces = split(
            cl,
            unary_union([pt.buffer(split_epsilon) for pt in pts])
        ) if pts else cl
        lines = [pieces] if isinstance(pieces, LineString) else list(pieces.geoms)
        for piece in lines:
            if piece.length <= min_length:
                continue
            seg_id += 1
            width = compute_segment_width(piece, parent_poly) if parent_poly else 0.0
            seg = CentralLineSegment(seg_id, piece, width)

            mid = piece.interpolate(0.5, normalized=True)
            dx = piece.coords[-1][0] - piece.coords[0][0]
            dy = piece.coords[-1][1] - piece.coords[0][1]
            mag = sqrt(dx*dx + dy*dy)
            if mag > 0:
                ux, uy = dx / mag, dy / mag
                for side, attr in zip(((-uy, ux), (uy, -ux)), ('adj1', 'adj2')):
                    p = Point(mid.x + probe_offset * side[0],
                              mid.y + probe_offset * side[1])
                    buf = p.buffer(probe_buffer)
                    rid_hit = next(
                        (rid for poly, rid in room_polys if poly.intersects(buf)),
                        None
                    )
                    if attr == 'adj1':
                        seg.adjacent = (rid_hit, seg.adjacent[1])
                    else:
                        seg.adjacent = (seg.adjacent[0], rid_hit)
            segments.append(seg)

    # 6. Build room–segment graph
    G = nx.Graph()
    for rid, poly, _, _ in rooms:
        cx, cy = poly.centroid.xy
        G.add_node(f"r{rid}", node_type='room', pos=(cx[0], cy[0]))
    for seg in segments:
        mid = seg.geom.interpolate(0.5, normalized=True)
        G.add_node(f"s{seg.id}", node_type='segment', pos=(mid.x, mid.y))
        for rid in seg.adjacent:
            if rid:
                G.add_edge(f"s{seg.id}", f"r{rid}", edge_type='room-segment')

    # 7. Initial overlay for debugging
    plot_graph_overlay(G, room_polys, segments)

    # 8. Compute corridors that touch a Stair
    corridor_adj_to_stair = set()
    for rid_s, poly_s, typ_s, _ in rooms:
        if typ_s in {'Stair', 'Stairs'}:
            for rid_c, poly_c, typ_c, _ in rooms:
                if typ_c == 'Corridor' and poly_s.touches(poly_c):
                    corridor_adj_to_stair.add(rid_c)

    # 9. Assign wall types (now with SHAFT check)
    rule_steps = assign_wall_types_with_tracking(
        segments,
        G,
        room_types,
        corridor_adj_to_stair,
        room_apartments,
        shaft_polys
    )

    # 10. Plot each rule’s segments
    for title, wall_type, segs in rule_steps:
        fig, ax = plt.subplots(figsize=(8, 8))
        ax.set_aspect('equal')
        ax.axis('off')

        # draw rooms
        for rid, poly, room_type, _ in rooms:
            color = CMAP(rid % CMAP.N)
            polys = poly.geoms if isinstance(poly, MultiPolygon) else [poly]
            for p in polys:
                ax.fill(*p.exterior.xy, facecolor=color, alpha=0.5, edgecolor='none')
                ax.plot(*p.exterior.xy, color=ROOM_BOUND_COLOR, linewidth=0.5)
            cx, cy = poly.centroid.xy
            ax.text(
                cx[0], cy[0], room_type,
                ha='center', va='center',
                fontsize=6, color='black',
                bbox=dict(facecolor='white', edgecolor='none', boxstyle='round,pad=0.1')
            )

        # --- HIGHLIGHT SHAFTS ---
        for shaft_poly in shaft_polys:
            polys = shaft_poly.geoms if isinstance(shaft_poly, MultiPolygon) else [shaft_poly]


        for cl, _ in centerline_to_poly:
            ax.plot(*cl.xy, color='red', linewidth=1)


        color = WALL_TYPE_COLORS.get(wall_type, 'black')
        for seg in segs:
            x, y = seg.geom.xy
            ax.plot(x, y, color=color, linewidth=2)

        ax.set_title(f"{title} → {wall_type}", fontsize=12)
        plt.tight_layout()
        plt.show()
    return segments, rooms, room_types, room_apartments

import json

def export_json(segments, rooms, room_types, room_apartments, out_path="output.json"):
    # Panels
    panel_items = {}
    for i, seg in enumerate(segments):
        x0, y0 = seg.geom.coords[0]
        x1, y1 = seg.geom.coords[-1]
        # Find adjacent room/apartment, take the first if available
        rid = next((r for r in seg.adjacent if r is not None), None)
        room_type = room_types[rid] if rid else None
        apartment = room_apartments[rid] if rid else None
        panel_items[str(i)] = {
            "panel_type": seg.wall_type,
            "start_point": [x0, y0, 0],
            "end_point": [x1, y1, 0],
            "height": 3,         # Default value
            "thickness": 0.2,    # Default value
            "room": str(room_type) if room_type else None,
            "apartment": str(apartment) if apartment else None
        }
    panel_items["max_key"] = len(segments)

    # Spaces
    space_items = {}
    for i, (rid, poly, rtype, apt) in enumerate(rooms):
        coords = list(poly.exterior.coords)
        coords_dicts = [{"x": x, "y": y, "z": 0} for x, y in coords]
        space_items[str(i)] = {
            "room_type": rtype,
            "apartment": apt,
            "coordinates": coords_dicts
        }

    data = {
        "panels": {
            "attributes": {},
            "items": panel_items
        },
        "spaces": space_items
    }

    # Write to file
    with open(out_path, "w") as f:
        json.dump(data, f, indent=4)


if __name__ == "__main__":
    if not os.path.exists(FILE_PATH):
        raise FileNotFoundError(f"{FILE_PATH} not found")
    df = pd.read_csv(FILE_PATH)
    df['geom'] = df.geom.apply(wkt.loads)
    df = gdf(df)
    FLOOR_ID = 9942
    floor_df = df[df.floor_id == FLOOR_ID]

    segments, rooms, room_types, room_apartments = plot_floor_with_room_segment_graph(
        floor_df,
        FLOOR_ID,
        extension=0.2,
        split_epsilon=1e-6,
        min_length=0.5,
        probe_offset=0.3,
        probe_buffer=0.02
    )
    export_json(segments, rooms, room_types, room_apartments, out_path=f"{FLOOR_ID}.json")
