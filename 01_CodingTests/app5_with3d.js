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
    var csvData = [];
    // Add the headers of columns you want to hide here
    //TODO maybe here add two variables to have some columns hidden and some only shown in the detail
    var hiddenColumns = [
    'LOAD FUNCTION', 
    'STIFFENING FUNCTION',
    'NUMBER CODE',
    'LOAD FUNCTION',
    'PREFABRICATION',
    'WATER','HEATING',
    'VENTILATION',
    'ACUSTIC REQS',
    'ELECTRICITY',
    'FIRE REGULATION',
    'FIRE PROTECTION',
    'FINISHING',
    'VERSION',
    'ImageURL']; 

        if (!fileInput || !gridContainer || !filterInputs || !filterButton || !resultsCountDiv || !detailModal || !modalImage || !modalDetails || !closeModal || !threeCanvas) {
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
                    details.push({header: header, value: c.trim()});
                });
    
                // Add hidden columns to the details
                hiddenColumns.forEach(function(hiddenColumn) {
                    var index = headers.indexOf(hiddenColumn);
                    if (index !== -1 && cols[index]) {
                        details.push({header: headers[index].trim(), value: cols[index].trim()});
                    }
                });
    
                gridItem.addEventListener('click', function() {
                    showDetailModal(imageUrl, details);
                });
    
                gridContainer.appendChild(gridItem);
            }
    
            // Update the results count message
            resultsCountDiv.textContent = `Number of filtered results: ${filteredRowCount}`;
        }
    
        function showDetailModal(imageUrl, details) {
            modalImage.src = imageUrl;
            modalDetails.innerHTML = '';
            details.forEach(function(detail) {
                var p = document.createElement('p');
                p.textContent = `${detail.header}: ${detail.value}`;
                modalDetails.appendChild(p);
            });
            detailModal.style.display = 'block';
            render3DObject();
        }
    
        function render3Object() {
            var scene = new THREE.Scene();
            var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            var geometry = new THREE.BoxGeometry(2, 2, 2);
            var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

            var renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canva });
            var canva =  document.getElementById("canvas");
    
            
           startScene();
           animate();
           
           function startScene() {
            let light = new THREE.AmbientLight(0xffaaff);
            
            scene.add(mesh);
            light.position.set(10, 10, 10);
            scene.add(light);
            camera.position.set(0, 0, 5);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            renderer.setClearColor(0xEEEEEE);
            renderer.setSize(window.innerWidth, window.innerHeight);
        
            window.addEventListener('resize', onWindowResize);
        }
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function startScene() {
            let light = new THREE.AmbientLight(0xffaaff);
            
            scene.add(mesh);
            light.position.set(10, 10, 10);
            scene.add(light);
            camera.position.set(0, 0, 5);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            renderer.setClearColor(0xEEEEEE);
            renderer.setSize(window.innerWidth, window.innerHeight);
        
            window.addEventListener('resize', onWindowResize);
        }
    

        }
    })();
    