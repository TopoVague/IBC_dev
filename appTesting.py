from flask import Flask, request, render_template, send_file, jsonify
import ifcopenshell
import os
import time
import uuid
import tempfile
import logging

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)


@app.route('/')
def index():
    return render_template('index.html')
    #return render_template('helloThree.html')
@app.route('/script.js')
def serve_script():
    return send_file('script.js')

@app.route('/export_ifc', methods=['POST'])
def export_ifc():
    data = request.get_json()
    width = data['width']
    height = data['height']
    depth = data['depth']
    #name = data['name']
    name = 'An element  name'
    category = 'WALL'
    #category = data['category']
    file_path = 'TestExport.ifc'
    
    if os.path.exists(file_path):
        os.remove(file_path)
    
    create_ifc_file(file_path, width, height, depth, name, category)
    #create_ifc_file(file_path, width, height, depth, name, category)
    return send_file(file_path, as_attachment=True)

# Helper function definitions
create_guid = lambda: ifcopenshell.guid.compress(uuid.uuid1().hex)
O = 0., 0., 0.
X = 1., 0., 0.
Y = 0., 1., 0.
Z = 0., 0., 1.

def create_ifcaxis2placement(ifcfile, point=O, dir1=Z, dir2=X):
    point = ifcfile.createIfcCartesianPoint(point)
    dir1 = ifcfile.createIfcDirection(dir1)
    dir2 = ifcfile.createIfcDirection(dir2)
    axis2placement = ifcfile.createIfcAxis2Placement3D(point, dir1, dir2)
    return axis2placement

def create_ifclocalplacement(ifcfile, point=O, dir1=Z, dir2=X, relative_to=None):
    axis2placement = create_ifcaxis2placement(ifcfile, point, dir1, dir2)
    ifclocalplacement = ifcfile.createIfcLocalPlacement(relative_to, axis2placement)
    return ifclocalplacement

def create_ifcpolyline(ifcfile, point_list):
    ifcpts = [ifcfile.createIfcCartesianPoint(point) for point in point_list]
    polyline = ifcfile.createIfcPolyLine(ifcpts)
    return polyline

def create_ifcextrudedareasolid(ifcfile, point_list, ifcaxis2placement, extrude_dir, extrusion):
    polyline = create_ifcpolyline(ifcfile, point_list)
    ifcclosedprofile = ifcfile.createIfcArbitraryClosedProfileDef("AREA", None, polyline)
    ifcdir = ifcfile.createIfcDirection(extrude_dir)
    ifcextrudedareasolid = ifcfile.createIfcExtrudedAreaSolid(ifcclosedprofile, ifcaxis2placement, ifcdir, extrusion)
    return ifcextrudedareasolid


def create_ifc_file(file_path, width, height, depth, name, category):
    try:
        print(f'Creating IFC file for {name} in category {category}')
        # IFC template creation
        filename = "output.ifc"
        timestamp = time.time()
        timestring = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(timestamp))
        creator = "Evan Pantazis"
        organization = "ZHAW"
        application, application_version = "IBC", "0.1"
        project_globalid, project_name = create_guid(), "Impenia Catalog Beta"
        
        # Template string
        template = f"""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('{filename}','{timestring}',('{creator}'),('{organization}'),'{application}','{application}','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPERSON($,$,'{creator}',$,$,$,$,$);
#2=IFCORGANIZATION($,'{organization}',$,$,$);
#3=IFCPERSONANDORGANIZATION(#1,#2,$);
#4=IFCAPPLICATION(#2,'{application_version}','{application}','');
#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,#3,#4,{timestamp});
#6=IFCDIRECTION((1.,0.,0.));
#7=IFCDIRECTION((0.,0.,1.));
#8=IFCCARTESIANPOINT((0.,0.,0.));
#9=IFCAXIS2PLACEMENT3D(#8,#7,#6);
#10=IFCDIRECTION((0.,1.,0.));
#11=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#9,#10);
#12=IFCDIMENSIONALEXPONENTS(0,0,0,0,0,0,0);
#13=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#14=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#15=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#16=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#17=IFCMEASUREWITHUNIT(IFCPLANEANGLEMEASURE(0.017453292519943295),#16);
#18=IFCCONVERSIONBASEDUNIT(#12,.PLANEANGLEUNIT.,'DEGREE',#17);
#19=IFCUNITASSIGNMENT((#13,#14,#15,#18));
#20=IFCPROJECT('{project_globalid}',#5,'{project_name}',$,$,$,$,(#11),#19);
ENDSEC;
END-ISO-10303-21;
"""

        # Write the template to a temporary file 
        with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as temp_file:
            temp_file.write(template.encode('utf-8'))
            temp_filename = temp_file.name
        
        # Load the temporary file using ifcopenshell
        ifcfile = ifcopenshell.open(temp_filename)
        owner_history = ifcfile.by_type("IfcOwnerHistory")[0]

        # Create a new context
        context = ifcfile.createIfcGeometricRepresentationContext(
            ContextIdentifier='Building Model',
            ContextType='Model',
            CoordinateSpaceDimension=3,
            Precision=1e-5,
            WorldCoordinateSystem=ifcfile.createIfcAxis2Placement3D(
                Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
            ),
            TrueNorth=ifcfile.createIfcDirection((0.0, 1.0, 0.0))
        )

        # IFC hierarchy creation
        site_placement = create_ifclocalplacement(ifcfile)

        #create a site for the 
        site = ifcfile.createIfcSite(create_guid(), owner_history, "An Implenia Site", None, None, site_placement, None, None, "ELEMENT", None, None, None, None, None)

        building_placement = create_ifclocalplacement(ifcfile, relative_to=site_placement)
        building = ifcfile.createIfcBuilding(create_guid(), owner_history, 'A MMC Building', None, None, building_placement, None, None, "ELEMENT", None, None, None)

        storey_placement = create_ifclocalplacement(ifcfile, relative_to=building_placement)
        elevation = 0.0
        building_storey = ifcfile.createIfcBuildingStorey(create_guid(), owner_history, 'Storey', None, None, storey_placement, None, None, "ELEMENT", elevation)

        container_storey = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Building Container", None, building, [building_storey])
        container_site = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Site Container", None, site, [building])
        container_project = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Project Container", None, ifcfile.by_type("IfcProject")[0], [site])
        # add a if else to check on category and based on that crteate  different .ifc geometry
        # Create a wall
        wallname = name
        wall = ifcfile.create_entity('IfcWall', GlobalId=ifcopenshell.guid.new(), Name='wallname') 
        wall_placement = ifcfile.createIfcLocalPlacement(
            RelativePlacement=ifcfile.createIfcAxis2Placement3D(
                Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
            )
        )
        wall.ObjectPlacement = wall_placement

        rectangle_profile = ifcfile.createIfcRectangleProfileDef(
            ProfileType='AREA',
            XDim=width,
            YDim=depth
        )

        extrusion = ifcfile.createIfcExtrudedAreaSolid(
            SweptArea=rectangle_profile,
            Depth=height,
            ExtrudedDirection=ifcfile.createIfcDirection((0.0, 0.0, 1.0)),
            Position=ifcfile.createIfcAxis2Placement3D(
                Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
            )
        )

        shape_representation = ifcfile.createIfcShapeRepresentation(
            ContextOfItems=context,
            RepresentationIdentifier='Body',
            RepresentationType='SweptSolid',
            Items=[extrusion]
        )

        wall.Representation = ifcfile.createIfcProductDefinitionShape(Representations=[shape_representation])
        ifcfile.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[wall])

        # Create and assign property set
        property_values = [
            ifcfile.createIfcPropertySingleValue("LoadBearing", "LoadBearing", ifcfile.create_entity("IfcBoolean", True), None),
            ifcfile.createIfcPropertySingleValue("FireRating", "FireRating", ifcfile.create_entity("IfcLabel", "Not Rated"), None)
        ]
        property_set = ifcfile.createIfcPropertySet(create_guid(), owner_history, "Pset_WallCommon", None, property_values)
        ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [wall], property_set)

        ifcfile.write(file_path)
        logging.info(f"IFC file successfully created at {file_path}")
    except Exception as e:
        logging.error(f"Error creating IFC file: {e}")
    finally:
        os.remove(temp_filename)

if __name__ == '__main__':
    app.run(debug=True)
