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
    var hiddenColumns = [    'NUMBER CODE', 'LOAD FUNCTION', 'STIFFENING FUNCTION', 'NUMBER CODE', 'LOAD FUNCTION','PREFABRICATION', 'WATER','HEATING', 'VENTILATION', 'ACUSTIC REQS', 'ELECTRICITY', 'FIRE REGULATION', 'FIRE PROTECTION',
        'FINISHING',
        'VERSION',
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
        var filterValues = Array.from(filterInputs).map(input => input.value.trim().toLowerCase()).filter(value => value);
        toGrid(csvData, filterValues);
    });

    closeModal.addEventListener('click', function() {
        detailModal.style.display = 'none';
    });

    window.addEventListener('click', function(event) {
        if (event.target == detailModal) {
            detailModal.style.display = 'none';
        }
    });

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

    function toGrid(rows, filterValues = []) {
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

            filteredRowCount++;

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
        let boxWidth = 1, boxHeight = 1, boxDepth = 1;

        details.forEach(function(detail) {
            var p = document.createElement('p');
            p.textContent = `${detail.header}: ${detail.value}`;
            modalDetails.appendChild(p);

            // Determine box size based on the category
            if (detail.header === 'CATEGORY') {
                switch (detail.value.toLowerCase()) {
                    case 'wall':
                        boxWidth = 1;
                        boxHeight =3;
                        boxDepth = .3;
                        break;
                    case 'slab':
                        boxWidth = 1;
                        boxHeight = .2;
                        boxDepth = 1;
                        break;
                    case 'column':
                        boxWidth = 0.2;
                        boxHeight = 3;
                        boxDepth = 0.2;
                        break;
                    default:
                        boxWidth = 1 ;
                        boxHeight = 1;
                        boxDepth = 1;
                }
            }
        });

        detailModal.style.display = 'block';
        render3DCube(boxWidth, boxHeight, boxDepth);
    }

    function render3DCube(width = 1, height = 1, depth = 1) {
        // Ensure previous renderer is disposed if exists
        if (threeCanvas.renderer) {
            threeCanvas.renderer.dispose();
        }

        var scene = new THREE.Scene();
        // set background
        scene.background = new THREE.Color(0xffffff); 

        var camera = new THREE.PerspectiveCamera(75, threeCanvas.clientWidth / threeCanvas.clientHeight, 0.1, 1000);
        
        var renderer = new THREE.WebGLRenderer({ antialias: true,canvas: threeCanvas });
        renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
        renderer.setClearColor(0xffffff);
        // Store renderer in canvas element for later disposal

        threeCanvas.renderer = renderer; 
        //create geoemry
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
