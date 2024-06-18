(function() {
    var DELIMITER = ',';
    var NEWLINE = '\n';
    var fileInput = document.getElementById('file');
    var gridContainer = document.getElementById('gridContainer');
    var filterInputs = document.querySelectorAll('.filterInput');
    var filterButton = document.getElementById('filterButton');
    var resultsCountDiv = document.getElementById('resultsCount');
    var detailModal = document.getElementById('detailModal');
    var modalImage = document.getElementById('modalImage');
    var modalDetails = document.getElementById('modalDetails');
    var closeModal = document.querySelector('.close');
    var threeCanvas = document.getElementById('threeCanvas');
    var csvData = [];
    // Add the headers of columns you want to hide here
    var hiddenColumns = [    
        'NUMBER CODE', 
        'LOAD FUNCTION', 
        'STIFFENING FUNCTION', 
        'NUMBER CODE', 
        'LOAD FUNCTION',
        'PREFABRICATION', 
        'WATER',
        'HEATING', 
        'VENTILATION',
        'ACUSTIC REQS',
        'ELECTRICITY', 
        'FIRE REGULATION',
        'FIRE PROTECTION',
        'FINISHING',
        'VERSION',
        'U-WERT',
        'ImageURL']; 


    if (!fileInput || !gridContainer || !filterInputs || !filterButton || !resultsCountDiv || !detailModal || !modalImage || !modalDetails || !closeModal || !threeCanvas) {
        console.error('One or more required elements are missing.');
        return;
    }

    fileInput.addEventListener('change', function() {
        if (fileInput.files && fileInput.files.length > 0) {
            parseCSV(fileInput.files[0]);
        }
    });

    filterButton.addEventListener('click', function() {
        //var filterValues = Array.from(filterInputs).map(input => input.value.trim().toLowerCase()).filter(value => value);
        //toGrid(csvData, filterValues);
        var filterValues = Array.from(filterInputs).map(input => input.value.trim().toLowerCase()).filter(value => value);
        var minThickness = parseFloat(document.getElementById('minThickness').value);
        var maxThickness = parseFloat(document.getElementById('maxThickness').value);
        console.log('Min Thickness:', minThickness, 'Max Thickness:', maxThickness);
        
        toGrid(csvData, filterValues, isNaN(minThickness) ? null : minThickness, isNaN(maxThickness) ? null : maxThickness);
       // toGrid(csvData, filterValues, minThickness, maxThickness);
    });

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

        var filteredRowCount = 0;
        var filteredThicknessCount = 0;
        // Filter and add rows
        for (var i = 1; i < rows.length; i++) {
            var r = rows[i].trim();
            if (!r) {
                continue;
            }

            var cols = r.split(DELIMITER);

            if (cols.length === 0) {
                continue;
            }

            // Apply filters (case-insensitive)
            var matchesAllFilters = filterValues.every(filterValue => 
                cols.some(col => col.toLowerCase().includes(filterValue))
            );

            if (!matchesAllFilters) {
                continue;
            }

            var thicknessIndex = headers.indexOf('THICKNESS (mm)'); // 
            if (thicknessIndex === -1) {
                console.error('THICKNESS (mm) column not found.');
                continue;
            }


            var thickness = parseFloat(cols[thicknessIndex]);

            if (isNaN(thickness)) {
                console.error('Invalid thickness value:', cols[thicknessIndex]);
                continue;
            }

            console.log('Row:', cols, 'Thickness:', thickness);
            console.log('Min Thickness:', minThickness, 'Max Thickness:', maxThickness);
            filteredThicknessCount++;
            if ((thickness <= maxThickness)) {
                
                console.log("Got in here:  "+ filteredThicknessCount);
        
             }

            if (minThickness !== null && thickness < minThickness) {
                console.log('Filtered out: thickness < minThickness');
                continue;
            }
            if (maxThickness !== null && thickness > maxThickness) {
                console.log('Filtered out: thickness > maxThickness');
                continue;
            }



            filteredRowCount++;

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
        resultsCountDiv.textContent = `Number of filtered results: ${filteredRowCount}`;
    }

    function showDetailModal(imageUrl, details) {
        modalImage.src = imageUrl;
        modalDetails.innerHTML = '';
        let partWidth = 1, partHeight = 1, partDepth = 1;
        objectCode = '';
        objectThickness = '';
        objectIsExternal = '';

        details.forEach(function(detail) {
            var p = document.createElement('p');
            p.textContent = `${detail.header}: ${detail.value}`;
            modalDetails.appendChild(p);
            
            //TO DO If category is other than, wall, slab column beam, then pass an argument to load geometry
            // Set object name and category based on the details
            if (detail.header === 'NUMBER CODE') {
                objectCode = detail.value;
            } else if (detail.header === 'CATEGORY') {
                objectCategory = detail.value.toLowerCase(); // Convert to lowercase for consistency
                
            }  else if (detail.header === 'THICKNESS (mm)') {
                objectThickness = detail.value; 
    
            } else if (detail.header === 'EXTERNAL') {
                objectIsExternal = detail.value; // Convert to lowercase for consistency
    
            }

            //console.log("the code of selected item is:" +objectCode);
            //console.log("the thickness of selected item is:" +objectThickness);
            //console.log("is the object external?:" +objectIsExternal);
            // Determine the dimensions of the Geometry based on the category
            switch (objectCategory) {
                case 'wall':
                    partWidth = 1;
                    partHeight = 3;
                    partDepth = objectThickness*0.001;// This should be value coming from the CSV- thickness column
                    //console.log("Got in the wall category and the dimensions of selected item is:" +partWidth+','+partHeight +','+partDepth);
                    break;
                case 'slab':
                    partWidth = 1;  //default value 
                    partHeight = objectThickness*0.001; // This  value coms from the CSV- thickness column(multiplication is to make mm to m)
                    partDepth = 1; //deafaul value 
                    console.log("Got in the slab and the dimensions of selected item is:" +partWidth+','+partHeight +','+partDepth);
                    break;
                case 'column':
                    partWidth = objectThickness*0.001;// This should be value coming from the CSV   
                    partHeight = 3; // This should be value of 1 depending on the floor to floor height                        
                    partDepth = 0.2;// This should be value coming from the CSV    
                    break;
                case 'beam':
                    partWidth = 3; //deafaul value 
                    partHeight =  objectThickness*0.001// This should be value coming from the CSV
                    partDepth = 0.2;// This should be value coming from the CSV
                    break;
                default:
                    partWidth = 1 ;
                    partHeight = 1;
                    partDepth = 1;
            }
            
        });

        //style the modal window
        detailModal.style.display = 'block';


        document.getElementById('exportButton').addEventListener('click', function() {
            // Get the current dimensions of the 3D object
            var width = partWidth;
            var height = partHeight;
            var depth = partDepth;
        
            // Send a request to the server to create the IFC file
            fetch('/export_ifc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    width: width,
                    height: height,
                    depth: depth
                })
            })
            .then(response => response.blob())
            .then(blob => {
                // Create a link to download the IFC file
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'TestExport.ifc';
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch(error => console.error('Error exporting IFC:', error));
        });
        renderObject(partWidth, partHeight, partDepth);
    }


  

    function renderObject(width, height, depth) {
        // Ensure previous renderer is disposed if exists
        if (threeCanvas.renderer) {
            threeCanvas.renderer.dispose();
        }
        //create a scene
        var scene = new THREE.Scene();

        // set background for 3d 
        scene.background = new THREE.Color(0xffffff); 

        var camera = new THREE.PerspectiveCamera(75, threeCanvas.clientWidth / threeCanvas.clientHeight, 0.1, 1000);
        
        var renderer = new THREE.WebGLRenderer({ antialias: true,canvas: threeCanvas });
        renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
        renderer.setClearColor(0xffffff);

        // Store renderer in canvas element for later disposal
        threeCanvas.renderer = renderer; 

        //create geoemry
        console.log ("the dimensions of the geometry to draw are: "+ width +', '+ height +', '+ depth);
        var geometry = new THREE.BoxGeometry(width, height, depth);
        var material = new THREE.MeshBasicMaterial({ color: 0x696969 });
        var cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        // Add edges
        var edges = new THREE.EdgesGeometry(geometry);
        var lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 }); // Black edges
        var lineSegments = new THREE.LineSegments(edges, lineMaterial);
        cube.add(lineSegments);

        camera.position.z = 5;

        var animate = function() {
            requestAnimationFrame(animate);

            cube.rotation.y += 0.006;

            renderer.render(scene, camera);
        };

        animate();
    }

  

    console.log('Three.js version:', THREE.REVISION);
})();
