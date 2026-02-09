(function(){
    var DELIMITER = ',';
    var NEWLINE = '\n';
    var i = document.getElementById('file');
    var table = document.getElementById('table');
    var filterInput = document.getElementById('filterInput');
    var filterButton = document.getElementById('filterButton');
    var csvData = [];

    if(!i || !table || !filterInput || !filterButton){
        return;
    }

    i.addEventListener('change', function(){
        if(i.files && i.files.length > 0){
            parseCSV(i.files[0]);
        }
    });

    filterButton.addEventListener('click', function(){
        var filterValue = filterInput.value.trim();
        if (filterValue) {
            toTable(csvData, filterValue);
        } else {
            toTable(csvData); // Show all rows if filter is empty
        }
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

    function toTable(rows, filterValue){
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

            // Apply filter
            if (filterValue && !cols.includes(filterValue)) {
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
