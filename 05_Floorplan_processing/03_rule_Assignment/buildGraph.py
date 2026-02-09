import json
import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from shapely.geometry import Point, Polygon, LineString
from itertools import combinations
import sys

# -------------------- Drawing Function --------------------
def draw_graph(G):
    """Visualize the graph with color-coded node types."""
    plt.figure(figsize=(12, 8))
    pos = nx.spring_layout(G, seed=42)  # reproducible layout

    # Color-code nodes by 'type'
    node_colors = []
    for node, data in G.nodes(data=True):
        ntype = data.get('type', 'unknown')
        if ntype == 'wall':
            node_colors.append('lightgray')
        elif ntype == 'room':
            node_colors.append('lightblue')
        elif ntype == 'apartment':
            node_colors.append('lightgreen')
        else:
            node_colors.append('white')

    # Draw nodes and edges
    nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=800, edgecolors='black')
    nx.draw_networkx_edges(G, pos, edge_color='gray')
    nx.draw_networkx_labels(G, pos, font_size=8, font_weight='bold')

    # Edge labels (e.g., "belongs_to", "identical", etc.)
    edge_labels = {(u, v): d.get('type', '') for u, v, d in G.edges(data=True)}
    nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_color='red', font_size=7)

    # Legend
    legend_elems = [
        Patch(facecolor='lightgray', label='Wall'),
        Patch(facecolor='lightblue', label='Room'),
        Patch(facecolor='lightgreen', label='Apartment'),
    ]
    plt.legend(handles=legend_elems, loc='upper right', fontsize=10)
    plt.title("Floorplan Graph", fontsize=12, fontweight='bold')
    plt.show()


# -------------------- Geometry Utilities --------------------
def are_walls_identical(w1, w2):
    """Check if two walls are identical, ignoring endpoint order."""
    return (
        (w1['start_point'] == w2['start_point'] and w1['end_point'] == w2['end_point'])
        or
        (w1['start_point'] == w2['end_point'] and w1['end_point'] == w2['start_point'])
    )

def normalize_apartment_name(name):
    """Remove rooms from apartment name to standardize mapping."""
    if not name:
        return "None"
    return name.replace(" ", "")

# -------------------- BFS: Connect Core -> Apartment --------------------
def connect_core_to_apartments(graph):
    """
    From each room with room_type='core', BFS outward.
    Whenever we encounter an apartment node, link them (core -> apartment).
    """
    core_nodes = [n for n, d in graph.nodes(data=True)
                  if d.get('type') == 'room' and d.get('room_type') == 'core']

    for core_node in core_nodes:
        visited = set()
        queue = [core_node]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)

            # If we reached an apartment node, connect
            if graph.nodes[current].get('type') == 'apartment':
                graph.add_edge(core_node, current, type='core_to_apartment')
                # continue searching if you want multiple connections

            # Explore neighbors
            for nbr in graph.neighbors(current):
                if nbr not in visited:
                    queue.append(nbr)

def transform_identical_walls(G):
    """Modifies the graph in-place so that two identical walls sharing
    the same two rooms become a simple chain: room_a - A - identical - B - room_b."""

    def get_room_neighbors(node):
        """Return all 'room' neighbors connected to 'node' via an edge type='belongs_to'."""
        rooms = set()
        for nbr in G.neighbors(node):
            # Check that neighbor is type=room and edge type=belongs_to
            if G.nodes[nbr].get('type') == 'room' and G.edges[node, nbr].get('type') == 'belongs_to':
                rooms.add(nbr)
        return rooms

    # Gather all pairs of nodes connected by an 'identical' edge
    identical_pairs = [(u, v)
                       for u, v, data in G.edges(data=True)
                       if data.get('type') == 'identical']

    for A, B in identical_pairs:
        rooms_A = get_room_neighbors(A)
        rooms_B = get_room_neighbors(B)

        # We only do the chain transform if they share EXACTLY the same two rooms
        if rooms_A == rooms_B and len(rooms_A) == 2:
            room_a, room_b = sorted(rooms_A)  # consistent ordering
            # Remove B->room_a belongs_to edge (so B connects only to room_b)
            if G.has_edge(B, room_a) and G.edges[B, room_a].get('type') == 'belongs_to':
                G.remove_edge(B, room_a)
            # Remove A->room_b belongs_to edge (so A connects only to room_a)
            if G.has_edge(A, room_b) and G.edges[A, room_b].get('type') == 'belongs_to':
                G.remove_edge(A, room_b)

# -------------------- Main Script --------------------
if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("Usage: python script.py <file_name>")
        print("Will automatically read <file_name>_bom.json")
        sys.exit(1)

    base_name = sys.argv[1]
    input_file = f"{base_name}.json"

    # 1) Load JSON
    print(f"Loading JSON from: {input_file}")
    with open(input_file, 'r') as f:
        data = json.load(f)

    panels = data['panels']['items']  # dict of wall definitions
    rooms = data['spaces']          # dict of polygons

    G = nx.Graph()

    # 2) Create room polygons + room nodes (use 'room_type' key)
    room_polygons = {}
    room_node_map = {}
    for room_id, room_info in rooms.items():
        coords_2d = [(c['x'], c['y']) for c in room_info['coordinates']]
        poly = Polygon(coords_2d)

        # Create a node label, e.g., "room_0"
        room_label = f"room_{room_id}"

        # Convert coords to string to avoid GraphML errors
        coords_str = ";".join(f"{x},{y}" for (x, y) in coords_2d)

        G.add_node(
            room_label,
            type='room',
            room_type=room_info['room_type'],      # e.g. "bathroom", "bedroom", "core"
            apartment=room_info.get('apartment', 'None'),
            coordinates=coords_str
        )
        room_polygons[room_id] = poly
        room_node_map[room_id] = room_label

    # 3) Create apartment nodes from the rooms
    apt_map = {}
    apt_counter = 1
    for room_id, room_info in rooms.items():
        apt_raw = room_info.get('apartment', 'None')
        if apt_raw == 'None':
            continue

        apt_norm = normalize_apartment_name(apt_raw)
        if apt_norm not in apt_map:
            apt_node = f"apartment_{apt_counter}"
            G.add_node(apt_node, type='apartment', name=apt_raw)
            apt_map[apt_norm] = apt_node
            apt_counter += 1

        # Link the room node to this apartment node
        room_node = room_node_map[room_id]
        G.add_edge(room_node, apt_map[apt_norm], type='belongs_to')

    # 4) Add each wall node & link it to the correct room
    for wall_key, w_data in panels.items():
        # The JSON "room": "bathroom", "bedroom", etc. => store it as 'room_type'
        w_room_type = w_data.get('room', 'None')
        w_apartment = w_data.get('apartment', 'None')

        # Convert the start/end points to strings for GraphML
        start_pt_str = str(w_data['start_point'])
        end_pt_str   = str(w_data['end_point'])

        # Create wall node with 'room_type' so it matches room nodes
        G.add_node(
            wall_key,
            type='wall',
            panel_type="WAL_21_CNI_REN",
            start_point=start_pt_str,
            end_point=end_pt_str,
            height=float(w_data['height']),
            thickness=float(w_data['thickness']),
            room_type=w_room_type,      # <--- store as room_type
            apartment=w_apartment
        )

        # Evaluate geometry: use entire line to avoid corner-only attachments
        from shapely.geometry import LineString
        start_xy = (w_data['start_point'][0], w_data['start_point'][1])
        end_xy   = (w_data['end_point'][0],   w_data['end_point'][1])
        wall_line = LineString([start_xy, end_xy])

        # Among all rooms, find polygon(s) with same (room_type + apartment)
        # and check if polygon fully covers the line
        for room_id, poly in room_polygons.items():
            room_label = room_node_map[room_id]
            room_attr  = G.nodes[room_label]

            if (room_attr.get('room_type') == w_room_type and
                room_attr.get('apartment') == w_apartment):

                # If polygon fully covers the line, link
                if poly.covers(wall_line):
                    G.add_edge(wall_key, room_label, type='belongs_to')

    # 5) Mark identical walls (optional)
    wall_keys = list(panels.keys())
    for k1, k2 in combinations(wall_keys, 2):
        if are_walls_identical(panels[k1], panels[k2]):
            G.add_edge(k1, k2, type='identical')

    # 6) Connect core rooms to apartments (optional BFS)
    connect_core_to_apartments(G)

    transform_identical_walls(G)

    # 7) Draw the graph (optional)
    draw_graph(G)

    # 8) Export to GraphML
    output_graphml = f"{base_name}_bom.graphml"
    try:
        nx.write_graphml(G, output_graphml)
        print("GraphML export completed successfully.")
    except nx.NetworkXError as e:
        print("Error exporting to GraphML:", e)
