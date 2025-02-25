import networkx as nx
import sys

# Load the GraphML file
if len(sys.argv) < 2:
    print("Usage: python ruleAssignment.py <file_name>")
    print("Will read <base_name>_bom.graphml and write <file_name>_bom_updated.graphml")
    sys.exit(1)

base_name = sys.argv[1]
input_graphml = f"{base_name}_bom.graphml"
output_graphml = f"{base_name}_bom_updated.graphml"

# Read the graph
G = nx.read_graphml(input_graphml)
print(f"Loaded graph with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges.\n")

# Rule 1: Assign "WAL_01_CNI_REN" to panels with no "Identical" edges
print("\nApplying Rule 1...")
for node, attrs in G.nodes(data=True):
    # Check if it's a panel node by "panel_type" being initially "WAL_21_CNI_REN"
    if attrs.get("panel_type") == "WAL_21_CNI_REN":
        # Check for "Identical" edges
        has_identical_edge = any(
            G[node][neighbor].get("type") == "identical" for neighbor in G.neighbors(node)
        )
        if not has_identical_edge:
            G.nodes[node]["panel_type"] = "WAL_01_CNI_REN"
            print(f"  Panel {node}: Assigned WAL_01_CNI_REN (no identical edges).")

# Rule 2: Assign "WAL_20_STD_REN" to panels belonging to the "Core" room
print("\nApplying Rule 2...")
for node, attrs in G.nodes(data=True):
    if attrs.get("panel_type") and attrs["panel_type"] == "WAL_21_CNI_REN":  # Process only panels
        for neighbor in G.neighbors(node):
            neighbor_attrs = G.nodes[neighbor]
            # Check if the neighbor is a "core" room
            if neighbor_attrs.get("type") == "room" and neighbor_attrs.get("room_type") == "core":
                G.nodes[node]["panel_type"] = "WAL_20_STD_REN "
                print(f"Rule 2 applied: Node {node} is connected to core room {neighbor}")
                break  # No need to check other neighbors


# Rule 3: Assign "WAL_22_STD_REN" to isolated panels within apartment-specific subgraphs
print("\nApplying Rule 3...")
apartment_panels = {}
for node, attrs in G.nodes(data=True):
    if attrs.get("panel_type") == "WAL_21_CNI_REN":  # Check if it's a panel
        apartment = attrs.get("apartment")
        if apartment not in apartment_panels:
            apartment_panels[apartment] = []
        apartment_panels[apartment].append(node)

for apartment, panel_nodes in apartment_panels.items():
    print(f"\nProcessing apartment: {apartment} with {len(panel_nodes)} panels.")

    # Create a subgraph for this apartment
    subgraph = G.subgraph(panel_nodes).copy()

    # Debug: Check nodes and edges in the subgraph
    print(f"  Subgraph nodes: {list(subgraph.nodes)}")
    print(f"  Subgraph edges: {list(subgraph.edges)}")

    # Cut edges linking to nodes outside the subgraph
    for node in list(subgraph.nodes):
        for neighbor in list(subgraph.neighbors(node)):
            if neighbor not in subgraph:
                subgraph.remove_edge(node, neighbor)
                print(f"  Cut edge {node} <-> {neighbor} (not in subgraph).")

    # Assign "WAL_22_STD_REN" to panels with no "Identical" edges in the subgraph
    for node in subgraph.nodes:
        if subgraph.nodes[node].get("panel_type") == "WAL_21_CNI_REN":
            has_identical_edge = any(
                subgraph[node][neighbor].get("type") == "identical" for neighbor in subgraph.neighbors(node)
            )
            if not has_identical_edge:
                G.nodes[node]["panel_type"] = "WAL_22_STD_REN"
                print(f"  Panel {node}: Assigned WAL_22_STD_REN (isolated in subgraph).")

# Apply Rule 4: For panel nodes that have an edge 'belongs_to' a bathroom room
for node, attrs in G.nodes(data=True):
    # Check if the node is a panel (not a room or apartment)
    if attrs.get("panel_type"):
        for neighbor in G.neighbors(node):
            neighbor_attrs = G.nodes[neighbor]
            # Check if the neighbor is a "bathroom" room
            if neighbor_attrs.get("type") == "room" and neighbor_attrs.get("room_type") == "bathroom":
                if attrs["panel_type"] == "WAL_21_CNI_REN":
                    # Replace panel_type with "WAL_45_STD_TIL  "
                    G.nodes[node]["panel_type"] = "WAL_45_STD_TIL  "
                    print(f"Rule 4 applied (replaced): Node {node} updated to {G.nodes[node]['panel_type']}")
                else:
                    # Append "WAL_45_STD_TIL " to the existing panel_type
                    G.nodes[node]["panel_type"] += " WAL_45_STD_TIL "
                    print(f"Rule 4 applied (appended): Node {node} updated to {G.nodes[node]['panel_type']}")
                break  # No need to check other neighbors

# Apply Rule 5: For panel nodes satisfying the conditions described
for node, attrs in G.nodes(data=True):
    if attrs.get("panel_type"):  # Ensure the node is a panel (has a non-empty panel_type)
        # Check if the panel has a "belongs_to" edge with a corridor or living room
        has_corridor_or_living_room_connection = False
        connected_panels = []

        for neighbor in G.neighbors(node):
            neighbor_attrs = G.nodes[neighbor]
            # Check for a connection to "corridor" or "living room"
            if (
                neighbor_attrs.get("type") == "room" and
                neighbor_attrs.get("room_type") in ["corridor", "living_room"]
            ):
                has_corridor_or_living_room_connection = True
            # Collect panels connected by "Identical" edges
            elif G[node][neighbor].get("type") == "identical":
                connected_panels.append(neighbor)

        # If connected to a corridor or living room, check further
        if has_corridor_or_living_room_connection:
            for panel in connected_panels:
                panel_attrs = G.nodes[panel]
                # Ensure the connected panel has a non-empty panel_type
                if panel_attrs.get("panel_type"):
                    for second_neighbor in G.neighbors(panel):
                        second_neighbor_attrs = G.nodes[second_neighbor]
                        # Check if the second neighbor is a bathroom
                        if (
                            second_neighbor_attrs.get("type") == "room" and
                            second_neighbor_attrs.get("room_type") == "bathroom"
                        ):
                            # Assign "WAL_43_STD_REN" to the original panel node
                            G.nodes[node]["panel_type"] = "WAL_43_STD_REN"
                            print(f"Rule 5 applied: Node {node} updated to {G.nodes[node]['panel_type']}")
                            break  # No need to check further


# Apply Rule 6: Assign "WAL_40_STD_REN" to the rest of the panel nodes
for node, attrs in G.nodes(data=True):
    if attrs.get("panel_type") == "WAL_21_CNI_REN":
        G.nodes[node]["panel_type"] = "WAL_40_STD_REN"
        print(f"Rule 6 applied: Node {node} updated to {G.nodes[node]['panel_type']}")


# Save the updated graph to a new GraphML file
try:
    nx.write_graphml(G, output_graphml)
    print(f"\nUpdated graph saved to {output_graphml}.")
except nx.NetworkXError as e:
    print(f"\nGraphML Export Error: {e}")
