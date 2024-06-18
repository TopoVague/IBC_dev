from flask import Flask, request, render_template, send_file, jsonify
import json
import ifcopenshell
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/script.js')
def serve_script():
    return send_file('script.js')

@app.route('/export_ifc', methods=['POST'])
def export_ifc():
    data = request.get_json()
    width = data['width']
    height = data['height']
    depth = data['depth']
    file_path = 'TestExport.ifc'

    if os.path.exists(file_path):
        os.remove(file_path)
    
    create_ifc_file(width, height, depth, file_path)
    return send_file(file_path, as_attachment=True)


# the method that creates the ifc file
def create_ifc_file(width, height, depth, file_path):

    #define the IFC schema
    model = ifcopenshell.file(schema="IFC4")
    #timestamp = time.time()
    #timestring = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(timestamp))
    #creator = "Evan Pantazis"
    #organization = "ZHAW"
    #application, application_version = "IfcOpenShell", "0.7"
    #project_globalid, project_name = create_guid(), "Hello Wall"

    # Create a new project
    project = model.createIfcProject(ifcopenshell.guid.new(), Name="Implenia Sample Project")

    # Create a new context
    context = model.createIfcGeometricRepresentationContext(
        ContextIdentifier='Building Model',
        ContextType='Model',
        CoordinateSpaceDimension=3,
        Precision=1e-5,
        WorldCoordinateSystem=model.createIfcAxis2Placement3D(
            Location=model.createIfcCartesianPoint((0.0, 0.0, 0.0))
        ),
        TrueNorth=model.createIfcDirection((0.0, 1.0, 0.0))
    )
    
    # Create a site
    site = model.createIfcSite(ifcopenshell.guid.new(), CompositionType='ELEMENT', RefElevation=0.0)
    
    # Create a building
    building = model.createIfcBuilding(ifcopenshell.guid.new(), CompositionType='ELEMENT')
    
    # Create a building storey
    building_storey = model.createIfcBuildingStorey(ifcopenshell.guid.new(), CompositionType='ELEMENT', Elevation=0.0)
    
    
    # Aggregate the elements
    model.createIfcRelAggregates(ifcopenshell.guid.new(), RelatingObject=project, RelatedObjects=[site])
    model.createIfcRelAggregates(ifcopenshell.guid.new(), RelatingObject=site, RelatedObjects=[building])
    model.createIfcRelAggregates(ifcopenshell.guid.new(), RelatingObject=building, RelatedObjects=[building_storey])
    
    # Create a wall
    #wall = model.createIfcWallStandardCase(ifcopenshell.guid.new())
    wall = model.create_entity('IfcWall', GlobalId=ifcopenshell.guid.new(), Name='Implenia Wall Name') 
    # Define the wall placement
    wall_placement = model.createIfcLocalPlacement(
        RelativePlacement=model.createIfcAxis2Placement3D(
            Location=model.createIfcCartesianPoint((0.0, 0.0, 0.0))
        )
    )
    wall.ObjectPlacement = wall_placement
    
    # Define the wall geometry
    rectangle_profile = model.createIfcRectangleProfileDef(
        ProfileType='AREA',
        XDim=width,
        YDim=depth
    )
    
    # Define the extrusion direction and depth
    extrusion = model.createIfcExtrudedAreaSolid(
        SweptArea=rectangle_profile,
        Depth=height,
        ExtrudedDirection=model.createIfcDirection((0.0, 0.0, 1.0)),
        Position=model.createIfcAxis2Placement3D(
            Location=model.createIfcCartesianPoint((0.0, 0.0, 0.0))
        )
    )
    
    # Create the wall shape representation
    shape_representation = model.createIfcShapeRepresentation(
        ContextOfItems=context,
        RepresentationIdentifier='Body',
        RepresentationType='SweptSolid',
        Items=[extrusion]
    )
    # wall repsentation - in order to be able to show the wall
    wall.Representation = model.createIfcProductDefinitionShape(Representations=[shape_representation])
    # Assign the wall to the building storey
    model.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[wall])

    print(f"IFC file created at: {file_path}")
    print(f"dimension: {width}")

    # Write the IFC file
    model.write(file_path)

if __name__ == '__main__':
    app.run(debug=True)
