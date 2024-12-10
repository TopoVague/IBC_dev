import json
import uuid
import time
import tempfile
import ifcopenshell
import numpy as np
import argparse
import sys
import os

def create_ifcaxis2placement(ifcfile, point=(0.0, 0.0, 0.0), dir1=(0.0, 0.0, 1.0), dir2=(1.0, 0.0, 0.0)):
    point_list = [float(coord) for coord in point]
    dir1_list = [float(coord) for coord in dir1]
    dir2_list = [float(coord) for coord in dir2]
    
    point_entity = ifcfile.createIfcCartesianPoint(point_list)
    dir1_entity = ifcfile.createIfcDirection(dir1_list)
    dir2_entity = ifcfile.createIfcDirection(dir2_list)
    return ifcfile.createIfcAxis2Placement3D(point_entity, dir1_entity, dir2_entity)

def create_ifclocalplacement(ifcfile, point=(0.0, 0.0, 0.0), relative_to=None):
    axis2placement = create_ifcaxis2placement(ifcfile, point)
    return ifcfile.createIfcLocalPlacement(relative_to, axis2placement)

def create_ifcpolyline(ifcfile, point_list):
    ifc_points = []
    for point in point_list:
        if len(point) == 2:
            point = tuple(point) + (0.0,)
        elif len(point) == 3:
            point = tuple(point)
        else:
            raise ValueError("Point must have 2 or 3 coordinates")
        
        point_list_converted = [float(coord) for coord in point]
        ifc_point = ifcfile.createIfcCartesianPoint(point_list_converted)
        ifc_points.append(ifc_point)
    return ifcfile.createIfcPolyLine(ifc_points)

def create_ifcextrudedareasolid(ifcfile, point_list, ifcaxis2placement, extrude_dir, extrusion):
    polyline = create_ifcpolyline(ifcfile, point_list)
    closed_profile = ifcfile.createIfcArbitraryClosedProfileDef("AREA", None, polyline)
    extrusion_direction = ifcfile.createIfcDirection([float(coord) for coord in extrude_dir])
    return ifcfile.createIfcExtrudedAreaSolid(closed_profile, ifcaxis2placement, extrusion_direction, extrusion)

def generate_guid():
    return ifcopenshell.guid.compress(uuid.uuid1().hex)

def parse_arguments():
    parser = argparse.ArgumentParser(description='Generate IFC file from JSON input.')
    parser.add_argument('json_file', type=str, help='Path to the input JSON file.')
    parser.add_argument('-o', '--output', type=str, default='3d_reconstruction.ifc',
                        help='Output IFC filename')
    return parser.parse_args()

def main():
    args = parse_arguments()
    json_filename = args.json_file
    output_filename = args.output

    if not os.path.isfile(json_filename):
        print(f"JSON file '{json_filename}' does not exist.")
        sys.exit(1)

    with open(json_filename, 'r') as f:
        data = json.load(f)

    panels = data.get('panels', {})
    panels_items = panels.get('items', {})
    n_panels = int(panels.get('max_key', 0))

    # Define direction vectors
    X = (1.0, 0.0, 0.0)
    Y = (0.0, 1.0, 0.0)
    Z = (0.0, 0.0, 1.0)

    # Define the new origin from JSON (assuming a margin)
    margin = 20  # Defined margin in your JavaScript code
    canvas_height = 800  # Example canvas height (adjust this if different)
    originX = margin
    originY = canvas_height - margin

    # Initialize lists to store panel data
    start_points = []
    end_points = []  
    directions = []
    lengths = []
    heights = []
    types = []
    wall_openings = []

    for i in range(n_panels):
        item = panels_items.get(str(i), {})
        panel_type = item.get('panel_type', 'DefaultType')

        # Adjust coordinates relative to the origin
        start_point = tuple(item.get('start_point', [0.0, 0.0, 0.0]))
        end_point = tuple(item.get('end_point', [0.0, 0.0, 0.0]))

        adjusted_start_point = (
            start_point[0] - originX,
            originY - start_point[1],  # Flipping the y-axis
            start_point[2]
        )

        adjusted_end_point = (
            end_point[0] - originX,
            originY - end_point[1],  # Flipping the y-axis
            end_point[2]
        )

        height = item.get('height', 3.0)
        thickness = item.get('thickness', 0.2)

        # Compute direction vector and length
        vector = np.array(adjusted_end_point) - np.array(adjusted_start_point)
        length = np.linalg.norm(vector)
        if length == 0:
            continue  # Skip panels with zero length
        direction = tuple(vector / length)

        # Adjusted code to process multiple openings per wall
        openings = []
        opening_starts = item.get('opening_start', [])
        opening_dimensions = item.get('opening_dimension', [])
        if opening_starts and opening_dimensions:
            min_len = min(len(opening_starts), len(opening_dimensions))
            for j in range(min_len):
                openings.append({
                    'start_along_wall': float(opening_starts[j]),
                    'sill_height': float(opening_dimensions[j][0]),
                    'width': float(opening_dimensions[j][1]),
                    'height': float(opening_dimensions[j][2])
                })

        start_points.append(adjusted_start_point)
        end_points.append(adjusted_end_point)  
        directions.append(direction)
        lengths.append(round(length, 1))
        heights.append(round(height, 1))
        types.append(panel_type)
        wall_openings.append(openings)

    timestamp = time.time()
    timestring = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(timestamp))
    creator = "Your Name"
    organization = "Your Organization"
    application, application_version = "IfcOpenShell", "0.5"
    project_globalid, project_name = generate_guid(), "Walls Relative to Origin"

    # Create a temporary IFC file with the header
    temp_handle, temp_filename = tempfile.mkstemp(suffix=".ifc")
    with os.fdopen(temp_handle, 'w') as f:
        f.write(f"""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('{output_filename}','{timestring}',('{creator}'),('{organization}'),'{application}','{application}','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPERSON($,$,'{creator}',$,$,$,$,$);
#2=IFCORGANIZATION($,'{organization}',$,$,$);
#3=IFCPERSONANDORGANIZATION(#1,#2,$);
#4=IFCAPPLICATION(#2,'{application_version}','{application}','');
#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,#3,#4,{int(timestamp)});
ENDSEC;
END-ISO-10303-21;
""")

    # Open the temporary IFC file
    ifcfile = ifcopenshell.open(temp_filename)
    owner_history = ifcfile.by_type("IfcOwnerHistory")[0]
    geometric_contexts = ifcfile.by_type("IfcGeometricRepresentationContext")
    if not geometric_contexts:
        # Create a new IfcGeometricRepresentationContext if none exists
        geometric_context = ifcfile.createIfcGeometricRepresentationContext(
            context_identifier="Model",
            context_type="Model",
            coordinate_space_dimension=3,
            precision=1e-05,
            world_coordinate_system=create_ifcaxis2placement(ifcfile),
            true_north=ifcfile.createIfcDirection([0.0, 1.0, 0.0])
        )
    else:
        geometric_context = geometric_contexts[0]

    # Create walls based on the adjusted coordinates
    for i in range(len(start_points)):
        start_point = start_points[i]
        direction = directions[i]
        length = lengths[i]
        height = heights[i]
        wall_type = types[i]

        # Wall placement
        wall_placement = create_ifclocalplacement(ifcfile, point=start_point)

        # Extrusion placement
        extrusion_placement = create_ifcaxis2placement(ifcfile)

        # Create wall profile
        offset = tuple((0.5 * 0.2) * x for x in direction)
        first_point = tuple(start_point[j] + offset[j] for j in range(3))
        second_point = tuple(first_point[j] + length * direction[j] for j in range(3))
        third_point = tuple(second_point[j] - 0.2 * direction[j] for j in range(3))
        fourth_point = tuple(third_point[j] - length * direction[j] for j in range(3))

        point_list = [first_point, second_point, third_point, fourth_point, first_point]

        wall_solid = create_ifcextrudedareasolid(ifcfile, point_list, extrusion_placement, (0.0, 0.0, 1.0), height)
        body_representation = ifcfile.createIfcShapeRepresentation(geometric_context, "Body", "SweptSolid", [wall_solid])
        product_shape = ifcfile.createIfcProductDefinitionShape(None, None, [body_representation])

        wall = ifcfile.createIfcWallStandardCase(
            generate_guid(), owner_history, wall_type, "An example wall", None,
            wall_placement, product_shape, None
        )

        # Relate the wall to the building storey
        ifcfile.createIfcRelContainedInSpatialStructure(
            generate_guid(), owner_history, "Building Storey Container", None, [wall], wall_placement
        )

    # Write the IFC file
    ifcfile.write(output_filename)
    print(f"IFC file '{output_filename}' has been created.")

if __name__ == "__main__":
    main()