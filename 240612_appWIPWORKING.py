from flask import Flask,render_template, request, send_file
import ifcopenshell
import tempfile
import os
import uuid
import time

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')


create_guid = lambda: ifcopenshell.guid.compress(uuid.uuid1().hex)

   

def create_ifc_file(width, height, depth, file_path):
    
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


@app.route('/export_ifc', methods=['POST'])
def export_ifc():
    data = request.json
    width = data['width']
    height = data['height']
    depth = data['depth']

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.ifc')
    temp_file.close()

    create_ifc_file(1, 3, 0.3, temp_file.name)
    return send_file(temp_file.name, as_attachment=True, download_name='TestExport.ifc')

if __name__ == '__main__':
    app.run(debug=True)
