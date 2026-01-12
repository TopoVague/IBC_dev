from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from neo4j import GraphDatabase
import pandas as pd
# ensure compatibility with older gspan implementations using df.append
if not hasattr(pd.DataFrame, "append"):
    pd.DataFrame.append = pd.DataFrame._append
import io
import networkx as nx
from networkx.algorithms.isomorphism import GraphMatcher
from shapely.wkt import loads as load_wkt
from shapely.ops import unary_union
from shapely.geometry import Polygon, MultiPoint, MultiLineString, LineString, Point,MultiPolygon

from itertools import combinations
import numpy as np
from gspan_mining.gspan import gSpan
from fastapi.responses import Response
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon
import io
from fastapi import Request 
from collections import defaultdict
import copy
import pickle
import os
from fastapi.middleware.cors import CORSMiddleware
import urllib.parse
from fastapi import HTTPException, Query
from collections import Counter
# Allow frontend to communicate with backend
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ENRICH_DIR = "enrich_graph_db"
os.makedirs(ENRICH_DIR, exist_ok=True)

GRAPH_DIR = "saved_graphs"
os.makedirs(GRAPH_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# Inlined build_graph_for_apartment (no external dependency)
# ----------------------------------------------------------------------
def build_graph_for_apartment(DF, floor_id, apartment_id, buffer_dist=0.6, min_shared_len=0.1):
    def get_geoms(df, fid, aid=None, col='roomtype'):
        d = df[df.floor_id == fid]
        if aid is not None:
            d = d[d.apartment_id == aid]
        geoms = d.geom.apply(load_wkt)
        cats = d[col]
        return list(geoms), list(cats)

    geoms_all, cats_all = get_geoms(DF, floor_id)
    structure = unary_union([g for g,c in zip(geoms_all,cats_all) if c=='Structure'])
    polys = list(structure.geoms) if hasattr(structure,'geoms') else [structure]

    G = nx.Graph()
    apt_node = f"apartment_{apartment_id}"
    G.add_node(apt_node, type='apartment', apartment_id=apartment_id)

    geoms, cats = get_geoms(DF, floor_id, apartment_id)
    room_idxs = [i for i,(g,c) in enumerate(zip(geoms,cats)) if c not in ('Structure','Door','Window','Entrance Door','Balcony','Shaft')]

    for i in room_idxs:
        rn = f"room_{apartment_id}_{i}"
        geom = geoms[i]
        sm = geom.buffer(buffer_dist).buffer(-buffer_dist).simplify(0.05) if isinstance(geom, Polygon) else geom
        if isinstance(sm, Polygon):
            rect = sm.minimum_rotated_rectangle
            hd = sm.exterior.hausdorff_distance(rect.exterior)
            sides = [np.hypot(x2-x1, y2-y1) for (x1,y1),(x2,y2) in zip(rect.exterior.coords, rect.exterior.coords[1:])]
            avg = sum(sides[:4])/4 if len(sides)>=4 else 1.0
            area_ratio = sm.area/(rect.area or 1)
            ratio = hd/avg if avg else 999
            final = rect if ratio<0.4 and 0.7<area_ratio else sm
        else:
            final = sm

        G.add_node(rn, type='room', roomtype=cats[i], apartment_id=apartment_id, geometry=final)
        G.add_edge(apt_node, rn, edge_type='apartment-room')

    for i,j in combinations(room_idxs,2):
        shared = geoms[i].buffer(buffer_dist).intersection(geoms[j]).area / buffer_dist
        if shared >= min_shared_len:
            u,v = f"room_{apartment_id}_{i}", f"room_{apartment_id}_{j}"
            G.add_edge(u, v, edge_type='room-room', shared_length=shared)

    wall_idxs = [i for i,(g,c) in enumerate(zip(geoms,cats)) if c=='Structure']
    for ri in room_idxs:
        buf = geoms[ri].buffer(buffer_dist)
        for wi in wall_idxs:
            shared = buf.intersection(geoms[wi]).area / buffer_dist
            if shared >= min_shared_len:
                wn = f"wall_{apartment_id}_{wi}"
                if not G.has_node(wn):
                    G.add_node(wn, type='wall', geometry=geoms[wi])
                G.add_edge(f"room_{apartment_id}_{ri}", wn, edge_type='room-wall')

    walls = [n for n,d in G.nodes(data=True) if d.get('type')=='wall']
    for u,v in combinations(walls,2):
        gu, gv = G.nodes[u]['geometry'], G.nodes[v]['geometry']
        if gu.touches(gv) or gu.intersects(gv):
            slen = getattr(gu.boundary.intersection(gv.boundary), 'length', 0.0)
            G.add_edge(u, v, edge_type='wall-wall', shared_length=slen)

    return G

# ----------------------------------------------------------------------
# FastAPI setup
# ----------------------------------------------------------------------
app = FastAPI(
    title="Apartment-Graph Service",
    description="Upload data, build & store graphs, mine patterns, apply constraints, enrich segments, export metrics"
)
app.mount(
    "/static/enrich",
    StaticFiles(directory=ENRICH_DIR),
    name="enrich"
)
@app.get("/", include_in_schema=False)
async def serve_ui():
    return FileResponse("app/static/index.html")

# driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j","apartment-graph"))
GSPAN_INPUT = "room_graphs.gspan"

def get_db_session():
    return driver.session()

# ----------------------------------------------------------------------
# gSpan helpers
# ----------------------------------------------------------------------
def export_gspan_input(graphs, out_file):
    with open(out_file, 'w') as fout:
        for gid, G in graphs:
            edges = [(u,v) for u,v,d in G.edges(data=True) if d.get('edge_type')=='room-room']
            if not edges: continue
            nodes = sorted({n for u,v in edges for n in (u,v)})
            vid = {n:i for i,n in enumerate(nodes)}
            fout.write(f"t # {gid}\n")
            for n in nodes:
                fout.write(f"v {vid[n]} {G.nodes[n].get('roomtype','Unknown')}\n")
            for u,v in edges:
                fout.write(f"e {vid[u]} {vid[v]} 1\n")

def run_mining(gspan_file, min_sup):
    gs = gSpan(gspan_file, min_sup, True)
    gs.run()
    df = gs._report_df
    supcol = next(c for c in df.columns if 'sup' in c.lower())
    codecol = next(c for c in df.columns if c!=supcol)
    return list(zip(df[codecol], df[supcol]))

def parse_pattern(desc):
    P=nx.Graph(); toks=desc.split(); i=0
    while i<len(toks):
        if toks[i]=='v' and i+2<len(toks):
            vid,lbl=int(toks[i+1]),toks[i+2]; P.add_node(vid,label=lbl); i+=3
        elif toks[i]=='e' and i+3<len(toks):
            u,v=int(toks[i+1]),int(toks[i+2]); P.add_edge(u,v); i+=4
        else:
            i+=1
    return P

def normalize_dfs(desc: str) -> str:
    """
    Convert a raw DFS string into canonical 'v U L' / 'e U V W' lines.
    """
    toks = desc.strip().split()
    lines = []
    i = 0
    while i < len(toks):
        if toks[i] == 'v' and i + 2 < len(toks):
            # take exactly 3 tokens: 'v', id, label
            lines.append(f"v {toks[i+1]} {toks[i+2]}")
            i += 3
        elif toks[i] == 'e' and i + 3 < len(toks):
            # take exactly 4 tokens: 'e', u, v, weight
            lines.append(f"e {toks[i+1]} {toks[i+2]} {toks[i+3]}")
            i += 4
        else:
            i += 1
    return "\n".join(lines)


# ----------------------------------------------------------------------
# Spatial constraints & matching
# ----------------------------------------------------------------------
def compute_shape_violation(room_polys, threshold):
    coords = []
    lines = []

    for poly in room_polys:
        if isinstance(poly, Polygon):
            coords.extend(poly.exterior.coords)
            lines.append(poly.exterior)
        elif isinstance(poly, MultiPolygon):
            for p in poly.geoms:
                coords.extend(p.exterior.coords)
                lines.append(p.exterior)

    multi = MultiPoint(coords)
    rect = multi.convex_hull.minimum_rotated_rectangle
    mline = MultiLineString(lines)
    hausd = mline.hausdorff_distance(rect.exterior)

    avg = rect.length / 4.0 if hasattr(rect, 'length') else 1.0
    ratio = hausd / avg if avg else 999

    return max(0.0, ratio - threshold), ratio, hausd, rect

def compute_rect_dimensions(rect):
    pts = list(rect.exterior.coords)
    lens = [np.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]) for i in range(len(pts)-1)]
    return min(lens), max(lens) if lens else (0.0, 0.0)

def is_valid_no_partial_cross(room_polys, tol=1e-7):
    for a,b in combinations(room_polys,2):
        inter=a.intersection(b)
        if not inter.is_empty and inter.area>tol:
            if a.within(b) or b.within(a): continue
            if abs(inter.area - a.area)<tol or abs(inter.area - b.area)<tol: continue
            return False
    return True

# def find_matches(G,P):
#     H=nx.Graph()
#     for n,d in G.nodes(data=True):
#         if d.get('type')=='room': H.add_node(n,**d)
#     for u,v,d in G.edges(data=True):
#         if d.get('edge_type')=='room-room' and u in H and v in H:
#             H.add_edge(u,v)
#     matcher=nx.algorithms.isomorphism.GraphMatcher(
#         H,P,
#         node_match=lambda nd,md: nd.get('roomtype')==md['label']
#     )
#     return list(matcher.subgraph_isomorphisms_iter())

def find_matches(G, P):
    # Build room-room subgraph from G with label normalization
    H = nx.Graph()
    for n, d in G.nodes(data=True):
        if d.get('type') == 'room':
            roomtype = d.get('roomtype', '').strip().lower()
            H.add_node(n, label=roomtype)
    for u, v, d in G.edges(data=True):
        if d.get('edge_type') == 'room-room' and u in H and v in H:
            H.add_edge(u, v, label='1')

    # Normalize pattern node and edge labels
    for n in P.nodes:
        P.nodes[n]['label'] = P.nodes[n].get('label', '').strip().lower()
    for u, v in P.edges:
        P[u][v]['label'] = '1'

    matcher = nx.algorithms.isomorphism.GraphMatcher(
        H, P,
        node_match=lambda nd, md: nd['label'] == md['label'],
        edge_match=lambda ed, md: ed['label'] == md['label']
    )

    # Use subgraph monomorphism if available, else fallback
    if hasattr(matcher, "subgraph_is_monomorphic_iter"):
        return list(matcher.subgraph_is_monomorphic_iter())
    else:
        # Fallback: simulate monomorphism via isomorphism matches
        return list(matcher.subgraph_isomorphisms_iter())

# ----------------------------------------------------------------------
# Segment enrichment
# ----------------------------------------------------------------------
# def enrich_graph(G):
#     AVG_WIDTH = 0.06
#     SAMPLE_DIST = AVG_WIDTH / 2.0
#     MIN_OPEN_LEN = 1.0
#     ANG_T = np.deg2rad(10)
#     DIST_T = 0.2
#     DOUBLE_SEGMENT_OVERLAP_RATIO = 0.3
#     PARTIAL_DOUBLE_RATIO = 0.2

#     seg_ids = []
#     for n, d in list(G.nodes(data=True)):
#         if d['type'] != 'room':
#             continue
#         # coords = list(d['geometry'].exterior.coords)
#         geom = d['geometry']
#         # Validate geometry
#         if geom.is_empty or not geom.is_valid:
#             continue  # Skip invalid geometry

#         # Ensure it's a polygon with an exterior ring
#         if isinstance(geom, Polygon):
#             coords = list(geom.exterior.coords)
#         elif isinstance(geom, MultiPolygon):
#             poly = max(geom.geoms, key=lambda g: g.area)  # Use largest valid part
#             if poly.is_empty or not poly.is_valid:
#                 continue
#             coords = list(poly.exterior.coords)
#         else:
#             continue  # Skip unsupported geometry types

#         # Skip degenerate polygons
#         if len(coords) < 4 or Polygon(coords).area < 1e-6:
#             continue
#         for i in range(len(coords) - 1):
#             sid = f"{n}_seg_{i}"
#             a, b = coords[i], coords[i + 1]
#             if G.has_node(sid):
#                 continue
#             seg = LineString([a, b])
#             G.add_node(sid, type='segment', geometry=seg, length=seg.length)
#             G.add_edge(n, sid, edge_type='room-segment')
#             seg_ids.append(sid)

#             dx, dy = b[0] - a[0], b[1] - a[1]
#             nxm, nym = -dy, dx
#             mag = (nxm ** 2 + nym ** 2) ** 0.5
#             ux, uy = nxm / mag, nym / mag

#             incident_rooms = [nbr for nbr in G.neighbors(sid) if G.nodes[nbr]['type'] == "room"]
#             wall_geoms = []
#             for rm in incident_rooms:
#                 for w in G.neighbors(rm):
#                     if G.nodes[w]['type'] == "wall":
#                         wall_geoms.append(G.nodes[w]["geometry"])
#             wall_union = unary_union(wall_geoms) if wall_geoms else None

#             t_values = np.linspace(0.1, 0.9, 3)
#             num_inside = 0
#             for t in t_values:
#                 px = a[0] + t * (b[0] - a[0])
#                 py = a[1] + t * (b[1] - a[1])
#                 for sign in (1, -1):
#                     p = Point(px + sign * ux * SAMPLE_DIST, py + sign * uy * SAMPLE_DIST)
#                     if wall_union and wall_union.contains(p):
#                         num_inside += 1

#             if seg.length <= MIN_OPEN_LEN:
#                 seg_type = "wall"
#             elif num_inside == 0:
#                 seg_type = "opening"
#             elif num_inside == 1:
#                 seg_type = "opening"
#             elif num_inside in (2, 3):
#                 seg_type = "wall"
#             else:
#                 seg_type = "wall"
#             G.nodes[sid]['segment_type'] = seg_type

#     def ang_fn(s):
#         x0, y0 = s.coords[0]
#         x1, y1 = s.coords[-1]
#         return np.arctan2(y1 - y0, x1 - x0)

#     for u, v in combinations(seg_ids, 2):
#         su, sv = G.nodes[u]['geometry'], G.nodes[v]['geometry']
#         if su.touches(sv):
#             G.add_edge(u, v, edge_type='adjacent')
#         if abs(ang_fn(su) - ang_fn(sv)) < ANG_T and su.distance(sv) <= DIST_T:
#             G.add_edge(u, v, edge_type='double_segment')

#     return G

def enrich_graph(G):
    AVG_WIDTH = 0.06
    SAMPLE_DIST = AVG_WIDTH / 2.0
    MIN_OPEN_LEN = 1.0
    DOUBLE_SEGMENT_ANGLE_THRESH = np.deg2rad(10)
    DOUBLE_SEGMENT_DIST_THRESH = 0.4
    DOUBLE_SEGMENT_OVERLAP_RATIO = 0.3
    PARTIAL_DOUBLE_RATIO = 0.2

    segment_nodes = []

    for n, d in list(G.nodes(data=True)):
        if d['type'] != 'room':
            continue

        geom = d['geometry']
        if geom.is_empty or not geom.is_valid:
            continue

        if isinstance(geom, Polygon):
            coords = list(geom.exterior.coords)
        elif isinstance(geom, MultiPolygon):
            poly = max(geom.geoms, key=lambda g: g.area)
            if poly.is_empty or not poly.is_valid:
                continue
            coords = list(poly.exterior.coords)
        else:
            continue

        if len(coords) < 4 or Polygon(coords).area < 1e-6:
            continue

        for i in range(len(coords) - 1):
            a, b = coords[i], coords[i + 1]
            sid = f"{n}_seg_{i}"
            if sid in G:
                continue

            seg = LineString([a, b])
            G.add_node(sid, type='segment', geometry=seg, length=seg.length)
            G.add_edge(n, sid, edge_type='room-segment')
            segment_nodes.append(sid)

            dx, dy = b[0] - a[0], b[1] - a[1]
            nxm, nym = -dy, dx
            mag = (nxm ** 2 + nym ** 2) ** 0.5
            ux, uy = nxm / mag, nym / mag

            incident_rooms = [nbr for nbr in G.neighbors(sid) if G.nodes[nbr]['type'] == "room"]
            wall_geoms = []
            for rm in incident_rooms:
                for w in G.neighbors(rm):
                    if G.nodes[w]['type'] == "wall":
                        wall_geoms.append(G.nodes[w]["geometry"])
            wall_union = unary_union(wall_geoms) if wall_geoms else None

            t_values = np.linspace(0.1, 0.9, 3)
            num_inside = 0
            for t in t_values:
                px = a[0] + t * (b[0] - a[0])
                py = a[1] + t * (b[1] - a[1])
                for sign in (1, -1):
                    p = Point(px + sign * ux * SAMPLE_DIST, py + sign * uy * SAMPLE_DIST)
                    if wall_union and wall_union.contains(p):
                        num_inside += 1

            if seg.length <= MIN_OPEN_LEN:
                seg_type = "wall"
            elif num_inside == 0:
                seg_type = "opening"
            elif num_inside == 1:
                seg_type = "opening"
            elif num_inside in (2, 3):
                seg_type = "wall"
            else:
                seg_type = "wall"
            G.nodes[sid]['segment_type'] = seg_type

    def segment_angle(s):
        x0, y0 = s.coords[0]
        x1, y1 = s.coords[-1]
        return np.arctan2(y1 - y0, x1 - x0)

    def are_segments_adjacent(s1, s2):
        pts1 = [tuple(np.round(p, 8)) for p in s1.coords]
        pts2 = [tuple(np.round(p, 8)) for p in s2.coords]
        return bool(set(pts1) & set(pts2))

    def are_segments_parallel_and_close(s1, s2):
        ang1 = segment_angle(s1)
        ang2 = segment_angle(s2)
        angle_diff = abs((ang1 - ang2 + np.pi/2) % np.pi - np.pi/2)
        if angle_diff > DOUBLE_SEGMENT_ANGLE_THRESH:
            return False
        dist = s1.distance(s2)
        if dist > DOUBLE_SEGMENT_DIST_THRESH:
            return False

        a1, b1 = np.array(s1.coords[0]), np.array(s1.coords[1])
        a2, b2 = np.array(s2.coords[0]), np.array(s2.coords[1])
        vec1 = b1 - a1
        length1 = np.linalg.norm(vec1)
        if length1 == 0:
            return False
        u1 = vec1 / length1
        t_a2 = np.dot(a2 - a1, u1)
        t_b2 = np.dot(b2 - a1, u1)
        t0, t1 = sorted([t_a2, t_b2])
        overlap = max(0, min(length1, t1) - max(0, t0))
        shorter = min(length1, np.linalg.norm(b2-a2))
        if shorter == 0:
            return False
        return overlap / shorter >= DOUBLE_SEGMENT_OVERLAP_RATIO

    wall_segments = [sid for sid in segment_nodes if G.nodes[sid]['segment_type'] == "wall"]
    for i, sid1 in enumerate(wall_segments):
        seg1 = G.nodes[sid1]['geometry']
        for sid2 in wall_segments[i+1:]:
            seg2 = G.nodes[sid2]['geometry']
            if are_segments_adjacent(seg1, seg2):
                G.add_edge(sid1, sid2, edge_type="adjacent")
            elif are_segments_parallel_and_close(seg1, seg2):
                G.add_edge(sid1, sid2, edge_type="double_segment")

    return G

# ----------------------------------------------------------------------
# Local write helpers
# ----------------------------------------------------------------------
def save_graph_pickle(gid, G):
    path = os.path.join(GRAPH_DIR, f"{gid}.pkl")
    with open(path, "wb") as f:
        pickle.dump(G, f)

def load_graph_pickle(gid):
    path = os.path.join(GRAPH_DIR, f"{gid}.pkl")
    with open(path, "rb") as f:
        return pickle.load(f)

# ----------------------------------------------------------------------
# Neo4j write helpers
# ----------------------------------------------------------------------
def _save_graph_tx(tx, G):
    for nid, data in G.nodes(data=True):
        # if data.get("type") == "segment":
        #     continue  # ❌ skip segments
        node_type = data.get('type', 'unknown').capitalize()
        props = {k: v for k, v in data.items() if k != 'geometry'}
        if 'geometry' in data and hasattr(data['geometry'], 'wkt'):
            props['wkt'] = data['geometry'].wkt
        tx.run(
            f"MERGE (n:{node_type} {{id:$nid}}) SET n += $props",
            nid=nid, props=props
        )

    for u, v, edge_data in G.edges(data=True):
        # if G.nodes[u].get("type") == "segment" or G.nodes[v].get("type") == "segment":
        #     continue  # ❌ skip any edge involving segments
        etype = edge_data.get('edge_type', 'RELATED')
        props = {k: v for k, v in edge_data.items() if k != 'edge_type'}
        tx.run(
            """
            MATCH (a {id:$u}), (b {id:$v})
            MERGE (a)-[r:EDGE {type:$etype}]->(b)
            SET r += $props
            """,
            u=u, v=v, etype=etype, props=props
        )

def _load_graph(session, gid):
    G = nx.Graph()
    # fetch up to 2-hops to include segments and walls
    q_nodes = """
      MATCH (a:Apartment {id:$gid})-[*0..2]-(n)
      RETURN DISTINCT n.id AS id, labels(n) AS labels, properties(n) AS props
    """
    for row in session.run(q_nodes, {'gid': gid}):
        props = row['props']
        props['type'] = row['labels'][0].lower()
        if 'wkt' in props:
            props['geometry'] = load_wkt(props.pop('wkt'))
        G.add_node(row['id'], **props)

    ids = list(G.nodes)
    q_edges = """
      MATCH (n)-[r]->(m)
      WHERE n.id IN $ids AND m.id IN $ids
      RETURN n.id AS u, m.id AS v, r.type AS edge_type, properties(r) AS props
    """
    for row in session.run(q_edges, {'ids': ids}):
        attrs = dict(row['props'])
        attrs['edge_type'] = row['edge_type']
        G.add_edge(row['u'], row['v'], **attrs)

    return G

# ----------------------------------------------------------------------
# Metrics export helper
# ----------------------------------------------------------------------
def export_metrics(metrics, filename):
    df = pd.DataFrame(metrics)
    df.to_excel(filename, index=False)

# ----------------------------------------------------------------------
# API endpoints
# ----------------------------------------------------------------------
@app.post("/connect_existing")
def connect_existing():
    # Set a flag in the app state
    app.state.use_existing = True
    return {"message": "Linked to existing Neo4j database."}

@app.get("/status")
def status():
    return {"connected": getattr(app.state, 'use_existing', False)}

# Modify process_all to skip deleting DB when re-using existing DB
# @app.post("/process_all")
# def process_all():
#     if not hasattr(app.state,'df'): raise HTTPException(400,"Upload first.")
#     df=app.state.df; summary={}
#     use_existing = getattr(app.state, 'use_existing', False)

#     with driver.session() as session:
#         if not use_existing:
#             session.run("MATCH (n) DETACH DELETE n")
#         for f in df.floor_id.dropna().unique():
#             apts=df[df.floor_id==f].apartment_id.dropna().unique()
#             proc=[]
#             for apt in apts:
#                 G=build_graph_for_apartment(df,f,apt)
#                 session.write_transaction(_save_graph_tx,G)
#                 proc.append(str(apt))
#             summary[str(f)]=proc
#     return {"message":"Processed all floors","details":summary}
@app.post("/process_all")
def process_all():
    if not hasattr(app.state, 'df'):
        raise HTTPException(400, "Upload first.")
    df = app.state.df
    summary = {}

    for f in df.floor_id.dropna().unique():
        apts = df[df.floor_id == f].apartment_id.dropna().unique()
        proc = []
        for apt in apts:
            G = build_graph_for_apartment(df, f, apt)
            gid = f"{f}_{apt}"
            save_graph_pickle(gid, G)
            proc.append(str(apt))
        summary[str(f)] = proc

    return {"message": "Processed all floors", "details": summary}

@app.post("/upload/")
async def upload_dataset(file:UploadFile=File(...)):
    content=await file.read()
    try:
        df=pd.read_excel(io.BytesIO(content)) if file.filename.endswith(('.xls','.xlsx')) \
           else pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400,f"Parse error: {e}")
    app.state.df=df
    return {"message":"Dataset loaded","rows":len(df)}

@app.post("/process_all")
def process_all():
    if not hasattr(app.state,'df'): raise HTTPException(400,"Upload first.")
    df=app.state.df; summary={}
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
        for f in df.floor_id.dropna().unique():
            apts=df[df.floor_id==f].apartment_id.dropna().unique()
            proc=[]
            for apt in apts:
                G=build_graph_for_apartment(df,f,apt)
                session.write_transaction(_save_graph_tx,G)
                proc.append(str(apt))
            summary[str(f)]=proc
    return {"message":"Processed all floors","details":summary}

# @app.post("/process/{floor_id}/{apartment_id}")
# def process_apartment(floor_id:int,apartment_id:str):
#     if not hasattr(app.state,'df'): raise HTTPException(400,"Upload first.")
#     G=build_graph_for_apartment(app.state.df,floor_id,apartment_id)
#     with driver.session() as session:
#         session.write_transaction(_save_graph_tx,G)
#     return {"message":f"Saved graph for floor={floor_id}, apt={apartment_id}"}
@app.post("/process/{floor_id}/{apartment_id}")
def process_apartment(floor_id: int, apartment_id: str):
    if not hasattr(app.state, 'df'):
        raise HTTPException(400, "Upload first.")
    G = build_graph_for_apartment(app.state.df, floor_id, apartment_id)
    gid = f"{floor_id}_{apartment_id}"
    save_graph_pickle(gid, G)
    return {"message": f"Saved graph for floor={floor_id}, apt={apartment_id}"}

@app.post("/clear_db")
def clear_db():
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    return {"message":"Database cleared"}

@app.get("/pattern/{gid}/image")
def pattern_image(gid: str, request: Request):

    rooms_param = request.query_params.get("rooms", "")
    requested_rooms = set(rooms_param.split(",")) if rooms_param else set()

    # with driver.session() as session:
    #     G = _load_graph(session, gid)
    G = load_graph_pickle(gid)

    # Get only room nodes (matched pattern) and their adjacent walls
    matched_rooms = [n for n, d in G.nodes(data=True)
                 if d.get("type") == "room" and n in requested_rooms]
    print("Requested rooms:", requested_rooms)
    print("Matched rooms in graph:", matched_rooms)
    if not matched_rooms:
        return Response(content=b'', media_type="image/png")

    # Include room neighbors (walls, segments)
    relevant_nodes = set(matched_rooms)
    for room in matched_rooms:
        print(f"\nChecking neighbors for room: {room}")
        for nbr in G.neighbors(room):
            nbr_type = G.nodes[nbr].get("type")
            print(f"  Neighbor: {nbr}, Type: {nbr_type}")
            if nbr_type in {"wall", "segment"}:
                relevant_nodes.add(nbr)

    subG = G.subgraph(relevant_nodes).copy()

    fig, ax = plt.subplots(figsize=(5, 5))
    ax.set_aspect("equal")
    ax.axis("off")

    for n, d in subG.nodes(data=True):
        geom = d.get("geometry")
        if not geom:
            continue

        t = d.get("type")

        if t == "room" and isinstance(geom, Polygon):
            x, y = geom.exterior.xy
            ax.add_patch(MplPolygon(list(zip(x, y)), facecolor="skyblue", edgecolor="black", alpha=0.4))
            label = d.get("roomtype", "")
            cx, cy = geom.centroid.x, geom.centroid.y
            ax.text(cx, cy, label, fontsize=8, ha="center", va="center")

        elif t == "wall" and isinstance(geom, Polygon):
            x, y = geom.exterior.xy
            ax.add_patch(MplPolygon(list(zip(x, y)), facecolor="lightgray", edgecolor="lightgray", alpha=0.5))

        elif t == "segment" and isinstance(geom, LineString):
            x, y = geom.xy
            seg_type = d.get("segment_type", "")
            color = {
                "wall": "red",
                "opening": "green",
            }.get(seg_type, "gray")
            ax.plot(x, y, color=color, linewidth=3)

    ax.relim()
    ax.autoscale_view()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100)
    plt.close(fig)
    buf.seek(0)
    return Response(content=buf.read(), media_type="image/png")

from collections import defaultdict

# Add to /mine endpoint after enrichment
import uuid

@app.post("/mine")
def mine_patterns(
    min_support:     int   = Query(..., ge=1),
    max_width:       float = Query(..., gt=0),
    ratio_threshold: float = Query(..., ge=0, le=1),
    vcount:          int   = Query(..., ge=1),
):
    # — clear out any old enriched pickles —
    for fname in os.listdir(ENRICH_DIR):
        path = os.path.join(ENRICH_DIR, fname)
        if os.path.isfile(path):
            os.remove(path)

    # — load all graphs from disk —
    graphs = []
    for fname in sorted(os.listdir(GRAPH_DIR)):
        if not fname.endswith(".pkl"):
            continue
        gid = fname[:-4]
        with open(os.path.join(GRAPH_DIR, fname), "rb") as f:
            G = pickle.load(f)
        graphs.append((gid, G))

    # — run gSpan mining —
    export_gspan_input(graphs, GSPAN_INPUT)
    raw = run_mining(GSPAN_INPUT, min_support)

    filtered = []
    metrics  = []

    # 1) compute raw_match_graphs per pattern
    raw_counts = {}
    for desc,sup in raw:
        P = parse_pattern(desc)
        if P.number_of_nodes()!=vcount: 
            continue
        # count how many graphs have ≥1 subgraph match (before any filtering)
        cnt = 0
        for gid,G in graphs:
            if any(find_matches(G,P)):
                cnt += 1
        raw_counts[desc] = cnt

    # — for each raw pattern and each match, collect metrics & filter —
    for desc, sup in raw:
        P = parse_pattern(desc)
        if P.number_of_nodes() != vcount:
            continue

        for gid, G in graphs:
            for match in find_matches(G, P):
                inv   = {pid: gn for gn, pid in match.items()}
                rooms = [inv[i] for i in sorted(inv)]
                polys = [G.nodes[r]["geometry"] for r in rooms]

                viol, ratio, hausd, rect = compute_shape_violation(polys, ratio_threshold)
                short_side, long_side     = compute_rect_dimensions(rect)

                # record _every_ match in the metrics list
                metrics.append({
                    "gid":     gid,
                    "pattern": desc,
                    "support": sup,
                    "ratio":   ratio,
                    "width":   short_side,
                    "viol":    viol,
                })

                # only keep those that pass all geometric filters
                if (
                    viol == 0
                    and short_side <= max_width
                    and ratio <= ratio_threshold
                    and is_valid_no_partial_cross(polys)
                ):
                    filtered.append((gid, sup, rooms))

    # — WRITE METRICS TO EXCEL — overwrite existing file
    if metrics:
        df = pd.DataFrame(metrics)
        df.to_excel("pattern_metrics.xlsx", index=False)
    else:
        # no metrics → remove any old file
        try:
            os.remove("pattern_metrics.xlsx")
        except FileNotFoundError:
            pass

    # — enrich & pickle the surviving subgraphs —
    enriched = []
    for gid, sup, rooms in filtered:
        fullG = next(G for g, G in graphs if g == gid)
        relevant = set(rooms)
        for r in rooms:
            relevant.update(fullG.neighbors(r))
        subG = fullG.subgraph(relevant).copy()
        enG  = enrich_graph(subG)
        for r in rooms:
            enG.nodes[r]["matched"] = True
        
        # 2. Identify only the matched rooms
        matched_rooms = [n for n, d in enG.nodes(data=True) if d.get("matched")]

        # 3. Collect adjacent segment nodes
        seg_nodes = {
            nbr
            for room in matched_rooms
            for nbr in enG.neighbors(room)
            if enG.nodes[nbr].get("type") == "segment"
        }

        # 4. Build the segment‐only subgraph H
        H = nx.Graph()
        for seg in seg_nodes:
            H.add_node(seg, segment_type=enG.nodes[seg]["segment_type"])
        for u, v, data in enG.edges(data=True):
            if u in seg_nodes and v in seg_nodes and data.get("edge_type") in {"adjacent", "double_segment"}:
                H.add_edge(u, v)

        # 5. WL‐hash H on its node_attr
        module_hash = nx.weisfeiler_lehman_graph_hash(H, node_attr="segment_type")

        uid   = str(uuid.uuid4())
        fname = f"{gid}_{uid}.pkl"
        with open(os.path.join(ENRICH_DIR, fname), "wb") as f:
            pickle.dump(enG, f)
        combo = '+'.join(sorted(fullG.nodes[r]["roomtype"] for r in rooms))
        enriched.append({"pattern": desc, "gid": gid, "support": sup, "rooms": rooms, "combo": combo, "file": fname, "hash": module_hash,  })

    app.state.mined_patterns = enriched
    return {
        "message":  f"Enriched {len(enriched)} subgraphs",
        "patterns": enriched,
        "metrics":  "pattern_metrics.xlsx"
    }

# @app.post("/mine")
# def mine_patterns(
#     min_support:int=Query(...,ge=1),
#     max_width:float=Query(...,gt=0),
#     ratio_threshold:float=Query(...,ge=0,le=1),
#     vcount:int=Query(...,ge=1)
# ):
#     # 🧹 Clear old enriched files
#     for fname in os.listdir(ENRICH_DIR):
#         fpath = os.path.join(ENRICH_DIR, fname)
#         if os.path.isfile(fpath):
#             os.remove(fpath)

#     # graphs=[]
#     # with driver.session() as session:
#     #     for rec in session.run("MATCH (a:Apartment) RETURN a.id AS gid"):
#     #         graphs.append((rec['gid'], _load_graph(session,rec['gid'])))
#     # if not graphs:
#     #     raise HTTPException(404,"No graphs in DB.")
#     graphs = []
#     for fname in sorted(os.listdir(GRAPH_DIR)):
#         if fname.endswith(".pkl"):
#             gid = fname.replace(".pkl", "")
#             with open(os.path.join(GRAPH_DIR, fname), "rb") as f:
#                 G = pickle.load(f)
#             graphs.append((gid, G))

#     export_gspan_input(graphs,GSPAN_INPUT)
#     raw=run_mining(GSPAN_INPUT,min_support)

#     filtered=[]; metrics=[]
#     for desc,sup in raw:
#         P=parse_pattern(desc)
#         if P.number_of_nodes()!=vcount: continue
#         for gid,G in graphs:
#             for match in find_matches(G,P):
#                 inv={pid:gn for gn,pid in match.items()}
#                 rooms=[inv[i] for i in sorted(inv)]
#                 room_polys=[G.nodes[r]['geometry'] for r in rooms]
#                 viol,ratio,hausd,rect=compute_shape_violation(room_polys,ratio_threshold)
#                 short_side, long_side = compute_rect_dimensions(rect)
#                 metrics.append({'gid': gid, 'pattern': desc, 'support': sup, 'ratio': ratio, 'width': short_side})
#                 if viol == 0 and short_side <= max_width and ratio <= ratio_threshold and is_valid_no_partial_cross(room_polys):
#                     filtered.append((gid, sup, rooms))

#     export_metrics(metrics, 'pattern_metrics.xlsx')

#     enriched = []
#     for gid, sup, rooms in filtered:
#         fullG = next(G for g, G in graphs if g == gid)
#         relevant = set(rooms)
#         for r in rooms:
#             relevant.update(fullG.neighbors(r))
#         subG = fullG.subgraph(relevant).copy()
#         enG = enrich_graph(subG)
#         for room_id in rooms:
#             enG.nodes[room_id]['matched'] = True

#         uid = str(uuid.uuid4())
#         fname = os.path.join(ENRICH_DIR, f"{gid}_{uid}.pkl")
#         with open(fname, "wb") as f:
#             pickle.dump(enG, f)

#         enriched.append({"pattern": desc, 'gid': gid, 'support': sup, 'rooms': rooms})

#     app.state.mined_patterns = enriched
#     return {"message":f"Enriched {len(enriched)} subgraphs","patterns":enriched}

    # enriched=[]
    # with driver.session() as session:
    #     for gid,sup,rooms in filtered:
    #         fullG = next(G for g, G in graphs if g == gid)
    #         relevant = set(rooms)
    #         for r in rooms:
    #             relevant.update(fullG.neighbors(r))
    #         subG = fullG.subgraph(relevant).copy()
    #         enG = enrich_graph(subG)
    #         for room_id in rooms:
    #             enG.nodes[room_id]['matched'] = True

    #         # Save enriched graph as pickle file
    #         uid = str(uuid.uuid4())
    #         fname = os.path.join(ENRICH_DIR, f"{gid}_{uid}.pkl")
    #         with open(fname, "wb") as f:
    #             pickle.dump(enG, f)

    #         # session.write_transaction(_save_graph_tx,enG)
    #         enriched.append({'gid':gid,'support':sup,'rooms':rooms})



# @app.get("/segments/grouped")
# def group_segment_patterns():

#     INPUT_DIR = "enrich_graph_db"
#     label_to_files = defaultdict(list)

#     for fname in sorted(os.listdir(INPUT_DIR)):
#         if not fname.endswith(".pkl"):
#             continue

#         # load the enriched apartment graph
#         path = os.path.join(INPUT_DIR, fname)
#         with open(path, "rb") as f:
#             G = pickle.load(f)

#         # collect only the 'segment' nodes that were marked as part of the mined subgraph
#         matched_rooms = [n for n, d in G.nodes(data=True) if d.get("matched")]
#         if not matched_rooms:
#             print(f"[grouped] {fname}: no matched rooms → skipping")
#             continue

#         # find all segments adjacent to those matched rooms
#         seg_nodes = []
#         for room in matched_rooms:
#             for nbr in G.neighbors(room):
#                 if G.nodes[nbr].get("type") == "segment":
#                     seg_nodes.append(nbr)
#         seg_nodes = list(set(seg_nodes))
#         if not seg_nodes:
#             print(f"[grouped] {fname}: no segments in mined subgraph → skipping")
#             continue

#         # build a new graph H of just those segment nodes, carrying over their segment_type
#         H = nx.Graph()
#         for seg in seg_nodes:
#             H.add_node(seg, segment_type=G.nodes[seg]["segment_type"])

#         # now re-add any edges *between* those segment nodes of type 'adjacent' or 'double_segment'
#         for u, v, data in G.edges(data=True):
#             if u in seg_nodes and v in seg_nodes and data.get("edge_type") in ("adjacent", "double_segment"):
#                 H.add_edge(u, v, label=data["edge_type"])

#         # WL-hash on H using both node_attr and edge_attr
#         label = nx.weisfeiler_lehman_graph_hash(
#             H,
#             node_attr="segment_type"
#         )
#         print(f"[grouped] {fname} → WL-hash: {label}")
#         label_to_files[label].append(fname)

#     # prepare output
#     groups = list(label_to_files.values())
#     sizes  = [len(g) for g in groups]
#     print(f"[grouped] total distinct groups: {len(groups)}")
#     return {"groups": groups, "sizes": sizes}

@app.get("/segments/grouped")
def group_segment_patterns():
    INPUT_DIR = "enrich_graph_db"
    label_to_files = defaultdict(list)

    for fname in sorted(os.listdir(INPUT_DIR)):
        if not fname.endswith(".pkl"):
            continue

        path = os.path.join(INPUT_DIR, fname)
        with open(path, "rb") as f:
            G = pickle.load(f)

        # 1. Identify matched rooms
        matched_rooms = [n for n, d in G.nodes(data=True) if d.get("matched")]
        if not matched_rooms:
            print(f"[grouped] {fname}: no matched rooms → skipping")
            continue

        # 2. Collect adjacent segment nodes
        seg_nodes = {
            nbr
            for room in matched_rooms
            for nbr in G.neighbors(room)
            if G.nodes[nbr].get("type") == "segment"
        }
        if not seg_nodes:
            print(f"[grouped] {fname}: no segments in mined subgraph → skipping")
            continue

        # 3. Construct subgraph H of segments with type attribute
        H = nx.Graph()
        for seg in seg_nodes:
            H.add_node(seg, segment_type=G.nodes[seg]["segment_type"])

        # 4. Add unlabelled edges between segments (ignore edge_type)
        for u, v, data in G.edges(data=True):
            if u in seg_nodes and v in seg_nodes and data.get("edge_type") in {"adjacent", "double_segment"}:
                H.add_edge(u, v)

        # 5. WL-hash using segment_type only
        label = nx.weisfeiler_lehman_graph_hash(H, node_attr="segment_type")
        print(f"[grouped] {fname} → WL-hash: {label}")
        label_to_files[label].append(fname)

    # 6. Final result
    groups = list(label_to_files.values())
    sizes = [len(g) for g in groups]
    print(f"[grouped] total distinct groups: {len(groups)}")

    return {"groups": groups, "sizes": sizes}

@app.get("/segments/group/{index}")
def get_segment_group(index: int):
    INPUT_DIR = "enrich_graph_db"
    graphs = []

    for fname in sorted(os.listdir(INPUT_DIR)):
        if fname.endswith('.pkl'):
            with open(os.path.join(INPUT_DIR, fname), 'rb') as f:
                G = pickle.load(f)
            seg_nodes = [n for n, d in G.nodes(data=True) if d.get("type") == "segment"]
            H = G.subgraph(seg_nodes).copy()
            graphs.append((fname, H))

    def get_canonical_label(G):
        for u, v, data in G.edges(data=True):
            etype = data.get("edge_type", "undefined")
            G[u][v]["label"] = etype
        return nx.weisfeiler_lehman_graph_hash(G, node_attr="segment_type", edge_attr="label")

    from collections import defaultdict
    label_to_files = defaultdict(list)
    for fname, H in graphs:
        label = get_canonical_label(H)
        label_to_files[label].append(fname)

    grouped = list(label_to_files.values())
    if index < 0 or index >= len(grouped):
        raise HTTPException(status_code=400, detail="Invalid group index")

    return {"file_names": grouped[index]}

@app.get("/pattern/from_pickle_subgraph/{filename}")
def view_enriched_subgraph(filename: str):
    # 1) Build absolute path to the pickle file
    path = os.path.join(ENRICH_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Pickle file not found")

    # 2) Load the enriched graph
    with open(path, "rb") as f:
        G = pickle.load(f)

    # 3) Extract only the nodes you marked as part of the mined subgraph:
    #    we assume you set d['matched']=True on those room nodes when mining.
    matched_rooms = [n for n, d in G.nodes(data=True) if d.get("matched")]
    if not matched_rooms:
        raise HTTPException(status_code=400, detail="No matched rooms in this graph")

    # 4) Build a subgraph of:
    #    - the matched rooms
    #    - plus any adjacent segments or walls
    H = G.subgraph(matched_rooms).copy()
    for room in matched_rooms:
        for nbr in G.neighbors(room):
            nd = G.nodes[nbr]
            if nd.get("type") in {"segment", "wall"}:
                H.add_node(nbr, **nd)
                H.add_edge(room, nbr, **G.edges[room, nbr])

    # 5) Render H to a PNG
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.set_aspect("equal")
    ax.axis("off")

    for n, d in H.nodes(data=True):
        geom = d.get("geometry")
        if not geom:
            continue

        if d["type"] == "room" and isinstance(geom, Polygon):
            x, y = geom.exterior.xy
            ax.add_patch(MplPolygon(
                list(zip(x, y)),
                facecolor="skyblue", edgecolor="black", alpha=0.4
            ))
            cx, cy = geom.centroid.x, geom.centroid.y
            ax.text(cx, cy, d.get("roomtype", ""), ha="center", va="center", fontsize=8)

        elif d["type"] == "wall" and isinstance(geom, Polygon):
            x, y = geom.exterior.xy
            ax.add_patch(MplPolygon(
                list(zip(x, y)),
                facecolor="lightgray", edgecolor="lightgray", alpha=0.5
            ))

        elif d["type"] == "segment" and isinstance(geom, LineString):
            x, y = geom.xy
            segcol = {"wall": "red", "opening": "green"}.get(d.get("segment_type", ""), "gray")
            ax.plot(x, y, color=segcol, linewidth=3)

    ax.relim()
    ax.autoscale_view()

    # 6) Stream the PNG back
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100)
    plt.close(fig)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

@app.get("/pattern/combos/")
def pattern_combos(
    pattern: str = Query(..., description="DFS‐code, URL‐encoded"),
    gids:    str = Query(None, description="Optional comma-separated list of graph IDs to restrict to")
):
    # URL-decode + normalize
    decoded = urllib.parse.unquote(pattern).strip()
    norm_q  = normalize_dfs(decoded)

    # parse the gids param if present
    gid_set = set(gids.split(",")) if gids else None

    combo_counts = Counter()
    for entry in app.state.mined_patterns:
        # filter by pattern
        if normalize_dfs(entry["pattern"]) != norm_q:
            continue
        # if they passed in a gid list, only count those
        if gid_set and entry["gid"] not in gid_set:
            continue

        # tally room-type combo
        G = load_graph_pickle(entry["gid"])
        combo = tuple(sorted(G.nodes[r]["roomtype"] for r in entry["rooms"]))
        combo_counts[combo] += 1

    if not combo_counts:
        raise HTTPException(404, f"No matches for pattern {decoded} in given graphs")

    return [
        {"combo": list(combo), "count": cnt}
        for combo, cnt in combo_counts.items()
    ]
