wall = ifcfile.create_entity('IfcWall', GlobalId=ifcopenshell.guid.new(), Name=ifcFileParams.codeName) 
wall_placement = ifcfile.createIfcLocalPlacement(
    RelativePlacement=ifcfile.createIfcAxis2Placement3D(
        Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
    )
)
wall.ObjectPlacement = wall_placement

#create wall profile
rectangle_profile = ifcfile.createIfcRectangleProfileDef(
    ProfileType='AREA',
    XDim=5000, 
    YDim=ifcFileParams.depth
)
#need to add that up ifcFileParams.width
print(ifcFileParams.width)
extrusion = ifcfile.createIfcExtrudedAreaSolid(
    SweptArea=rectangle_profile,
    Depth=ifcFileParams.height,
    ExtrudedDirection=ifcfile.createIfcDirection((0.0, 0.0, 1.0)),
    Position=ifcfile.createIfcAxis2Placement3D(
        Location=ifcfile.createIfcCartesianPoint((0.0, 0.0, 0.0))
    )
)
#create extrusion
shape_representation = ifcfile.createIfcShapeRepresentation(
    ContextOfItems=context,
    RepresentationIdentifier='Body',
    RepresentationType='SweptSolid',
    Items=[extrusion]
)

wall.Representation = ifcfile.createIfcProductDefinitionShape(Representations=[shape_representation])
wall = ifcfile.createIfcWallStandardCase(create_guid(), owner_history, ifcFileParams.codeName ,  ifcFileParams.name, None, wall_placement, wall.Representation, None)
ifcfile.createIfcRelContainedInSpatialStructure(ifcopenshell.guid.new(), RelatingStructure=building_storey, RelatedElements=[wall])


# TO DO  Define and associate the wall material
#here poarse the info from the elements
material = ifcfile.createIfcMaterial("implenia wall material")
materialThickness= 0.2
material_layer = ifcfile.createIfcMaterialLayer(material, materialThickness, None)
material_layer_set = ifcfile.createIfcMaterialLayerSet([material_layer], None)
material_layer_set_usage = ifcfile.createIfcMaterialLayerSetUsage(material_layer_set, "AXIS2", "POSITIVE", -0.1)
ifcfile.createIfcRelAssociatesMaterial(create_guid(), owner_history, RelatedObjects=[wall], RelatingMaterial=material_layer_set_usage)

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
ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [wall], property_set)

# Add quantity information
# qunatities aRE WRITTEN BUT FOR NOT VISIBLE IN SPECKLE
quantity_values = [
    ifcfile.createIfcQuantityLength("Length", "Length of the wall", None, 1.0),
    ifcfile.createIfcQuantityArea("Area", "Area of the front face", None, 1.0),
    ifcfile.createIfcQuantityVolume("Volume", "Volume of the wall", None, 1.0)
]

part_quantity = ifcfile.createIfcElementQuantity(create_guid(), owner_history, "implenia BaseQuantities", None, None, quantity_values)
print("Testing the export of quantities,....:", part_quantity)
ifcfile.createIfcRelDefinesByProperties(create_guid(), owner_history, None, None, [wall], part_quantity)


# CREATE AND AND ASSOCIATE OPENNING for the window in the wall
opening_placement = create_ifclocalplacement(ifcfile, (0.25, 0.0, 1.0), (0.0, 0.0, 1.0), (0.75, 0.0, 0.0), wall_placement)
opening_extrusion_placement = create_ifcaxis2placement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))
point_list_opening_extrusion_area = [(0.0, -0.1, 0.0), (3.0, -0.1, 0.0), (3.0, 0.1, 0.0), (0.0, 0.1, 0.0), (0.0, -0.1, 0.0)]
opening_solid = create_ifcextrudedareasolid(ifcfile, point_list_opening_extrusion_area, opening_extrusion_placement, (0.0, 0.0, 1.0), 1.0)
opening_representation = ifcfile.createIfcShapeRepresentation(context, "Body", "SweptSolid", [opening_solid])
opening_shape = ifcfile.createIfcProductDefinitionShape(None, None, [opening_representation])
opening_element = ifcfile.createIfcOpeningElement(create_guid(), owner_history, "Opening", "An awesome opening", None, opening_placement, opening_shape, None)
ifcfile.createIfcRelVoidsElement(create_guid(), owner_history, None, None, wall, opening_element)

# Create a simplified representation for the Window
window_placement = create_ifclocalplacement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), opening_placement)
window_extrusion_placement = create_ifcaxis2placement(ifcfile, (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))
point_list_window_extrusion_area = [(0.0, -0.01, 0.0), (3.0, -0.01, 0.0), (3.0, 0.01, 0.0), (0.0, 0.01, 0.0), (0.0, -0.01, 0.0)]
window_solid = create_ifcextrudedareasolid(ifcfile, point_list_window_extrusion_area, window_extrusion_placement, (0.0, 0.0, 1.0), 1.0)
window_representation = ifcfile.createIfcShapeRepresentation(context, "Body", "SweptSolid", [window_solid])
window_shape = ifcfile.createIfcProductDefinitionShape(None, None, [window_representation])
window = ifcfile.createIfcWindow(create_guid(), owner_history, "Window", "An awesome window", None, window_placement, window_shape, None, None)

# Relate the window to the opening element
ifcfile.createIfcRelFillsElement(create_guid(), owner_history, None, None, opening_element, window)

# write the file 
ifcfile.write(file_path)
