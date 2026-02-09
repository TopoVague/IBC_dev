
# Intelligent Building Configurator (iBC) 
A tool for Rapid Design Generation and Optimization in Modern Methods of Construction

![05b_Apartment-level Configure](https://github.com/TopoVague/IBC_dev/assets/8251842/3b3893f9-127d-4e81-b2ad-a4cafe06546d)

## Introduction 

This project develops an intelligent configurator, including a BIM library offering collaborative BIM data accessibility, 
a similarity analysis between traditional projects and standardized products, 
and a generative design to optimize project configurations with modern methods of construction.
In this repository we will store the sourcecode, test and efforts towards the development of the tool. Make sure to install all the necessary libraries and dependencies which are listed at the bottom BEFORE you attept to run any scripts

 
## A. Instructions for the Building Element Catalogue - 
### A.1 Rhino/Ghx Viewer

You can locally view and export ithe Catalog of parts using the Graphical User Interface within Rhinoceros 3d
1) You  need to have Rhino 7 or 8 installed on your laptop/machine
2) You need to have the following libraries installed: a) [Human UI](https://www.food4rhino.com/en/app/human-ui), b) [Metahopper](https://www.food4rhino.com/en/app/metahopper) c) [Bullant and RhinoIfc](https://geometrygym.wordpress.com/downloads-windows/) d) [Speckle](https://www.speckle.systems/download) 
3) Open the file .ghx which you can find in the  03_readAndParse_ElementCatalog_v0_1
4) Read the instructions on the top of the script to be able to navigate 
5) In the folder input you can find a sample .xls file that you can use to parse. You will need to point to this file in the script
6) you may need to adjust the file path of the catalog images to view them, but you should see something like the following image
   
![ZHAW_implenia_GUI_local_ve03](https://github.com/user-attachments/assets/31968860-6e0d-43e6-ab2d-536bcdf71998)


### A.2 Web Viewer
(This part will be developing as we progress)

1) Clone the repository to your computer

2) Open the folder on your machine (preferable using an IDE like Visual Studio Code (https://code.visualstudio.com/)

3) Cd to the root folder i.e. C:\Users\YourUserName\Documents\GitHub\IBC 

4) Make sure you have installed the dependecies above, you can do this by using **pip install** or **npm** . Alternatively , if you are using anaconda,  you can create envrironment with all the required libraries by following these steps: a) find in the rootfolder the file IBC_dev/IBCenvironment.yml  b) open the anaconda command prompt and cd to the root folder  c) type: **conda env create -f IBCenvironment.yml** (The first line of the yml file sets the new environment's name) d) **conda activate IBCtestenv** e)  Verify that the new environment was installed correctly by typing:  conda env list

6) Run the python script  appTesting.py or app.py by running the following command: **python appTesting.py**

7) Open a browser window and enter the following URL: http://localhost:5000/index.html  (this will create a local server and load the index.html that is located in the templates folder)

8) Navigate to the page of the catalog http://localhost:5000/catalog.html

9) Load the file BuildingElementCatalog_Phase5.csv (or one with the same strcuture) to browse the catalog and you should see sth like the following
10) You can now browse,filter and download the elements that exist in the catalogue
    
![ZHAW_implenia_GUI_web_04_CatalogBrowser](https://github.com/user-attachments/assets/9c245cff-2155-4871-801a-a4648752415c)

**General guidelines**
-Place any relevant you are using In the node_modules folders 

-Put any html files that you develop in the templates folder (i.e. if you want to create extra pages as we continue to develop the project)

-Put your the scripts that you want to run in to static folder 

-Put files that you load (i.e. 3d models, images etc) in the 02_assets folder (we might need to change this)  

-Keep tests and development files in the 01_CodingTests Folder 


## A.3 Instructions for accessing the SQL database setup by Implenia

You can access the SQL database by doing the following steps
1) To Connect to the Implenia Virtual Machine and
2) Open  Azure Data Studio (Suggested software )
3) Connect to Server: sqs-weu-sqlserver001-dev01.database.windows.net
4) Select Database: SDB-IBC-DEV01

 
Admin Users 
exa_epantazis@implenia.com
exa_jcao@implenia.com



## C.Floorplan Processing

All the files for can be found under 05_Floorplan_processing. We have developed two methods for processing the floorplans:
C.1 A web based that allows a user to load a pdf of floorplan scale it accordingly, trace the spaces and export it as a json 
C.2 A Rhino/Ghx based which allows the user to load a dxf with a floorplan and format it in an msd format 


### C.1 Workflow Overview of Floor Plan Processing Tool-WEB

The workflow consists of the following steps:

1) Floor Plan Annotation (Web Interface) – Users can upload PDFs, draw polylines to define rooms, classify spaces, and group them into apartments.

2) Export to JSON – Annotated floor plans are exported as structured JSON files.



## Detailed Instruction
Before running the files, install the dependency by running 

**pip install numpy networkx matplotlib shapely** 

then cd to the directory where you have the files currently GitHub/IBC/05_Flooplan_processing/version_5_0

then type 

**python -m http.server 8000**, 

open the http://127.0.0.1:8000/index.html in your browser. You will see the Floor Plan Processing Tool!

### How to process your floor plan, you should follow these steps:

1. Upload a PDF file by click "Choose File" button and select your file; (You should choose a file that you know at least one real dimension)
2. Enter the "floor height" (unit: meter)
3. Scale and move the uploaded PDF file on the canvas and click button "Start Drawing" (be careful! one drawingn mode is activated, the PDF should be fixed)
4. Choose the room type in the list (by default the room type is "living room")
5. Start drawing the polyline following the boundary of the room (by enter the "shift" you are able to draw vertical and horizontal line)
    
   5.1 After drawing first line segment, you will be asked to enter the real distance of the segment, so as to calculate the ratio
   
   5.2 If you draw the polyline by mistake, complete the polyline by randomly enclose it, a pop-up window will let you cancel the drawing
   
   5.3 If you want to clear the polyline after created it (confirm in the 5.2 step), click "Clear Polylines" button, it will clear the last polyline you created.)
   
   5.4 If you want to clear everything, for example, do it from scratch, click "Clear PDF", and reupload a PDF.
   
   5.5 One the right side panel, you will see the information about the room
   
   5.6 Change the room type, you can create another polyline for a different room
   
6. After all room is annotated with polyline, click "Define Apartment" to define apartment one by one.
7. Select rooms you want to group as an apartment by clicking the "room tag" of each room, the color of selected room tag will change to orange.
8. Click "Confirm Grouping", the apartment profile will automatically appear in the right side panel. Please check the profile to make sure the apartment is defined correctly
9. Click "Export JSON", the initial bill of material file could be downloaded as "<File_Name>+bom.json".

The Exported file can be loaded and visualized in Rhino/ghx


### C.2 Workflow Overview of Floor Plan Processing Tool-Rhino/Ghx 

This step allows the user to load a floorplan and format it into a .csv file following the Modified Swiss Dwelling format. The reason to follow this format is to be able to compare candidate Designs with a lot floorplans so that you can run similarity analysis


1. You can navigate to the following folder: 05_Floorplan_processing\02_readFloorplanAndFormatIntoMSD_csv_GH
2. you can open the script readFlooplan_andFormat_ToMSD_csv.gh
3. You can load a .dxf or .3dm file of a flooplan drawn with a detail of 1:50 - 1:200 scale meaning that the floorplan needs to have . You can find template files here: 
05_Floorplan_processing\02_readFloorplanAndFormatIntoMSD_csv_GH\implenia_CaseStudies_floorplans
4. To ensure no errors the file should be strcutured as follows 
	a) room outlines should be closed polylines and in a layer called: "areas"
	b) wall outlines should be closed polylines and in a layer called: "walls"
	c) window outlines should be closed polylines and in a layer called: "windows"
	d) door outlines should be closed polylines and in a layer called: "doors"
	e) room tags should be a text and in a layer called: "textTags"

5. The script identifies the spaces, walls, doors and predicts the entrance doors and creates a .csv file with the geometry characterized based on the MSD data structure
6. The .csv file can be loaded onto the Jupyter notebook (Section D)to run a similarity analysis
 

### D. Workflow to perform similarity Analysis
This workflow allows the user to load a candidate floorplan and assess if it is a good fit for being constructed using the kit of parts. You can use the notebooks (.ipynb) in the following folder to run this similarity analysis: IBC_dev\06_MSD_Floorplan_SimilarityAnalysis

File 01: MSD_to_IBC_Analysis.ipynb 
allows one to:
1. understand the structure and content of Modified Swiss Dwellings dataset 
2. access different elements
3. Ananlyse the floorplans and buildings within the dataset and create some graphs 

File 02: MSD_to_Apartment_Layouts_EP.ipynb allows one 
1. to load the data, add a floorplan, 
2. get different elements of the floorplan
3. Run a similarity analysis
4. Create a graph from the floorplan

you can also access the files online by going to
file01: https://colab.research.google.com/drive/1eWkULnThK1OuBiPrxwL76eywloHiC3t9
file02: https://colab.research.google.com/drive/1vbqq6exLeOkzwvlGbymi_6qU3cqmQNt0

	
### E. Workflow for assigning specific element types to walls following a set of rules 
In this workflow from a floorplan which is formated as JSON we create a graph and visualize it and also assign different elements to different parts of the plan (i.e. specific type of walls based on their position)

1) Graph Processing – JSON files are converted into a graph representation using buildGraph.py.

2) Rule-Based Classification – The ruleAssignment.py script assigns classifications to building elements.

3) Final JSON Update – updateJSON.py updates the exported JSON with assigned classifications.

### How to infer the panel type information 
(by default, the wall type in the exported JSON file is ""WAL_21_CNI_REN""), in order to update you should follow these steps:

1. Select a JSON file *i.e. sampleFloorplan_bom.json that you have exported in the previous steps and place it in the same folder of other three python files 
   
2. Create the graph from the floopllan. In the terminal, run **python buildGraph.py <File_Name>**, output file <File_Name>+bom.graphml i.e. python buildGraph.py sample_floorplan, output file sample_floorplan+bom.graphml 
   
3. Assign specific elements to walls based on their location. In order to do that: run **python ruleAssignment.py <File_Name>**, output file <File_Name>+bom_updated.graphml

	
	3.1 Here we explain the rules implemented so far:

		3.1.1 Focus entire floorplan

   			a. Find all exterior walls: --> Assign WAL_01_CNI_REN 

		3.1.2 Focus functional units

   			a. Find all the walls along the core: --> Assign WAL_20_STD_REN 

   			b. Find all the apartment partition walls: --> Assign WAL_22_STD_REN 

		3.1.3 Focus within each apartment

   			a. Find all the bathroom walls: --> Assign the WAL_45_STD_TIL  on the inner perimeter

   			b. Find all walls between bathroom and kitchen or bedroom : Assign WAL_40_STD_REN toward kitchen or bedroom

   			c. Find all walls between bathroom and corridor or living room: Assign WAL_43_STD_REN toward kitchen or bedroom

   			d. Assign WAL_40_STD_REN to all the other walls

		3.1.4 Focus on the shaft (longer side of bathroom + adjacent wet room)
   
4. Update the json file with the elements assigned: run **python updateJSON.py <File_Name>**, output file <File_Name>+bom_udpated.json


### F. How to identify the frequent patterns of space so that you can identify potential modules

1. Navigate to the folder and download it "07_DetectPossible3dModules/"
2. Installed dependencies via pip if have not done so already by typing the following command "python -m pip install "uvicorn[standard]" fastapi neo4j pandas gspan-mining matplotlib flask
4. In the terminal, type "uvicorn app.main:app --reload"
5. Open the local interface at: http://127.0.0.1:8000
6. Upload the MSD dataset in csv format - link to file:https://drive.google.com/file/d/1D67DLh8-EFHx-juhb2mAnI9XtV1O-_7l/view?usp=drive_link
7. Change the variables, including "Rooms", "Max Width", "Compactness" and "Min Support"
8. Click the button "Mine & Filter"
9. Click the button "Group Patterns"
10. Enter the room combination, then click "Search" to query the specific patterns


## Libraries

The project relies mainly on open source libraries and platforms whch include
- https://threejs.org/
- https://ifcopenshell.org/
- https://github.com/TopoVague/Topologic
- https://github.com/mcneel/opennurbs

## Dependencies
-flask

-node.js

-three.js

-Python

-ifcOpenShell

-TopologicPy

-networkx

-matplotlib

-shapely

-neo4j

-gspan

## Team
- Evangelos Pantazis / ZHAW - Senior Researcher
- Jianpeng Cao / TU Delft - Post Doc Researcher 
- Konrad Graser / ZHAW - Research/Program Manager
- Furio Sondrini / Implenia - Digital Design and Innovation Manager 
- Giulia Curletto / Implenia - Digital Design and Innovation Manager 

## Research Partners  
[ZHAW](https://www.zhaw.ch/de/archbau/institute/ibp/) - Zurich School of Applied Sciences / Zürcher Hochschule für Angewandte Wissenschaften 

## Implementation Partners
[Implenia AG](https://implenia.com/)

## Funding Partners  
[Innosuisse](https://www.innosuisse.admin.ch/en) - Swiss Innovation Agency
Research Grant : 108.408 IP-SBM 
