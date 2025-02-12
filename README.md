
# Intelligent Building Configurator (iBC) 
A tool for Rapid Design Generation and Optimization in Modern Methods of Construction

![05b_Apartment-level Configure](https://github.com/TopoVague/IBC_dev/assets/8251842/3b3893f9-127d-4e81-b2ad-a4cafe06546d)

## Introduction 

This project develops an intelligent configurator, including a BIM library offering collaborative BIM data accessibility, 
a similarity analysis between traditional projects and standardized products, 
and a generative design to optimize project configurations with modern methods of construction.
In this repository we will store the sourcecode, test and efforts towards the development of the tool 

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

-itertools

-json

-xml.etree.ElementTree


## Instructions for accessing the SQL database setup by Implenia

You can access the SQL database by doing the following steps
1) To Connect to the Implenia Virtual Machine and
2) Open  Azure Data Studio (Suggested software )
3) Connect to Server: sqs-weu-sqlserver001-dev01.database.windows.net
4) Select Database: SDB-IBC-DEV01

 
Admin Users 
exa_epantazis@implenia.com
exa_jcao@implenia.com

adm_sbinkert@implenia.com
adm_jweis@implenia.com

 
## Instructions for the Building Element Catalogue - Rhino/Ghx Viewer

You can locally view and export ithe Catalog of parts using the Graphical User Interface within Rhinoceros 3d
1) You  need to have Rhino 7 or 8 installed on your laptop/machine
2) You need to have the following libraries installed: a) [Human UI](https://www.food4rhino.com/en/app/human-ui), b) [Metahopper](https://www.food4rhino.com/en/app/metahopper) c) [Bullant and RhinoIfc](https://geometrygym.wordpress.com/downloads-windows/) d) [Speckle](https://www.speckle.systems/download) 
3) Open the file .ghx which you can find in the  04_readAndParse_ElementCatalog_v0_1
4) Read the instructions on the top of the script to be able to navigate 
5) In the folder input you can find a sample .xls file that you can use to parse. You will need to point to this file in the script
6) you may need to adjust the file path of the catalog images to view them, but you should see something like the following image
   
![ZHAW_implenia_GUI_local_ve03](https://github.com/user-attachments/assets/31968860-6e0d-43e6-ab2d-536bcdf71998)


## Instructions for the Building Element Catalogue - Web Viewer
(This part will be developing as we progress)

1) Clone the repository to your computer

2) Open the folder on your machine (preferable using an IDE like Visual Studio Code (https://code.visualstudio.com/)

3) Cd to the root folder i.e. C:\Users\YourUserName\Documents\GitHub\IBC 

4) Make sure you have installed the dependecies above, you can do this by using **pip install** or **npm**

5) Run the python script  appTesting.py or app.py by running the following command: **python appTesting.py**

6) Open a browser window and enter the following URL: http://localhost:5000/index.html  (this will create a local server and load the index.html that is located in the templates folder)

7) Navigate to the page of the catalog http://localhost:5000/catalog.html

8) Load the file BuildingElementCatalog_Phase5.csv (or one with the same strcuture) to browse the catalog and you should see sth like the following
9) You can now browse,filter and download the elements that exist in the catalogue
    
![ZHAW_implenia_GUI_web_04_CatalogBrowser](https://github.com/user-attachments/assets/9c245cff-2155-4871-801a-a4648752415c)


## Workflow Overview
The workflow consists of the following steps:

1) Floor Plan Annotation (Web Interface) – Users can upload PDFs, draw polylines to define rooms, classify spaces, and group them into apartments.

2) Export to JSON – Annotated floor plans are exported as structured JSON files.

3) Graph Processing – JSON files are converted into a graph representation using buildGraph.py.

4) Rule-Based Classification – The ruleAssignment.py script assigns classifications to building elements.

5) Final JSON Update – updateJSON.py updates the exported JSON with assigned classifications.

**General guidelines**
-Place any relevant you are using In the node_modules folders 

-Put any html files that you develop in the templates folder (i.e. if you want to create extra pages as we continue to develop the project)

-Put your the scripts that you want to run in to static folder 

-Put files that you load (i.e. 3d models, images etc) in the 02_assets folder (we might need to change this)  

-Keep tests and development files in the 01_CodingTests Folder 




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
