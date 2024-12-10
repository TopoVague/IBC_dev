import json
import networkx as nx
from itertools import combinations

# Function to check if two walls are identical
def are_walls_identical(wall1, wall2):
    return (wall1['start_point'] == wall2['start_point'] and wall1['end_point'] == wall2['end_point']) or \
           (wall1['start_point'] == wall2['end_point'] and wall1['end_point'] == wall2['start_point'])

# Function to check if two walls are aligned (partial overlapping)
def are_walls_aligned(wall1, wall2):
    # Ensure the walls are in the same plane (same Z-coordinate)
    if wall1['start_point'][2] != wall2['start_point'][2]:
        return False

    # Check for horizontal alignment (same Y-coordinate)
    if wall1['start_point'][1] == wall1['end_point'][1] and wall2['start_point'][1] == wall2['end_point'][1]:
        if wall1['start_point'][1] == wall2['start_point'][1]:  # Ensure they share the same Y-coordinate
            x1_min, x1_max = sorted([wall1['start_point'][0], wall1['end_point'][0]])
            x2_min, x2_max = sorted([wall2['start_point'][0], wall2['end_point'][0]])
            # Check for overlapping range
            if x1_min < x2_max and x2_min < x1_max:
                print(f"Aligned horizontally: Wall1 [{x1_min}, {x1_max}], Wall2 [{x2_min}, {x2_max}]")
                return True

    # Check for vertical alignment (same X-coordinate)
    if wall1['start_point'][0] == wall1['end_point'][0] and wall2['start_point'][0] == wall2['end_point'][0]:
        if wall1['start_point'][0] == wall2['start_point'][0]:  # Ensure they share the same X-coordinate
            y1_min, y1_max = sorted([wall1['start_point'][1], wall1['end_point'][1]])
            y2_min, y2_max = sorted([wall2['start_point'][1], wall2['end_point'][1]])
            # Check for overlapping range
            if y1_min < y2_max and y2_min < y1_max:
                print(f"Aligned vertically: Wall1 [{y1_min}, {y1_max}], Wall2 [{y2_min}, {y2_max}]")
                return True

    # If neither condition is met, the walls are not aligned
    return False

# Load the data from the JSON file
with open('apartment.json', 'r') as file:
    data = json.load(file)

panels = data['panels']['items']

# Initialize an undirected graph
G = nx.Graph()

# Track unique rooms to create room nodes
room_nodes = {}

# Add wall nodes with attributes to the graph
for key, wall in panels.items():
    # Add the wall node
    wall_node_attrs = {
        'panel_type': wall['panel_type'],
        'start_point': str(wall['start_point']),  # Convert to string for GraphML
        'end_point': str(wall['end_point']),      # Convert to string for GraphML
        'height': wall['height'],
        'thickness': wall['thickness'],
        'room': wall['room']
    }
    G.add_node(key, **wall_node_attrs)

    # Create a unique room node if not already added
    room_name = wall['room']
    if room_name not in room_nodes:
        room_node_id = f"room_{room_name}"
        G.add_node(room_node_id, type='room', name=room_name)
        room_nodes[room_name] = room_node_id

    # Add an edge between the wall node and its corresponding room node
    G.add_edge(room_nodes[room_name], key, type='belongs_to')

# Add edges based on identical and aligned conditions
for key1, key2 in combinations(panels.keys(), 2):
    wall1 = panels[key1]
    wall2 = panels[key2]

    if are_walls_identical(wall1, wall2):
        G.add_edge(key1, key2, type='identical')
    elif are_walls_aligned(wall1, wall2):
        G.add_edge(key1, key2, type='aligned')

# Export the graph to GraphML
try:
    nx.write_graphml(G, "walls_and_rooms_graph.graphml")
except nx.NetworkXError as e:
    print(f"GraphML Export Error: {e}")


print("Graph export completed successfully.")
