(function(){
    var DELIMITER = ',';
    var NEWLINE = '\n';
    var fileInput = document.getElementById('file');
    var table = document.getElementById('table');
    var filterInputs = document.querySelectorAll('.filterInput');
    var filterButton = document.getElementById('filterButton');
    var csvData = [];

    if(!fileInput || !table || !filterInputs || !filterButton){
        return;
    }

    fileInput.addEventListener('change', function(){
        if(fileInput.files && fileInput.files.length > 0){
            parseCSV(fileInput.files[0]);
        }
    });

    filterButton.addEventListener('click', function(){
        var filterValues = Array.from(filterInputs).map(input => input.value.trim()).filter(value => value);
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

        headers.forEach(function(h) {
            var th = document.createElement('th');
            var ht = h.trim();

            if (!ht) {
                return;
            }

            th.textContent = ht;
            htr.appendChild(th);
        });

        // Add headers to the table
        table.appendChild(htr);

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
            var matchesAllFilters = filterValues.every(filterValue => cols.some(col => col.includes(filterValue)));

            if (!matchesAllFilters) {
                continue;
            }

            var rtr = document.createElement('tr');

            cols.forEach(function(c) {
                var td = document.createElement('td');
                var tc = c.trim();

                td.textContent = tc;
                rtr.appendChild(td);
            });

            table.appendChild(rtr);
        }
    }
})();