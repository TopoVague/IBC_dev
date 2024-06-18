
# Intelligent Builindg Configurator (iBC) 
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


## Instructions
(This part will be developing as we progress)

-Clone the repository to your computer
-Open the folder on your machine (preferable using an IDE like Visual Studio Code (https://code.visualstudio.com/)
-Cd to the root folder i.e. C:\Users\YourUserName\Documents\GitHub\IBC 
-Make sure you have installed the dependecies above, you can do this by using pip install and/or npm
-Run the python script  appTesting.py or app.py by running the command python appTesting.py
-Open a browser window and enter the following http://localhost:5000/  (this will create a local server and load the index.html that is located in the templates folder
-Load a .csv file to browse the catalog and you should see sth like the following

![Screenshot 2024-06-18 111506](https://github.com/TopoVague/IBC_dev/assets/8251842/f72e2d94-42ff-4620-8393-ace0c286f960)

General guidelines
In the node_modules folders all the libraries etc are stored
Put any html files that you develop in the templates folder (i.e. if you want to create extra pages as we continue to develop the project)
Put your the scripts that you want to run in to static folder 
Put files that you load (i.e. 3d models, images etc) in the 02_assets folder (we might need to change this)  
Keep tests and development files in the 01_CodingTests Folder 




## Team
- Evangelos Pantazis / ZHAW - Researcher
- Jianpeng Cao / TU Delft - Post Doc Researcher 
- Konrad Graser / ZHAW - Research/Program Manager
- Furio Sondrini / Implenia - Digital Design and Innovation Manager 
- Giulia Curletto / Implenia - Digital Design and Innovation Manager 

## Research Partners  
ZHAW - Zürcher Hochschule für Angewandte Wissenschaften

## Implementation Partners
Implenia AG

## Funding Partners  
Innosuisse - Swiss Innovation Agency- 108.408 IP-SBM
