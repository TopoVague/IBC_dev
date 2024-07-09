(function() {
    var DELIMITER = ',';
    var NEWLINE = '\n';
    var fileInput = document.getElementById('file');
    var gridContainer = document.getElementById('gridContainer');
    var filterInputs = document.querySelectorAll('.filterInput');
    var filterButton = document.getElementById('filterButton');
    var resultsCountDiv = document.getElementById('resultsCount');
    var elementsCountDiv = document.getElementById('elementsCount');
    var detailModal = document.getElementById('detailModal');
    var modalImage = document.getElementById('modalImage');
    var modalDetails = document.getElementById('modalDetails');
    var closeModal = document.querySelector('.close');
    var threeCanvas = document.getElementById('threeCanvas');
    var csvData = [];

    // Add the headers of columns you want to hide here
    var hiddenColumns = [    
        'NameDE',
        'Category', 
        'NumberCode', 
        'Variation', 
        'Width', 
        'Height',
        'LoadBearing', 
        'StiffeningFunction', 
        'Prefabrication', 
        'Placement', 
        'Water', 
        'Heating',
        'Ventilation',
        'Electricity',
        'FireRequirementsDE',
        'FireRating',
        'AcoustingRating',
        'ThermalTransmittance',
        'Finishing',
        'Version',
        'Reasoning',
        'ImageURL']; 

    if (!fileInput || !gridContainer || !filterInputs || !filterButton || !resultsCountDiv || !elementsCountDiv || !detailModal || !modalImage || !modalDetails || !closeModal || !threeCanvas) {
        console.error('One or more required elements are missing.');
        return;
    }

    fileInput.addEventListener('change', function() {
        if (fileInput.files && fileInput.files.length > 0) {
            parseCSV(fileInput.files[0]);
        }
    });

    //function to close the modal window 
    closeModal.addEventListener('click', function() {
        detailModal.style.display = 'none';
    });

    window.addEventListener('click', function(event) {
        if (event.target == detailModal) {
            detailModal.style.display = 'none';
        }
    });


    //function to read and parse the csv
    function parseCSV(file) {
        if (!file || !FileReader) {
            console.error('File or FileReader not available.');
            return;
        }

        var reader = new FileReader();

        reader.onload = function(e) {
            csvData = e.target.result.split(NEWLINE);
            toGrid(csvData);
        };

        reader.readAsText(file);
    }


    // FILTERING FUNCTION
    filterButton.addEventListener('click', function() {

        
        var filterValues = Array.from(filterInputs).map(input => input.value.trim().toLowerCase()).filter(value => value);

        //MAYBE DO THIS MORE ELEGANTLY
        //get filter values 
        var dropdownValue1 = document.getElementById("filterlist1");
        var menufilter1 = dropdownValue1.value.toLowerCase();
        var dropdownValue2 = document.getElementById("filterlist2");
        var menufilter2 = dropdownValue2.value.toLowerCase();
        //get the min and max thickness
        //TO DO add min and max thickness  into the fliterValues variable
        var minThickness = parseFloat(document.getElementById('minThickness').value);
        var maxThickness = parseFloat(document.getElementById('maxThickness').value);
       
        //check if there is an input and pass it 
        if (menufilter1 !== "" ){
            filterValues.push(menufilter1)
        }
        if (menufilter2 !== ""){
            filterValues.push(menufilter2)
        }

        console.log('Current applied filters:', filterValues);
        console.log('Current thickness range:', minThickness, maxThickness);
        console.log(typeof maxThickness);

        // pass it to the object
        toGrid(csvData, filterValues,  minThickness, maxThickness);
       // toGrid(csvData, filterValues, minThickness, maxThickness);
    });
   
    


    // FUNCTION THAT ADDS THE FILTERSED RESULT TO A GRID 
    function toGrid(rows, filterValues = [], minThickness = null, maxThickness = null) {
        if (!rows || rows.length === 0) {
            console.warn('No rows to process.');
            return;
        }
        // Clear grid container
        while (gridContainer.firstChild) {
            gridContainer.removeChild(gridContainer.firstChild);
        }
        var headers = rows[0].trim().split(DELIMITER);
        //initialize a counter for all the elements in the livrary
        var allitems = -1;
        //initialize a counter to count results
        var filteredItems = 0;



        // Filter and add rows
        for (var i = 1; i < rows.length; i++) {
            allitems +=1;
            var r = rows[i].trim();
            if (!r) {
                continue;
            }

            var cols = r.split(DELIMITER);

            if (cols.length === 0) {
                continue;
            }

            var thicknessIndex = headers.indexOf('Thickness'); 
            var thickness = parseFloat(cols[thicknessIndex]);

            if (isNaN(thickness)) {
                console.error('Invalid thickness value in the .csv:', cols[thicknessIndex]);
                continue;
            }
            //SANITY CHECK
            // console.log('Row:', cols, 'this is the thickness:', thickness, , typeof thickness);
            //console.log("this is the thickness:  "+thickness);

            // Check if thickness is within the specified range
            if ((minThickness !== null && thickness < minThickness) || (maxThickness !== null && thickness > maxThickness)) {
                continue;// Skip if outside the range
            }

            // Apply filters (case-insensitive)
            var matchesAllFilters = filterValues.every(filterValue => 
                cols.some(col => col.toLowerCase().includes(filterValue))
            );

            if (!matchesAllFilters) {
                continue;
            }

            //increment the Counter for the filtered results
            filteredItems++;
            //create grid items
            var gridItem = document.createElement('div');
            gridItem.classList.add('gridItem');

            // Add image if available
            var imageUrl = cols[headers.indexOf('ImageURL')]; // Adjust if ImageURL column position changes
            if (imageUrl) {
                var img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Image';
                gridItem.appendChild(img);
            }

            // Add other columns, skipping hidden columns
            var details = [];
            cols.forEach(function(c, index) {
                var header = headers[index] && headers[index].trim();
                if (!header || hiddenColumns.includes(header)) {
                    return;
                }

                var p = document.createElement('p');
                p.textContent = `${header}: ${c.trim()}`;
                gridItem.appendChild(p);
                details.push({ header: header, value: c.trim() });
            });

            // Add hidden columns to the details
            hiddenColumns.forEach(function(hiddenColumn) {
                var index = headers.indexOf(hiddenColumn);
                if (index !== -1 && cols[index]) {
                    details.push({ header: headers[index].trim(), value: cols[index].trim() });
                }
            });

            // Attach click event handler to gridItem
            (function(detailsCopy, imageUrlCopy) {
                gridItem.addEventListener('click', function() {
                    showDetailModal(imageUrlCopy, detailsCopy);
                });
            })(details, imageUrl);

            gridContainer.appendChild(gridItem);
        }

        // Update the results count message
        resultsCountDiv.textContent = `Number of elements matching criteria: ${filteredItems}`;
        elementsCountDiv.textContent = `Number of elements in the library: ${allitems}`;
    }
    //////////////////////////////END OF THE FILTERING


    //the method to show the detail of the OBJECT
    function showDetailModal(imageUrl, details) {
        modalImage.src = imageUrl;
        modalDetails.innerHTML = '';

        //initialize VARIABLES for creating a object geometry and passing it
        //QUESTION : HOW CAN I DO THIS BETTER (I want this info to be passed to the export ifc)
        //SHOULD I DECALRE ALSO THE TYPE of THE VARIABLE HEREE??

        ///Object Basic Info 
        let objectName = '';
        let objectCode = '';
        let objectCategory = '';
        let objectVariation ='';

        //dimensisons
        let objectThickness = '';
        let objectHeight = '';
        let objectWidth = '';

        //placement
        let objectIsExternal = '';

        ///Object properties 
        let objectIsLoadBearing = '';
        let objectIsStiffening = '';
        let objectFabricationMethod = '';
          
        let objectHasWaterPipes = '';
        let objectHasHeating = '';
        let objectHasVentilation = '';
        let objectHasElectricPipes = '';

        let objectIsFireRated = '';
        let objectFireRegulation = '';
        let objectAcousticRating = '';
        let objectThermalRating = '';

        unitCnversionFactor = 0.001 // a number to convert values in the .csv into a different unit
        
        console.log("There are the details of the selected object: ", details)

        details.forEach(function(detail) {
            //create a variable and assign all info of the selected obect
            var p = document.createElement('p');
            p.textContent = `${detail.header}: ${detail.value}`;
            modalDetails.appendChild(p);

            console.log( "the selected object's details are : ", p.textContent);

            // Set object name and category based on the details
            //This is where we pass the values from the csv into parameters
            if (detail.header === 'Name') {objectName = detail.value;}
            if (detail.header === 'NumberCode') {objectCode = detail.value;}
            if (detail.header === 'Variation') {objectVariation = detail.value;}
            if (detail.header === 'Category') {objectCategory = detail.value.toLowerCase(); }
            if (detail.header === 'Width') {objectWidth = detail.value;}
            if (detail.header === 'Height') {objectHeight = detail.value;}
            if (detail.header === 'Thickness') {objectThickness = detail.value;}
            if (detail.header === 'Placement') {
                objectIsExternal = detail.value.toLowerCase(); // Convert to lowercase for consistency
                if (objectIsExternal === 'external'){
                    objectIsExternal = 'TRUE'
                }else{
                    objectIsExternal = 'FALSE'
                }
            }
            if (detail.header === 'LoadBearing') {objectIsLoadBearing = detail.value; }
            if (detail.header === 'StiffeningFunction') { objectIsStiffening = detail.value; }
            if (detail.header === 'Prefabrication') {objectFabricationMethod = detail.value; }
            if (detail.header === 'Water') {  objectHasWaterPipes = detail.value; }
            if (detail.header === 'Heating') {  objectHasHeating = detail.value; }
            if (detail.header === 'Ventilation') { objectHasVentilation = detail.value; }
            if (detail.header === 'Electricity') { objectHasElectricPipes = detail.value; }
            if (detail.header === 'FireRequirementsDE') {  objectFireRegulation = detail.value; }
            if (detail.header === 'FireRating') { objectIsFireRated = detail.value; }
            if (detail.header === 'AcoustingRating') { objectAcousticRating = detail.value; }
            if (detail.header === 'ThermalTransmittance') { objectThermalRating = detail.value; }

       
            // Some prints for sanity check
            //console.log("the code of selected item is:" +objectCode);
            //console.log("the thickness of selected item is:" +objectThickness);
            //console.log("is the object external?:" +objectIsExternal);
            
        });

        ///////////////////////////////////////
        //style the modal window
        detailModal.style.display = 'block';



        //CALL THE EXPORT METHOD
        document.getElementById('exportButton').addEventListener('click', function() {

            //Var can be declared and accessed globally.
            //Let can be declared globally, but its access is limited to the block in which it is declared.  
            // Set object propertis

            //CATEGORY AND NAME
            var name = objectName;
            var codeName = objectCode;
            var category = objectCategory;
            var variation = objectVariation;

            //DIMENSIONS
            var width = objectWidth;
            var height = objectHeight;
            var depth = objectThickness;

            //OBJECT PROPERTIES
            var position = objectIsExternal;
            var isLoadBearing = objectIsLoadBearing;
            var isStiffening = objectIsStiffening;

            //TO DO PASS THOSE IN THE IFC
            var prefabrication = objectFabricationMethod ;
            var fireRating = objectIsFireRated;
            var fireRegulation = objectFireRegulation;
            var acousticRating =  objectAcousticRating ;
            var thermalRating =  objectThermalRating ;
            ///
            var hasElectricPipes =  objectHasElectricPipes;
            var hasWaterPipes =  objectHasWaterPipes ;
            var hasVentilation =  objectHasVentilation;
            var hasHeating =  objectHasHeating;
            
            // Send a request to the server to create the IFC file
            //here is WHERE WE PASS THE PROPERTIES FROM the csv to send it to the python 
            fetch('/export_ifc', {
                method: 'POST',
                mode: "no-cors",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    codeName: codeName,
                    variaton: variation,
                    category: category,
                    width: width,
                    height: height,
                    depth: depth,
                    position: position,
                    isLoadBearing: isLoadBearing,
                    isStiffening: isStiffening,
                    fireRating: fireRating,
                    fireRegulation: fireRegulation,
                    prefabrication: prefabrication,
                    hasWaterPipes: hasWaterPipes,
                    hasHeating:hasHeating,
                    hasVentilation: hasVentilation,
                    hasElectricPipes:hasElectricPipes,
                    acousticRating:acousticRating,
                    thermalRating:thermalRating
                })
            })
            .then(response => response.blob())
            .then(blob => {
                // Create a link to download the IFC file
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                var exportfilename = objectCode;
                a.href = url;
                //a.download = exportfilename +'.ifc';
                a.download = exportfilename +'.ifc';
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch(error => console.error('Error exporting IFC:', error));
        });
        ///END OF EXPORT METHOD

        ///
        var geometryToShow= createBoundingBox(objectCategory,objectWidth, objectHeight, objectThickness);

        ///RENDER THE GEOMETRY
        renderObject(geometryToShow);
    }



    //TO DO make the renderObject function just to take one argument- i.e. geometry 
    //TO DO a function that takes as argument category and name  and creates a geometry TO that the renderObject is calling
    //TO DO two functions showing/rendering the object one for simple view and detailed view. 
    //simple view is a bounding box of the geometry, you create it by 
    //detailed view shows a detailed view aby loading the
    //TO DO If category is other than, wall, slab column beam, then pass an argument to load geometry


    function createBoundingBox(objectCategory,objectWidth, objectHeight, objectThickness){
        //ARGUMENTS, dimensions ,mode        
        ///return the object

        var width = objectWidth;
        var height = objectHeight;
        var depth = objectThickness;
        console.log("the object's category is: "+objectCategory)
        console.log ("the dimensions of the geometry to draw are: "+ width +', '+ height +', '+ depth);
        

        switch (objectCategory) {
            case 'wall':
                width = objectWidth*unitCnversionFactor;
                height = objectHeight*unitCnversionFactor;
                depth = objectThickness*unitCnversionFactor;// This should be value coming from the CSV- thickness column
                console.log("Got in the wall category and the dimensions of selected item is:" +width+','+height +','+depth);
                break;
            case 'slab':
                width = objectWidth*unitCnversionFactor;
                height = objectThickness*unitCnversionFactor; // This  value coms from the CSV- thickness column(multiplication is to make mm to m)
                depth = objectHeight*unitCnversionFactor;
                console.log("Got in the slab and the dimensions of selected item is:" +width+','+height +','+depth);
                break;
            case 'column':
                width = objectThickness*unitCnversionFactor;// This should be value coming from the CSV   
                height = objectHeight*unitCnversionFactor;                      
                depth = objectWidth*unitCnversionFactor;   
                break;
            case 'beam':
                width = objectWidth*unitCnversionFactor;   
                height =  objectThickness*unitCnversionFactor// This should be value coming from the CSV
                depth = objectHeight*unitCnversionFactor; 
                break;
            default:
                width = objectWidth*unitCnversionFactor;
                height = objectHeight*unitCnversionFactor;
                depth = objectThickness*unitCnversionFactor;
        }

         //create box geometry
         var elementBBox = new THREE.BoxGeometry(width, height, depth);
         var material = new THREE.MeshBasicMaterial({ color: 0x696969 });
 
         // create a mesh 
         let elementGeometry = new THREE.Mesh(elementBBox, material);
 
         // Add mesh edges
         var edges = new THREE.EdgesGeometry(elementBBox);
         var lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 }); // Black edges
         var lineSegments = new THREE.LineSegments(edges, lineMaterial);
         elementGeometry.add(lineSegments);
         console.log(elementGeometry);
         return elementGeometry; 

    }
    
    // CREATE A DETAILED VIEW OF THE ELEMENT
    function showBuildingElement(){
        //take category and objectCode as arguments
        //load file from the assets folder
        //or parse the parts csv and show the detailed view ()
        //return a geometry that you use for render
    }



    // RENDER THE  OBJECT using the three.js 
    //TODO update functio to take just ONE argumewnt the geometry-DONE
    //PUT HIS IN A SEPRATE FILE AND CALL IT
    function renderObject(elementGeometry) {
        // Ensure previous renderer is disposed if exists
        var rotationStep = 0.006;
        if (threeCanvas.renderer) {
            threeCanvas.renderer.dispose();
        }
        //create a scene
        var scene = new THREE.Scene();

        // set background for 3d 
        scene.background = new THREE.Color(0xffffff); 

        //CREATE AND POSITION THE CAMERA
        var camera = new THREE.PerspectiveCamera(75, threeCanvas.clientWidth / threeCanvas.clientHeight, 0.1, 1000);
        camera.position.z = 5;

        var renderer = new THREE.WebGLRenderer({ antialias: true,canvas: threeCanvas });
        renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
        renderer.setClearColor(0xffffff);

        // Store renderer in canvas element for later disposal
        threeCanvas.renderer = renderer; 

        //add the geometry to the scene
        scene.add(elementGeometry);

        //Animate geometry
        var animate = function() {
            requestAnimationFrame(animate);

            elementGeometry.rotation.y += rotationStep;

            renderer.render(scene, camera);
        };
        animate();
    }

    console.log('You are running Three.js version:', THREE.REVISION);
})();
