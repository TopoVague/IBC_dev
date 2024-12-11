import json
import networkx as nx
from itertools import combinations

# Function to check if two walls are identical (order-independent)
def are_walls_identical(wall1, wall2):
    return (wall1['start_point'] == wall2['start_point'] and wall1['end_point'] == wall2['end_point']) or \
           (wall1['start_point'] == wall2['end_point'] and wall1['end_point'] == wall2['start_point'])

# Function to normalize apartment names by removing spaces
def normalize_apartment_name(apartment_name):
    return apartment_name.replace(" ", "") if apartment_name else apartment_name

# Load the data from the JSON file
with open('2_apartment.json', 'r') as file:
    data = json.load(file)

panels = data['panels']['items']

# Initialize an undirected graph
G = nx.Graph()

# Track unique rooms and apartments to create nodes with simplified naming
room_nodes = {}
apartment_nodes = {}
apartment_to_rooms = {}

# Counters for unique IDs
room_counter = 1
apartment_counter = 1

# Mapping to ensure unique naming
room_mapping = {}
apartment_mapping = {}

# Add wall nodes with attributes to the graph
for key, wall in panels.items():
    # Convert start_point and end_point lists to comma-separated strings
    start_point_str = ','.join(map(str, wall['start_point']))
    end_point_str = ','.join(map(str, wall['end_point']))
    
    # Add the wall node with string-converted points
    wall_node_attrs = {
        'panel_type': wall['panel_type'],  # string
        'start_point': start_point_str,    # string
        'end_point': end_point_str,        # string
        'height': wall['height'],          # number
        'thickness': wall['thickness'],    # number
        'room': wall['room'] if wall['room'] else "None",  # string or "None"
        'apartment': wall.get('apartment', "None")          # string
    }
    G.add_node(key, **wall_node_attrs)

    # Simplify room naming
    room_key = (wall['room'], wall.get('apartment', "None"))
    if room_key not in room_mapping:
        room_id = f"room{room_counter}"
        room_mapping[room_key] = room_id
        G.add_node(room_id, type='room', name=wall['room'] if wall['room'] else "None", apartment=wall.get('apartment', "None"))
        room_nodes[room_id] = room_id
        room_counter += 1
    else:
        room_id = room_mapping[room_key]

    # Add an edge between the wall node and its corresponding room node
    G.add_edge(room_id, key, type='belongs_to')

    # Simplify apartment naming
    apartment_name = wall.get('apartment', "None")
    if apartment_name != "None":
        apartment_name_norm = normalize_apartment_name(apartment_name)
        if apartment_name_norm not in apartment_mapping:
            apartment_id = f"apartment{apartment_counter}"
            apartment_mapping[apartment_name_norm] = apartment_id
            G.add_node(apartment_id, type='apartment', name=apartment_name)
            apartment_nodes[apartment_name_norm] = apartment_id
            apartment_counter += 1
        else:
            apartment_id = apartment_mapping[apartment_name_norm]
        
        # Map the room to the apartment
        if apartment_name_norm not in apartment_to_rooms:
            apartment_to_rooms[apartment_name_norm] = set()
        apartment_to_rooms[apartment_name_norm].add(room_id)

# Add edges between room nodes and their respective apartment nodes
for apartment_name_norm, rooms in apartment_to_rooms.items():
    apartment_node_id = apartment_mapping[apartment_name_norm]
    for room_id in rooms:
        G.add_edge(room_id, apartment_node_id, type='belongs_to')

# Add edges based on identical walls only
for key1, key2 in combinations(panels.keys(), 2):
    wall1 = panels[key1]
    wall2 = panels[key2]

    if are_walls_identical(wall1, wall2):
        G.add_edge(key1, key2, type='identical')

# **Debugging Outputs**

# Debug: Print apartment nodes
print("Apartment nodes:")
for apt_name_norm, apt_id in apartment_nodes.items():
    print(f"  {apt_name_norm}: {apt_id}")

# Debug: Print 'identical' edges
print("\nIdentical edges:")
for u, v, attrs in G.edges(data=True):
    if attrs.get('type') == 'identical':
        print(f"  {u} <-> {v}")

# Debug: Print all 'belongs_to' edges
print("\nBelongs_to edges (Room <-> Wall):")
for u, v, attrs in G.edges(data=True):
    if attrs.get('type') == 'belongs_to':
        print(f"  {u} <-> {v}")

# Debug: Print all room nodes
print("\nRoom nodes:")
for room_id, room_attr in G.nodes(data=True):
    if room_attr.get('type') == 'room':
        print(f"  {room_id}: {room_attr}")

# Function to find and link core rooms to apartments through identical walls
def connect_core_to_apartments(graph):
    # Find all core room nodes
    core_nodes = [node for node, attr in graph.nodes(data=True) if attr.get('type') == 'room' and attr.get('name') == 'core']

    print(f"\nIdentified core nodes: {core_nodes}")

    for core_node in core_nodes:
        print(f"\nProcessing core node: {core_node}")

        # Use BFS to find all paths from the core room
        visited = set()
        queue = [(core_node, [])]  # (current node, path to current node)
        while queue:
            current_node, path = queue.pop(0)

            if current_node in visited:
                continue
            visited.add(current_node)

            # Check if we've reached an apartment
            if graph.nodes[current_node].get('type') == 'apartment':
                # Establish a direct core-to-apartment connection
                graph.add_edge(core_node, current_node, type='core_to_apartment')
                print(f"  Connected core '{core_node}' to apartment '{current_node}' via path: {path}")
                continue

            # Traverse neighbors
            for neighbor in graph.neighbors(current_node):
                if neighbor not in visited:
                    queue.append((neighbor, path + [current_node]))
                    
# Apply the function to the graph
connect_core_to_apartments(G)

# Check if connections were made
print("\nAfter connecting core to apartments:")
for u, v, attrs in G.edges(data=True):
    if attrs.get('type') == 'core_to_apartment':
        print(f"  {u} <-> {v} (core_to_apartment)")

# Export the graph to GraphML
try:
    nx.write_graphml(G, "walls_and_rooms_graph.graphml")
    print("\nGraph export completed successfully.")
except nx.NetworkXError as e:
    print(f"GraphML Export Error: {e}")

print("Graph export completed successfully.")
