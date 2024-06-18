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
        'ImageURL'
    ];

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
        var minThickness = parseFloat(document.getElementById('minThickness').value);
        var maxThickness = parseFloat(document.getElementById('maxThickness').value);
        console.log('Min Thickness:', minThickness, 'Max Thickness:', maxThickness);
        toGrid(csvData, filterValues, isNaN(minThickness) ? null : minThickness, isNaN(maxThickness) ? null : maxThickness);
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
            console.log('CSV Data:', csvData); // Log entire CSV data for verification
            toGrid(csvData);
        };

        reader.readAsText(file);
    }

    function toGrid(rows, filterValues = [], minThickness = null, maxThickness = null) {
        if (!rows || rows.length === 0) {
            console.warn('No rows to process.');
            return;
        }

        while (gridContainer.firstChild) {
            gridContainer.removeChild(gridContainer.firstChild);
        }

        var headers = rows[0].trim().split(DELIMITER);
        //console.log('Headers:', headers); // Log headers for verification

        var filteredRowCount = 0;
        var filteredThicknessRowCount = 0;

        for (var i = 1; i < rows.length; i++) {
            var r = rows[i].trim();
            if (!r) {
                continue;
            }

            var cols = r.split(DELIMITER);

            if (cols.length === 0) {
                continue;
            }

            var matchesAllFilters = filterValues.every(filterValue => 
                cols.some(col => col.toLowerCase().includes(filterValue))
            );

            if (!matchesAllFilters) {
                continue;
            }

            var thicknessIndex = headers.indexOf('THICKNESS (mm)'); // Adjust the column name as per your CSV
            if (thicknessIndex === -1) {
                console.error('THICKNESS column not found in CSV.');
                continue;
            }

            var thickness = parseFloat(cols[thicknessIndex]);
            console.log(`Parsed thickness for row ${i}:`, thickness); // Log parsed thickness for each row


            if (isNaN(thickness)) {
                console.error('Invalid thickness value:', cols[thicknessIndex]);
                continue;
            }

            if ((minThickness !== null && thickness < minThickness) || (maxThickness !== null && thickness > maxThickness)) {
                console.log(`Row ${i} excluded due to thickness filter:`, thickness);
                continue;
            }

            if (thickness> minThickness  && thickness < maxThickness) {
                filteredThicknessRowCount +=1;
                console.log(`GOT in HERE- number of elemetns within range:`, filteredThicknessRowCount);
            }

            filteredRowCount++;

            
            var gridItem = document.createElement('div');
            gridItem.classList.add('gridItem');

            var imageUrl = cols[headers.indexOf('ImageURL')];
            if (imageUrl) {
                var img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Image';
                gridItem.appendChild(img);
            }

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

            hiddenColumns.forEach(function(hiddenColumn) {
                var index = headers.indexOf(hiddenColumn);
                if (index !== -1 && cols[index]) {
                    details.push({ header: headers[index].trim(), value: cols[index].trim() });
                }
            });

            (function(detailsCopy, imageUrlCopy) {
                gridItem.addEventListener('click', function() {
                    showDetailModal(imageUrlCopy, detailsCopy);
                });
            })(details, imageUrl);

            gridContainer.appendChild(gridItem);
        }

        resultsCountDiv.textContent = `Number of filtered results: ${filteredRowCount}`;
    }

    function showDetailModal(imageUrl, details) {
        modalImage.src = imageUrl;
        modalDetails.innerHTML = '';
        let partWidth = 1, partHeight = 1, partDepth = 1;
        let objectName = '';
        let objectCategory = '';

        details.forEach(function(detail) {
            var p = document.createElement('p');
            p.textContent = `${detail.header}: ${detail.value}`;
            modalDetails.appendChild(p);

            if (detail.header === 'NAME') {
                objectName = detail.value;
            } else if (detail.header === 'CATEGORY') {
                objectCategory = detail.value.toLowerCase();
            }

            switch (objectCategory) {
                case 'wall':
                    partWidth = 1;
                    partHeight = 3;
                    partDepth = 0.3;
                    break;
                case 'slab':
                    partWidth = 1;
                    partHeight = 0.2;
                    partDepth = 1;
                    break;
                case 'column':
                    partWidth = 0.2;
                    partHeight = 3;
                    partDepth = 0.2;
                    break;
                case 'beam':
                    partWidth = 0.2;
                    partHeight = 3;
                    partDepth = 0.2;
                    break;
                default:
                    partWidth = 1;
                    partHeight = 1;
                    partDepth = 1;
            }
        });

        detailModal.style.display = 'block';

        document.getElementById('exportButton').addEventListener('click', function() {
            fetch('/export_ifc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    width: partWidth,
                    height: partHeight,
                    depth: partDepth,
                    name: objectName,
                    category: objectCategory
                })
            })
            .then(response => response.blob())
            .then(blob => {
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

    function renderObject(width = 1, height = 1, depth = 1) {
        if (threeCanvas.renderer) {
            threeCanvas.renderer.dispose();
        }

        var scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        var camera = new THREE.PerspectiveCamera(75, threeCanvas.clientWidth / threeCanvas.clientHeight, 0.1, 1000);
        
        var renderer = new THREE.WebGLRenderer({ antialias: true, canvas: threeCanvas });
        renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
        renderer.setClearColor(0xffffff);

        threeCanvas.renderer = renderer; 

        var geometry = new THREE.BoxGeometry(width, height, depth);
        var material = new THREE.MeshBasicMaterial({ color: 0x696969 });
        var cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        var edges = new THREE.EdgesGeometry(geometry);
        var lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
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
