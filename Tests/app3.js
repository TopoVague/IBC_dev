(function(){
    var DELIMITER = ',';
    var NEWLINE = '\n';
    var fileInput = document.getElementById('file');
    var table = document.getElementById('table');
    var filterInputs = document.querySelectorAll('.filterInput');
    var filterButton = document.getElementById('filterButton');

    //create a variable to count the results 
    var resultsCountDiv = document.getElementById('resultsCount');

    //file with data in the future can be a database
    var csvData = [];

    // Add the headers of columns you want to hide here
    var hiddenColumns = ['NUMBER CODE','VERSION', 'ImageURL']; 


    //check if you a file and filters
    if (!fileInput || !table || !filterInputs || !filterButton || !resultsCountDiv) {
        return;
    }


    fileInput.addEventListener('change', function(){
        if(fileInput.files && fileInput.files.length > 0){
            parseCSV(fileInput.files[0]);
        }
    });

    filterButton.addEventListener('click', function() {
        var filterValues = Array.from(filterInputs).map(input => input.value.trim().toLowerCase()).filter(value => value);
        toTable(csvData, filterValues);
    });

    function parseCSV(file){
        if (!file || !FileReader){
            return; 
        }

        var reader = new FileReader();

        reader.onload = function(e) {
            csvData = e.target.result.split(NEWLINE);
            toTable(csvData);
        };

        reader.readAsText(file);
    }

    function toTable(rows, filterValues = []){
        if (!rows || rows.length === 0){
            return;
        }

        // Clear table
        while(table.firstChild){
            table.removeChild(table.firstChild);
        }

        var headers = rows[0].trim().split(DELIMITER);
        var htr = document.createElement('tr');

        // Add an extra header for the image column first
        var imageTh = document.createElement('th');
        imageTh.textContent = 'PREVIEW';
        htr.appendChild(imageTh);

        headers.forEach(function(h) {
            var ht = h.trim();
            if (!ht || hiddenColumns.includes(ht)) {
                return;
            }

            var th = document.createElement('th');
            th.textContent = ht;
            htr.appendChild(th);
        });

        // Add headers to the table
        table.appendChild(htr);

        //create a variable to store the number of results after filtering
        var filteredRowCount = 0;

        // Filter and add rows
        for (var i = 1; i < rows.length; i++) {
            var r = rows[i].trim();
            if(!r) {
                continue;
            }

            var cols = r.split(DELIMITER);

            if (cols.length === 0) {
                continue;
            }
            

            // Apply filters
            //filters ARE case sensitive
            //var matchesAllFilters = filterValues.every(filterValue => cols.some(col => col.includes(filterValue)));
            //upfdate code to make filter non case sensitive
      
            var matchesAllFilters = filterValues.every(filterValue => 
                cols.some(col => col.toLowerCase().includes(filterValue))
            );

            if (!matchesAllFilters) {
                continue;
            }

            //add each fitered row to the counter 
            filteredRowCount++;

            var rtr = document.createElement('tr');

            // Add image column first
            var imageUrl = cols[headers.indexOf('ImageURL')]; // Adjust if ImageURL column position changes
            var imgTd = document.createElement('td');
            var img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Image';
            img.width = 150; // Set width or any other attributes as needed
            imgTd.appendChild(img);
            rtr.appendChild(imgTd);

            // Add other columns, skipping hidden columns
            cols.forEach(function(c, index) {
                var header = headers[index].trim();
                if (hiddenColumns.includes(header)) {
                    return;
                }

                var td = document.createElement('td');
                var tc = c.trim();

                td.textContent = tc;
                rtr.appendChild(td);
            });

            table.appendChild(rtr);
        }

        // Update the results count message
        resultsCountDiv.textContent = `Number of elements in the library after filtering: ${filteredRowCount}`;
    }
})();
