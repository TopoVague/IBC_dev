import ifcopenshell
import ifcopenshell.api

def create_ifc_file(width, height, depth, file_path):
    # Create a new IFC file
    model = ifcopenshell.api.run("project.create_entity", ifcopenshell.open(), ifc_class="IfcProject")
    
    # Create a simple rectangular 3D shape
    # Note: This example is simplified. You would need to create actual geometry here.
    shape = ifcopenshell.api.run("geometry.create_box", model, width=width, height=height, depth=depth)
    
    # define the schema
    model = ifcopenshell.file(schema='IFC4')
    
    #create a Wall
    new_wall = model.createIfcWall() # Will return #1=IfcWall($,$,$,$,$,$,$,$,$) - notice all of the attributes are blank!
    model.create_entity('IfcWall', GlobalId=ifcopenshell.guid.new(), Name='Wall Name') # Gives us #1=IfcWall('0EI0MSHbX9gg8Fxwar7lL8',$,'Wall Name',$,$,$,$,$,$)

    # Save the model to a file
    model.write(file_path)


if __name__ == "__main__":
    import sys
    width = float(sys.argv[1])
    height = float(sys.argv[2])
    depth = float(sys.argv[3])
    file_path = sys.argv[4]
    create_ifc_file(width, height, depth, file_path)