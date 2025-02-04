import json
import xml.etree.ElementTree as ET
import sys
import argparse
import re

def is_numeric_id(node_id):

    return node_id.isdigit()

def parse_graphml(graphml_path):

    tree = ET.parse(graphml_path)
    root = tree.getroot()
    
    namespaces = {'graphml': 'http://graphml.graphdrawing.org/xmlns'}
    
    panel_types = {}
    
    for node in root.findall('.//graphml:node', namespaces):
        node_id = node.get('id')
        if is_numeric_id(node_id):
            panel_type = None
            for data in node.findall('graphml:data', namespaces):
                if data.get('key') == 'd0':
                    panel_type = data.text.strip()
                    break
            if panel_type:
                panel_types[node_id] = panel_type
            else:
                print(f"Warning: No panel_type found for node ID {node_id}.")
    
    return panel_types

def update_floorplan_json(json_path, panel_types, output_path):
    with open(json_path, 'r') as f:
        floorplan = json.load(f)
    
    panels = floorplan.get('panels', {}).get('items', {})
    
    for panel_id, new_panel_type in panel_types.items():
        panel = panels.get(panel_id)
        if panel:
            old_panel_type = panel.get('panel_type', '')
            panel['panel_type'] = new_panel_type
            print(f"Updated panel ID {panel_id}: '{old_panel_type}' -> '{new_panel_type}'")
        else:
            print(f"Warning: Panel ID {panel_id} not found in JSON.")
    
    # Write the updated JSON to the output path
    with open(output_path, 'w') as f:
        json.dump(floorplan, f, indent=4)
    
    print(f"\nUpdated floorplan saved to '{output_path}'.")

def main():
    parser = argparse.ArgumentParser(description='Update panel_type in floorplan.json based on GraphML data.')
    parser.add_argument('--graphml', required=True, help='Path to the GraphML file.')
    parser.add_argument('--json', required=True, help='Path to the floorplan.json file.')
    parser.add_argument('--output', required=False, default='updated_floorplan.json', help='Path to save the updated JSON file.')
    
    args = parser.parse_args()
    
    graphml_path = args.graphml
    json_path = args.json
    output_path = args.output
    
    print(f"Parsing GraphML file: '{graphml_path}'")
    panel_types = parse_graphml(graphml_path)
    
    if not panel_types:
        print("No panel types found to update. Exiting.")
        sys.exit(1)
    
    print(f"Found {len(panel_types)} panels to update.\n")
    
    print(f"Updating JSON file: '{json_path}'")
    update_floorplan_json(json_path, panel_types, output_path)

if __name__ == "__main__":
    main()
