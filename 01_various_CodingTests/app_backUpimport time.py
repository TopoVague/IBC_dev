import time
import uuid
import tempfile
import logging
from dataclasses import dataclass

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)

#PARAMETERS TO PASS IN THE FILE
@dataclass
class ifcExportParameters:
    name: str
    codeName: str
    category: str
    width: float
    height: float
    depth: float
    position: bool
    isLoadBearing: bool
    isStiffening: bool
    fireRating: str
    fireRegulation: str
    prefabrication: str
    hasWaterPipes: bool
    hasHeating: bool
    hasVentilation: bool
    hasElectricPipes:bool
    acousticRating:str
    thermalRating:str

@app.route('/index.html')
def index():
    return render_template('index.html')
    #return render_template('helloThree.html')

@app.route('/catalog.html')
def Catalog():
    return render_template('catalog.html')

@app.route('/graphDB.html')
def graphDB():
    return render_template('graphDB.html')

@app.route('/about.html')
def About():
    return render_template('about.html')


@app.route('/script.js')
def serve_script():
    return send_file('script.js')



#EXPORT IFC FUNCTION 
@app.route('/export_ifc', methods=['POST'])
def export_ifc():
    # TO DO: FIGURE OUT HOW CAN I GET ALL THIS IN A SEPARATE CLASS
    data = request.get_json()
    width = data['width']
    height = data['height']
    depth = data['depth']
    #name = data['name']
    name = 'An element  name'
    category = 'WALL'
    #category = data['category']
    file_path = 'TestExport.ifc'
    
    ifcFileParams = ifcExportParameters(
        name = data['name'],
        codeName = data['codeName'],
        category = data['category'],
        width = float(data['width']),
        height = float(data['height']),
        depth = float(data['depth']),
        position = data['position'].lower().capitalize() == "True",
        isLoadBearing = data['position'].lower().capitalize() == "True",
        isStiffening = data['isStiffening'].lower().capitalize() == "True",
        fireRating = data['fireRating'],
        fireRegulation=data['fireRegulation'],
        prefabrication = data ['prefabrication'],
        hasWaterPipes = data['hasWaterPipes'].lower().capitalize() == "True",
        hasHeating =data['hasHeating'].lower().capitalize() == "True",
        hasVentilation = data['hasVentilation'].lower().capitalize() == "True",
        hasElectricPipes = data['hasElectricPipes'].lower().capitalize() == "True",
        acousticRating = data['acousticRating'],
        thermalRating = data['thermalRating'],
    )
 
  
    file_path = ifcFileParams.codeName+'.ifc'

    if os.path.exists(file_path):
        os.remove(file_path)
    
    create_ifc_file(file_path, width, height, depth, name, category)
    #create_ifc_file(file_path, width, height, depth, name, category)
    print('the passed data to write in the ifc file  are ',ifcFileParams)
    #print('object is load bearing? ',ifcFileParams.isLoadBearing)
    #print('object is stiffening? ',ifcFileParams.isStiffening)
    #print('object has fire rating? ',ifcFileParams.fireRating)
    #print('objects fabrication method? ',ifcFileParams.prefabrication)
    #print('objects acoustic rating? ',ifcFileParams.acousticRating)

    #CALL THE FUNCTION FOR CREATING THE IFC
    create_ifc_file(file_path, ifcFileParams)
    return send_file(file_path, as_attachment=True)

# Helper function definitions



# Helper function definitions for the IFC
create_guid = lambda: ifcopenshell.guid.compress(uuid.uuid1().hex)
#origin point
O = 0., 0., 0.
#X axis
X = 1., 0., 0.
#Y Axis
Y = 0., 1., 0.
#Z Axis Definition
Z = 0., 0., 1.

def create_ifcaxis2placement(ifcfile, point=O, dir1=Z, dir2=X):
def create_ifcextrudedareasolid(ifcfile, point_list, ifcaxis2placement, extrude_
    ifcextrudedareasolid = ifcfile.createIfcExtrudedAreaSolid(ifcclosedprofile, ifcaxis2placement, ifcdir, extrusion)
    return ifcextrudedareasolid


def create_ifc_file(file_path, width, height, depth, name, category):
    try:
        print(f'Creating IFC file for {name} in category {category}')
# Ifc file creation
def create_ifc_file(file_path, ifcFileParams):
    #sanity check print
    print(f'Creating IFC file for {ifcFileParams.codeName} in category {ifcFileParams.category}')
    
    try:  
        # IFC template creation
        filename = "output.ifc"
        filename = ifcFileParams.codeName+".ifc"
        ifcFileSchema = 'IFC2X3'
        timestamp = time.time()
        timestring = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(timestamp))
        creator = "Evan Pantazis"
        organization = "ZHAW"
        application, application_version = "IBC", "0.1"
        project_globalid, project_name = create_guid(), "Impenia Catalog Beta"
        
        # Template string
        # add here other parameters to be included , this will be passed by the frontend or from a file
        #UNIT type

        # Template string for IFC file
        template = f"""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('{filename}','{timestring}',('{creator}'),('{organization}'),'{application}','{application}','');
FILE_SCHEMA(('IFC2X3'));
FILE_SCHEMA(({ifcFileSchema}));
ENDSEC;
DATA;
#1=IFCPERSON($,$,'{creator}',$,$,$,$,$);
@ -136,85 +196,351 @@ END-ISO-10303-21;
        # Load the temporary file using ifcopenshell
        ifcfile = ifcopenshell.open(temp_filename)
        owner_history = ifcfile.by_type("IfcOwnerHistory")[0]
        owner_history = ifcfile.by_type("IfcOwnerHistory")[0]
        project = ifcfile.by_type("IfcProject")[0]
        
        site_placement = create_ifclocalplacement(ifcfile)
        siteName ="An Implenia Site"
        projectName = 'A MMC Building'
        floorName = 'Groundfloor'
        #assigned elevation
        elevation = 0.0

        # Create a new context
        # Create a new context for the file
        context = ifcfile.createIfcGeometricRepresentationContext(
            ContextIdentifier='Building Model',
            ContextType='Model',
            CoordinateSpaceDimension=3,
            Precision=1e-5,
            WorldCoordinateSystem=ifcfile.createIfcAxis2Placement3D(
                Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                #TO DO MAKE THIS A PARAMETER i.e origin Pt
                Location=ifcfile.createIfcCartesianPoint(((0.0,0.0,0.0)))
            ),
            #TO DO MAKE THIS A PARAMETER i.e northDir
            TrueNorth=ifcfile.createIfcDirection((0.0, 1.0, 0.0))
        )

        
        # IFC hierarchy creation
        site_placement = create_ifclocalplacement(ifcfile)

        #create a site for the 
        site = ifcfile.createIfcSite(create_guid(), owner_history, "An Implenia Site", None, None, site_placement, None, None, "ELEMENT", None, None, None, None, None)
        

        #create a site for the Project
        site = ifcfile.createIfcSite(create_guid(), owner_history, siteName, None, None, site_placement, None, None, "ELEMENT", None, None, None, None, None)
        
        #create the building and associate it to the site
        building_placement = create_ifclocalplacement(ifcfile, relative_to=site_placement)
        building = ifcfile.createIfcBuilding(create_guid(), owner_history, 'A MMC Building', None, None, building_placement, None, None, "ELEMENT", None, None, None)

        building = ifcfile.createIfcBuilding(create_guid(), owner_history, projectName, None, None, building_placement, None, None, "ELEMENT", None, None, None)
        
        #create the storey and associate it to the building
        storey_placement = create_ifclocalplacement(ifcfile, relative_to=building_placement)
        elevation = 0.0
        building_storey = ifcfile.createIfcBuildingStorey(create_guid(), owner_history, 'Storey', None, None, storey_placement, None, None, "ELEMENT", elevation)
        building_storey = ifcfile.createIfcBuildingStorey(create_guid(), owner_history, floorName, None, None, storey_placement, None, None, "ELEMENT", elevation)

        #NEED TO LOOK INTO THOSE
        container_storey = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Building Container", None, building, [building_storey])
        container_site = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Site Container", None, site, [building])
        container_project = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Project Container", None, ifcfile.by_type("IfcProject")[0], [site])
        container_project = ifcfile.createIfcRelAggregates(create_guid(), owner_history, "Project Container", None, ifcfile.by_type(projectName)[0], [site])    
        #print("the name of the object to export is: " , ifcFileParams.name)
        # add a if else to check on category and based on that crteate  different .ifc geometry
        # Create a wall
        wallname = name
        wall = ifcfile.create_entity('IfcWall', GlobalId=ifcopenshell.guid.new(), Name='wallname') 
        wall_placement = ifcfile.createIfcLocalPlacement(
            RelativePlacement=ifcfile.createIfcAxis2Placement3D(
                Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
        
        
        #HERE MAYBE ADD A CHECK ABOUT THE VARIATION AND CREATE MATERIAL ACCORDINGLY
        if (ifcFileParams.category == "wall"):
        #TO DO CHECK FOR PART/WALL VARIATION
        #WALL CREATION
            print ("got the object category and I am WALL")

            # DECLARE PARAMETERS some parameters 
            elementOriginPt = [0.0, 0.0, 0.0]
            elementEndPt = [ifcFileParams.width,0.0,0.0]
            elementMaterial_A = "implenia wall material"
            elementHasOpening = False
            openingOffsetFromOrign = 250.0
            openingWidth = 500.0
            openingSillHeight = 1000.0
            openingHeight = 1200.0

            # TO DO  Define and associate the wall material
            #here poarse the info from the elements
            material = ifcfile.createIfcMaterial(elementMaterial_A)
            materialThickness= 0.2
            material_layer = ifcfile.createIfcMaterialLayer(material, materialThickness, None)
            material_layer_set = ifcfile.createIfcMaterialLayerSet([material_layer], None)
            material_layer_set_usage = ifcfile.createIfcMaterialLayerSetUsage(material_layer_set, "AXIS2", "POSITIVE", -0.1)
            ifcfile.createIfcRelAssociatesMaterial(create_guid(), owner_history, RelatedObjects=[wall], RelatingMaterial=material_layer_set_usage)
            
            # Wall creation: Define the wall shape as a polyline axis and an extruded area solid
            wall_placement = ifcfile.create_ifclocalplacement(ifcfile, relative_to=storey_placement)

            # Wall CENTERLINE
            wall_centerPolyline = ifcfile.create_ifcpolyline(ifcfile, [elementOriginPt, elementEndPt])
            
            axis_representation = ifcfile.createIfcShapeRepresentation(context, "Axis", "Curve2D", [wall_centerPolyline])
            extrusion_placement = ifcfile.create_ifcaxis2placement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))

            #DEFINE THE WALL PROFILE
            wall_profile = [(0.0, -ifcFileParams.depth/2, 0.0), (ifcFileParams.width, -ifcFileParams.depth/2, 0.0), (ifcFileParams.width, ifcFileParams.depth/2, 0.0), (0.0, ifcFileParams.depth/2, 0.0), (0.0, -ifcFileParams.depth/2, 0.0)]
            #alternatibve method to define profile 
            wall_rectangle_profile = ifcfile.createIfcRectangleProfileDef(
                ProfileType='AREA',
                XDim=ifcFileParams.width, 
                YDim=ifcFileParams.depth
            )
        )
        wall.ObjectPlacement = wall_placement

        rectangle_profile = ifcfile.createIfcRectangleProfileDef(
            ProfileType='AREA',
            XDim=width,
            YDim=depth
        )
            wall_solid = create_ifcextrudedareasolid(ifcfile, wall_profile, extrusion_placement, (0.0, 0.0, 1.0), ifcFileParams.height)
            body_representation = ifcfile.createIfcShapeRepresentation(context, "Body", "SweptSolid", [wall_solid])
            product_shape = ifcfile.createIfcProductDefinitionShape(None, None, [axis_representation, body_representation])
          
            #CREATE THE WALL OBJECT
            wall = ifcfile.createIfcWallStandardCase(create_guid(), owner_history, ifcFileParams.codeName, ifcFileParams.name, None, wall_placement, product_shape, None)  
            
            # CREATE AND ASSIGN PROPERTIES TO THE ELEMENT
            property_values = [
                ifcfile.createIfcPropertySingleValue("isExternal", "isExternal", ifcfile.create_entity("IfcBoolean", ifcFileParams.position), None),
                ifcfile.createIfcPropertySingleValue("Prefabrication", "Prefabrication", ifcfile.create_entity("IfcLabel", ifcFileParams.prefabrication), None),
                ifcfile.createIfcPropertySingleValue("LoadBearing", "LoadBearing", ifcfile.create_entity("IfcBoolean", ifcFileParams.isLoadBearing), None),
                ifcfile.createIfcPropertySingleValue("StiffeningFunction", "StiffeningFunction", ifcfile.create_entity("IfcBoolean", ifcFileParams.isStiffening), None),
                ifcfile.createIfcPropertySingleValue("FireRating", "FireRating", ifcfile.create_entity("IfcLabel", ifcFileParams.fireRating), None),
                ifcfile.createIfcPropertySingleValue("FireRegulation", "FireRegulation", ifcfile.create_entity("IfcLabel", ifcFileParams.fireRegulation), None),
                ifcfile.createIfcPropertySingleValue("WaterPipeInstallations", "hasWaterPipes", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasWaterPipes), None),
                ifcfile.createIfcPropertySingleValue("HeatingPipeInstallations", "hasHeating", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasHeating), None),
                ifcfile.createIfcPropertySingleValue("VentialtingPipeInstallations", "hasVentilation", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasVentilation), None),
                ifcfile.createIfcPropertySingleValue("AcousticRating", "acousticRating", ifcfile.create_entity("IfcLabel", ifcFileParams.acousticRating), None),
                ifcfile.createIfcPropertySingleValue("thermalRating", "thermalRating", ifcfile.create_entity("IfcLabel", ifcFileParams.thermalRating), None)
            ]
            property_set = ifcfile.createIfcPropertySet(create_guid(), owner_history, "Implenia PropertySet", None, property_values)
            ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [wall], property_set)

            # ADD QUANTITIES
            # qunatities aRE WRITTEN BUT FOR NOT VISIBLE IN SPECKLE
            quantity_values = [
                ifcfile.createIfcQuantityLength("Length", "Length of the wall", None, 1.0),
                ifcfile.createIfcQuantityArea("Area", "Area of the front face", None, 1.0),
                ifcfile.createIfcQuantityVolume("Volume", "Volume of the wall", None, 1.0)
            ]
            part_quantity = ifcfile.createIfcElementQuantity(create_guid(), owner_history, "implenia BaseQuantities", None, None, quantity_values)
            print("Testing the export of quantities,....:", part_quantity)
            ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [wall], part_quantity)

        extrusion = ifcfile.createIfcExtrudedAreaSolid(
            SweptArea=rectangle_profile,
            Depth=height,
            ExtrudedDirection=ifcfile.createIfcDirection((0.0, 0.0, 1.0)),
            Position=ifcfile.createIfcAxis2Placement3D(
                Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
            if (elementHasOpening == True):

                # Create and associate an opening for the window in the wall
                opening_placement = create_ifclocalplacement(ifcfile, (openingOffsetFromOrign, 0.0, openingSillHeight), (0.0, 0.0, openingSillHeight), (openingOffset, 0.0, 0.0), wall_placement)
                opening_extrusion_placement = create_ifcaxis2placement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))  
                
                point_list_opening_extrusion_area = [(0.0, -ifcFileParams.depth/2, 0.0), (openingWidth, -ifcFileParams.depth/2, 0.0), (openingWidth, ifcFileParams.depth/2, 0.0), (0.0, ifcFileParams.depth/2, 0.0), (0.0, -ifcFileParams.depth/2, 0.0)]
                opening_solid = create_ifcextrudedareasolid(ifcfile, point_list_opening_extrusion_area, opening_extrusion_placement, (0.0, 0.0, 1.0), openingHeight)
                opening_representation = ifcfile.createIfcShapeRepresentation(context, "Body", "SweptSolid", [opening_solid])
                opening_shape = ifcfile.createIfcProductDefinitionShape(None, None, [opening_representation])
                
                #CREATE THE OPENING ON THE WALL
                opening_element = ifcfile.createIfcOpeningElement(create_guid(), owner_history, "Opening", "An Implenia opening", None, opening_placement, opening_shape, None)
                ifcfile.createIfcRelVoidsElement(create_guid(), owner_history, None, None, wall, opening_element)

                # Create a simplified representation for the Window
                #axis definition
                window_placement = create_ifclocalplacement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), opening_placement)
                window_extrusion_placement = create_ifcaxis2placement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))

                point_list_window_extrusion_area = [(0.0, -ifcFileParams.depth/8, 0.0), (openingWidth, -ifcFileParams.depth/8, 0.0), (openingWidth, ifcFileParams.depth/8, 0.0), (0.0, ifcFileParams.depth/8, 0.0), (0.0, -ifcFileParams.depth/8, 0.0)]
                window_solid = create_ifcextrudedareasolid(ifcfile, point_list_window_extrusion_area, window_extrusion_placement, (0.0, 0.0, 1.0), openingHeight)
                window_representation = ifcfile.createIfcShapeRepresentation(context, "Body", "SweptSolid", [window_solid])
                window_shape = ifcfile.createIfcProductDefinitionShape(None, None, [window_representation])
                window = ifcfile.createIfcWindow(create_guid(), owner_history, "Window", "An awesome window", None, window_placement, window_shape, None, None)

                # Relate the window to the opening element
                ifcfile.createIfcRelFillsElement(create_guid(), owner_history, None, None, opening_element, window)
                # Relate the window and wall to the building storey
                ifcfile.createIfcRelContainedInSpatialStructure(create_guid(), owner_history, "Building Storey Container", None, [wall, window], building_storey)
            else:
                # NEED TO CHECK THE LINE BELOW 
                ifcfile.createIfcRelContainedInSpatialStructure(create_guid(), owner_history, "Building Storey Container", None, [wall], building_storey)

            # Write the contents of the file to disk
            ifcfile.write(filename)
            #END OF WALL CREATION
        elif (ifcFileParams.category == "slab"):
        #SLAB CREATION
            print ("Doing a basic slab export")
            slab = ifcfile.create_entity('IfcSlab', GlobalId=ifcopenshell.guid.new(), Name=ifcFileParams.codeName) 
            slab_placement = ifcfile.createIfcLocalPlacement(
                RelativePlacement=ifcfile.createIfcAxis2Placement3D(
                    Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                )
            )
        )
            slab.ObjectPlacement = slab_placement

        shape_representation = ifcfile.createIfcShapeRepresentation(
            ContextOfItems=context,
            RepresentationIdentifier='Body',
            RepresentationType='SweptSolid',
            Items=[extrusion]
        )
            rectangle_profile = ifcfile.createIfcRectangleProfileDef(
                ProfileType='AREA',
                XDim=ifcFileParams.width,
                YDim=ifcFileParams.height
            )

        wall.Representation = ifcfile.createIfcProductDefinitionShape(Representations=[shape_representation])
        ifcfile.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[wall])
            extrusion = ifcfile.createIfcExtrudedAreaSolid(
                SweptArea=rectangle_profile,
                Depth=ifcFileParams.depth,
                ExtrudedDirection=ifcfile.createIfcDirection((0.0, 0.0, 1.0)),
                Position=ifcfile.createIfcAxis2Placement3D(
                    #TO DO make origin PT a parameter
                    Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                )
            )

        # Create and assign property set
        property_values = [
            ifcfile.createIfcPropertySingleValue("LoadBearing", "LoadBearing", ifcfile.create_entity("IfcBoolean", True), None),
            ifcfile.createIfcPropertySingleValue("FireRating", "FireRating", ifcfile.create_entity("IfcLabel", "Not Rated"), None)
        ]
        property_set = ifcfile.createIfcPropertySet(create_guid(), owner_history, "Pset_WallCommon", None, property_values)
        ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [wall], property_set)
            shape_representation = ifcfile.createIfcShapeRepresentation(
                ContextOfItems=context,
                RepresentationIdentifier='Body',
                RepresentationType='SweptSolid',
                Items=[extrusion]
            )

            slab.Representation = ifcfile.createIfcProductDefinitionShape(Representations=[shape_representation])
            ifcfile.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[slab])
            
            #TO DO ADD PROPRTY SET AND QUANTITY
            # Create and assign property set
            property_values = [
                ifcfile.createIfcPropertySingleValue("isExternal", "isExternal", ifcfile.create_entity("IfcBoolean", ifcFileParams.position), None),
                ifcfile.createIfcPropertySingleValue("Prefabrication", "Prefabrication", ifcfile.create_entity("IfcLabel", ifcFileParams.prefabrication), None),
                ifcfile.createIfcPropertySingleValue("LoadBearing", "LoadBearing", ifcfile.create_entity("IfcBoolean", ifcFileParams.isLoadBearing), None),
                ifcfile.createIfcPropertySingleValue("StiffeningFunction", "StiffeningFunction", ifcfile.create_entity("IfcBoolean", ifcFileParams.isStiffening), None),
                ifcfile.createIfcPropertySingleValue("FireRating", "FireRating", ifcfile.create_entity("IfcLabel", ifcFileParams.fireRating), None),
                ifcfile.createIfcPropertySingleValue("FireRegulation", "FireRegulation", ifcfile.create_entity("IfcLabel", ifcFileParams.fireRegulation), None),
                ifcfile.createIfcPropertySingleValue("WaterPipeInstallations", "hasWaterPipes", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasWaterPipes), None),
                ifcfile.createIfcPropertySingleValue("HeatingPipeInstallations", "hasHeating", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasHeating), None),
                ifcfile.createIfcPropertySingleValue("VentialtingPipeInstallations", "hasVentilation", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasVentilation), None),
                ifcfile.createIfcPropertySingleValue("AcousticRating", "acousticRating", ifcfile.create_entity("IfcLabel", ifcFileParams.acousticRating), None),
                ifcfile.createIfcPropertySingleValue("thermalRating", "thermalRating", ifcfile.create_entity("IfcLabel", ifcFileParams.thermalRating), None)
            ]
            property_set = ifcfile.createIfcPropertySet(create_guid(), owner_history, "Implenia PropertySet", None, property_values)
            ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [slab], property_set)
            
            ifcfile.write(file_path)
            

        elif (ifcFileParams.category == "column"):
        #COLUMN CREATION
            print ("Doing a basic column export")
            column = ifcfile.create_entity('IfcColumn', GlobalId=ifcopenshell.guid.new(), Name=ifcFileParams.codeName) 
            column_placement = ifcfile.createIfcLocalPlacement(
                RelativePlacement=ifcfile.createIfcAxis2Placement3D(
                    Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                )
            )
            column.ObjectPlacement = column_placement

            rectangle_profile = ifcfile.createIfcRectangleProfileDef(
                ProfileType='AREA',
                XDim=ifcFileParams.depth,
                YDim=ifcFileParams.width
            )

            extrusion = ifcfile.createIfcExtrudedAreaSolid(
                SweptArea=rectangle_profile,
                Depth=ifcFileParams.height,
                ExtrudedDirection=ifcfile.createIfcDirection((0.0, 0.0, 1.0)),
                Position=ifcfile.createIfcAxis2Placement3D(
                    #TO DO make origin PT a parameter
                    Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                )
            )

        ifcfile.write(file_path)
            shape_representation = ifcfile.createIfcShapeRepresentation(
                ContextOfItems=context,
                RepresentationIdentifier='Body',
                RepresentationType='SweptSolid',
                Items=[extrusion]
            )

            column.Representation = ifcfile.createIfcProductDefinitionShape(Representations=[shape_representation])
            ifcfile.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[column])
            #TO DO ADD PROPRTY SET AND QUANTITY
            # Create and assign property set
            property_values = [
                ifcfile.createIfcPropertySingleValue("isExternal", "isExternal", ifcfile.create_entity("IfcBoolean", ifcFileParams.position), None),
                ifcfile.createIfcPropertySingleValue("Prefabrication", "Prefabrication", ifcfile.create_entity("IfcLabel", ifcFileParams.prefabrication), None),
                ifcfile.createIfcPropertySingleValue("LoadBearing", "LoadBearing", ifcfile.create_entity("IfcBoolean", ifcFileParams.isLoadBearing), None),
                ifcfile.createIfcPropertySingleValue("StiffeningFunction", "StiffeningFunction", ifcfile.create_entity("IfcBoolean", ifcFileParams.isStiffening), None),
                ifcfile.createIfcPropertySingleValue("FireRating", "FireRating", ifcfile.create_entity("IfcLabel", ifcFileParams.fireRating), None),
                ifcfile.createIfcPropertySingleValue("FireRegulation", "FireRegulation", ifcfile.create_entity("IfcLabel", ifcFileParams.fireRegulation), None),
                ifcfile.createIfcPropertySingleValue("WaterPipeInstallations", "hasWaterPipes", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasWaterPipes), None),
                ifcfile.createIfcPropertySingleValue("HeatingPipeInstallations", "hasHeating", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasHeating), None),
                ifcfile.createIfcPropertySingleValue("VentialtingPipeInstallations", "hasVentilation", ifcfile.create_entity("IfcBoolean", ifcFileParams.hasVentilation), None),
                ifcfile.createIfcPropertySingleValue("AcousticRating", "acousticRating", ifcfile.create_entity("IfcLabel", ifcFileParams.acousticRating), None),
                ifcfile.createIfcPropertySingleValue("thermalRating", "thermalRating", ifcfile.create_entity("IfcLabel", ifcFileParams.thermalRating), None)
            ]
            property_set = ifcfile.createIfcPropertySet(create_guid(), owner_history, "Implenia PropertySet", None, property_values)
            ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [column], property_set)
            ifcfile.write(file_path)

        elif (ifcFileParams.category == "beam"):
            #BEAM CREATION
            print ("Doing a basic BEAM export")
            beam = ifcfile.create_entity('IfcBeam', GlobalId=ifcopenshell.guid.new(), Name=ifcFileParams.codeName) 
            beam_placement = ifcfile.createIfcLocalPlacement(
                RelativePlacement=ifcfile.createIfcAxis2Placement3D(
                    Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                )
            )
            beam.ObjectPlacement = beam_placement

            rectangle_profile = ifcfile.createIfcRectangleProfileDef(
                ProfileType='AREA',
                XDim=ifcFileParams.depth,
                YDim=ifcFileParams.width
            )

            extrusion = ifcfile.createIfcExtrudedAreaSolid(
                SweptArea=rectangle_profile,
                Depth=ifcFileParams.height,
                ExtrudedDirection=ifcfile.createIfcDirection((0.0, 0.0, 1.0)),
                Position=ifcfile.createIfcAxis2Placement3D(
                    #TO DO make origin PT a parameter
                    Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
                )
            )

            shape_representation = ifcfile.createIfcShapeRepresentation(
                ContextOfItems=context,
                RepresentationIdentifier='Body',
                RepresentationType='SweptSolid',
                Items=[extrusion]
            )

            beam.Representation = ifcfile.createIfcProductDefinitionShape(Representations=[shape_representation])
            ifcfile.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[beam])
            #TO DO ADD PROPRTY SET AND QUANTITY
            ifcfile.write(file_path)

        elif (ifcFileParams.category == "3dmod"):
            print ("GOT IN the 3d module category, I will try to open a file, edit it and export it as an ifc")
            if ( ifcFileParams.name =="Implenia Module"):
                print ("yooo its true:" + ifcFileParams.name)
                #load Geometry from Ifc or obj
                ifcfile = ifcopenshell.open('C:/Users/panz/Documents\GitHub/IBC/02_assets/models/240229_ghx_ifc_export_3d_moduleTest01.ifc')
            elif( ifcFileParams.name =="Bathroom Pod"):
                print ("yooo its true:" + ifcFileParams.name)
                ifcfile = ifcopenshell.open('C:/Users/panz/Documents\GitHub/IBC/02_assets/models/bathroom_pod_A.ifc')
            else:
                print ("I do not have a model to load")
            # Edit data
            print(ifcfile.schema) # May return IFC2X3 or IFC4
            # Save/File Creation 
            ifcfile.write(file_path)
            
            
            

        else:
            print("NEED TO IMPLEMENT THIS") 
        #print a message to ensure file is save
        logging.info(f"IFC file successfully created at {file_path}")
        
    except Exception as e:
        logging.error(f"Error creating IFC file: {e}")
    finally:
        os.remove(temp_filename)


# run everything

if __name__ == '__main__':
    app.run(debug=True)