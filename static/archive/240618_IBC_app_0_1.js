(function() {
    var DELIMITER = ',';
    var NEWLINE = '\n';
    var fileInput = document.getElementById('file');
    var gridContainer = document.getElementById('gridContainer');
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
        'U-WERT',
        'ImageURL']; 

    if (!fileInput || !gridContainer || !filterButton || !resultsCountDiv || !detailModal || !modalImage || !modalDetails || !closeModal || !threeCanvas) {
        console.error('One or more required elements are missing.');
        return;
    }

    fileInput.addEventListener('change', function() {
        if (fileInput.files && fileInput.files.length > 0) {
            parseCSV(fileInput.files[0]);
        }
    });

    filterButton.addEventListener('click', function() {
        var filterValues = {
            filter1: document.getElementById('filter1').value.trim().toLowerCase(),
            filter2: document.getElementById('filter2').value.trim().toLowerCase(),
            filter3: document.getElementById('filter3').value.trim().toLowerCase(),
            minThickness: parseFloat(document.getElementById('minThickness').value),
            maxThickness: parseFloat(document.getElementById('maxThickness').value)
        };

        // Convert empty string to null
        if (filterValues.filter1 === "") filterValues.filter1 = null;
        if (filterValues.filter2 === "") filterValues.filter2 = null;
        if (filterValues.filter3 === "") filterValues.filter3 = null;
        if (isNaN(filterValues.minThickness)) filterValues.minThickness = null;
        if (isNaN(filterValues.maxThickness)) filterValues.maxThickness = null;

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
            toGrid(csvData); // Load grid without filters initially
        };

        reader.readAsText(file);
    }

    function toGrid(rows, filterValues = {}) {
        if (!rows || rows.length === 0) {
            console.warn('No rows to process.');
            return;
        }

        while (gridContainer.firstChild) {
            gridContainer.removeChild(gridContainer.firstChild);
        }

        var headers = rows[0].trim().split(DELIMITER);

        var filteredRowCount = 0;

        for (var i = 1; i < rows.length; i++) {
            var r = rows[i].trim();
            if (!r) {
                continue;
            }

            var cols = r.split(DELIMITER);
            if (cols.length === 0) {
                continue;
            }

            var filter1Index = headers.indexOf('FILTER1');
            var filter2Index = headers.indexOf('FILTER2');
            var filter3Index = headers.indexOf('FILTER3');
            var thicknessIndex = headers.indexOf('THICKNESS (mm)');

            if (filter1Index === -1 || filter2Index === -1 || filter3Index === -1 || thicknessIndex === -1) {
                console.error('One or more required columns not found.');
                continue;
            }

            var filter1 = cols[filter1Index].trim().toLowerCase();
            var filter2 = cols[filter2Index].trim().toLowerCase();
            var filter3 = cols[filter3Index].trim().toLowerCase();
            var thickness = parseFloat(cols[thicknessIndex]);

            if (filterValues.filter1 && filterValues.filter1 !== filter1) continue;
            if (filterValues.filter2 && filterValues.filter2 !== filter2) continue;
            if (filterValues.filter3 && filterValues.filter3 !== filter3) continue;
            if (filterValues.minThickness !== null && thickness < filterValues.minThickness) continue;
            if (filterValues.maxThickness !== null && thickness > filterValues.maxThickness) continue;

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
        objectCode = '';
        objectThickness = '';
        objectIsExternal = '';

        details.forEach(function(detail) {
            var p = document.createElement('p');
            p.textContent = `${detail.header}: ${detail.value}`;
            modalDetails.appendChild(p);

            if (detail.header === 'NUMBER CODE') {
                objectCode = detail.value;
            } else if (detail.header === 'CATEGORY') {
                objectCategory = detail.value.toLowerCase();
            } else if (detail.header === 'THICKNESS (mm)') {
                objectThickness = detail.value; 
            } else if (detail.header === 'EXTERNAL') {
                objectIsExternal = detail.value;
            }

            switch (objectCategory) {
                case 'wall':
                    partWidth = 1;
                    partHeight = 3;
                    partDepth = objectThickness * 0.001;
                    break;
                case 'floor':
                    partWidth = objectThickness * 0.001;
                    partHeight = 3;
                    partDepth = 0.2;
                    break;
                case 'beam':
                    partWidth = 3;
                    partHeight = objectThickness * 0.001;
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
            var width = partWidth;
            var height = partHeight;
            var depth = partDepth;

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
