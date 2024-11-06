// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Select DOM elements
const canvas = document.getElementById('drawingCanvas');
const context = canvas.getContext('2d');
const polylineInfoContainer = document.getElementById('polylineInfoContainer');
const roomTypeSelect = document.getElementById('roomType');
const pdfUploadInput = document.getElementById('pdfUpload');
const startDrawingButton = document.getElementById('startDrawingButton');
const exportJsonButton = document.getElementById('exportJsonButton');
const gridUnitSizeInput = document.getElementById('gridUnitSize'); // New element

// Initialize variables
let allPolylines = [];
let currentPolyline = [];
let isClosed = false;
let pdfDoc = null;
let pageNum = 1;
let pdfImage = null;
let pdfX = 0, pdfY = 0, dragging = false, moving = false;
let scale = 1;
let scaleFactor = null;  // To store the calculated scale factor
let storyHeight = 3; // Default value

let startX, startY;
let deltaX = 0, deltaY = 0;

// Define a constant for closure proximity
const CLOSE_DISTANCE = 10; // in pixels

// Initialize a counter for polylines
let polylineCounter = 0;

// Define room colors
const roomColors = {
    'apartment': 'rgba(255, 255, 255, 0.5)',   // White
    'living_room': 'rgba(255, 0, 0, 0.5)',    // Red
    'kitchen': 'rgba(0, 255, 0, 0.5)',       // Green
    'bathroom': 'rgba(0, 0, 255, 0.5)',      // Blue
    'bedroom': 'rgba(255, 255, 0, 0.5)',     // Yellow
    'corridor': 'rgba(128, 0, 128, 0.5)',    // Purple
    'core': 'rgba(0, 0, 0, 0.5)'             // Black
};

let selectedRoomType = 'apartment';

// Introduce the isDrawing flag
let isDrawing = false;

// Initialize grid unit size
let gridUnitSize = parseInt(gridUnitSizeInput.value, 10) || 20;

window.onload = function() {
    drawGrid(context, gridUnitSize);
};

// Event listener for room type selection
roomTypeSelect.addEventListener('change', function(e) {
    selectedRoomType = e.target.value;
});

// Event listener for grid unit size change
gridUnitSizeInput.addEventListener('change', function(e) {
    const newSize = parseInt(e.target.value, 10);
    if (!isNaN(newSize) && newSize >= 10 && newSize <= 200) {
        gridUnitSize = newSize;
        drawPDFOnCanvas();
    } else {
        alert("Please enter a valid grid unit size between 10 and 200 pixels.");
        gridUnitSizeInput.value = gridUnitSize; // reset to previous valid value
    }
});

// Event listener for "Start Drawing" button
startDrawingButton.addEventListener('click', () => {
    if (!pdfImage) {
        alert("Please upload a PDF before starting to draw.");
        return;
    }
    if (isDrawing) {
        alert("Drawing mode is already active.");
        return;
    }
    isDrawing = true;
    alert("Drawing mode activated. PDF is now locked. Click on the canvas to start drawing.");
});

// Event listener for canvas click
canvas.addEventListener('click', (e) => {
    if (moving || dragging || !pdfImage) return;
    if (!isDrawing) return; // Only allow drawing when in drawing mode

    const point = getMousePosition(canvas, e);
    currentPolyline.push(point);

    drawCircle(context, point, 5);  // Draw circle at each point

    if (currentPolyline.length > 1) {
        drawLine(context, currentPolyline[currentPolyline.length - 2], currentPolyline[currentPolyline.length - 1]);
    }

    // After the first segment, prompt to set the scale factor
    if (currentPolyline.length === 2 && scaleFactor === null) {
        const realDistance = prompt("Enter the real-world distance for this first line segment (e.g., meters):");
        if (realDistance && !isNaN(realDistance) && parseFloat(realDistance) > 0) {
            const pixelDistance = calculatePixelDistance(currentPolyline[0], currentPolyline[1]);
            scaleFactor = parseFloat(realDistance) / pixelDistance;
            alert(`Scale factor set: 1 pixel = ${scaleFactor.toFixed(4)} real-world units.`);
        } else {
            alert("Invalid input. Please enter a positive number for the real-world distance.");
            // Optionally, remove the last point to let the user re-draw the segment
            currentPolyline.pop();
            drawPDFOnCanvas();
            // Redraw existing polylines if any
            allPolylines.forEach(polyline => {
                colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);
            });
        }
    }

    // Check for closure
    if (currentPolyline.length > 2 && isCloseToFirstPoint(currentPolyline[0], currentPolyline[currentPolyline.length - 1])) {
        // Set the last point to exactly the first point to close the polyline
        currentPolyline[currentPolyline.length - 1] = { ...currentPolyline[0] };

        // Draw a line from the new last point to the first point
        drawLine(context, currentPolyline[currentPolyline.length - 2], currentPolyline[0]);

        // Colorize the enclosed area
        colorizeEnclosedArea(context, currentPolyline, roomColors[selectedRoomType]);

        isClosed = true;

        // Save the polyline with its room type
        allPolylines.push({ points: [...currentPolyline], roomType: selectedRoomType });

        // Display polyline information (segment distances and area)
        const polylineId = displayPolylineInfo(currentPolyline);

        // Force the browser to render the polyline info before showing the confirmation
        // Access a layout property to force a reflow
        polylineInfoContainer.offsetHeight;

        // Use requestAnimationFrame to schedule the confirmation after rendering
        requestAnimationFrame(() => {
            // Additionally, use setTimeout to ensure the confirm dialog is triggered after the reflow
            setTimeout(() => {
                const userConfirmed = confirm("Do you want to keep this polyline?");
                if (!userConfirmed) {
                    // User chose to discard the polyline

                    // Remove the last polyline from allPolylines
                    allPolylines.pop();

                    // Remove the corresponding polyline info from the sidebar using its unique ID
                    const polylineInfoDiv = document.getElementById(polylineId);
                    if (polylineInfoDiv) {
                        polylineInfoContainer.removeChild(polylineInfoDiv);
                    }

                    // Redraw the canvas without the discarded polyline
                    drawPDFOnCanvas();
                }
                // Else, keep the polyline and continue drawing mode

                // Reset the current polyline for the next drawing
                currentPolyline = [];
            }, 0); // Minimal delay to ensure reflow completion
        });
    }
});

// Function to get mouse position relative to the canvas
function getMousePosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left - deltaX) / scale,
        y: (event.clientY - rect.top - deltaY) / scale
    };
}

// Function to draw a line between two points
function drawLine(context, start, end) {
    context.beginPath();
    context.moveTo(start.x * scale + deltaX, start.y * scale + deltaY);
    context.lineTo(end.x * scale + deltaX, end.y * scale + deltaY);
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.stroke();
    context.closePath();
}

// Function to draw a circle at a point
function drawCircle(context, point, radius) {
    context.beginPath();
    context.arc(point.x * scale + deltaX, point.y * scale + deltaY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = 'red';
    context.fill();
    context.strokeStyle = 'black';
    context.lineWidth = 1;
    context.stroke();
    context.closePath();
}

// Function to check if the last point is close to the first point
function isCloseToFirstPoint(firstPoint, lastPoint) {
    const distance = Math.sqrt(Math.pow(lastPoint.x - firstPoint.x, 2) + Math.pow(lastPoint.y - firstPoint.y, 2));
    return distance < CLOSE_DISTANCE;
}

// Function to colorize the enclosed area of a polyline
function colorizeEnclosedArea(context, points, color) {
    context.beginPath();
    context.moveTo(points[0].x * scale + deltaX, points[0].y * scale + deltaY);
    for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i].x * scale + deltaX, points[i].y * scale + deltaY);
    }
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.stroke();
}

// Function to calculate pixel distance between two points
function calculatePixelDistance(start, end) {
    const deltaX = (end.x - start.x) * scale;
    const deltaY = (end.y - start.y) * scale;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// Function to calculate real-world distance between two points
function calculateRealDistance(start, end) {
    const deltaX = (end.x - start.x) * scale;
    const deltaY = (end.y - start.y) * scale;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// Function to calculate the area of a polygon using the Shoelace Formula
function calculatePolygonArea(points) {
    if (points.length < 3) return 0; // A polygon must have at least 3 points

    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
        const current = points[i];
        const next = points[(i + 1) % n]; // Wrap around to the first point
        area += (current.x * next.y) - (next.x * current.y);
    }

    return Math.abs(area) / 2;
}

// Function to clear all polylines
function clearPolylines() {
    drawPDFOnCanvas();
    allPolylines = [];
    currentPolyline = [];
    isClosed = false;
    polylineInfoContainer.innerHTML = '';
    alert("All polylines have been cleared.");
}

// Function to clear the PDF
function clearPDF() {
    pdfImage = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    allPolylines = [];
    currentPolyline = [];
    isClosed = false;
    polylineInfoContainer.innerHTML = '';
    alert("PDF has been cleared.");
}

// Function to display polyline information with real-world distances and area
function displayPolylineInfo(points) {
    polylineCounter += 1; // Increment the counter for each new polyline
    const currentPolylineId = `polyline-${polylineCounter}`;

    const polylineDiv = document.createElement('div');
    polylineDiv.classList.add('polyline-info');
    polylineDiv.id = currentPolylineId; // Assign unique ID

    // Create mini canvas to visualize the polyline
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = 200;
    miniCanvas.height = 150;
    const miniContext = miniCanvas.getContext('2d');
    miniContext.clearRect(0, 0, miniCanvas.width, miniCanvas.height);

    // Draw the polyline on the mini canvas (scaled down)
    miniContext.beginPath();
    miniContext.moveTo(points[0].x / 5, points[0].y / 5);
    points.forEach(point => {
        miniContext.lineTo(point.x / 5, point.y / 5);
    });
    miniContext.closePath();
    miniContext.strokeStyle = 'black';
    miniContext.lineWidth = 2;
    miniContext.stroke();
    polylineDiv.appendChild(miniCanvas);

    // Convert points to real-world units
    if (!scaleFactor) {
        // If scaleFactor is not set, default to 1
        scaleFactor = 1;
    }
    const realWorldPoints = points.map(point => ({
        x: point.x * scaleFactor,
        y: point.y * scaleFactor
    }));

    // Calculate per-segment real-world distances (including the closing segment)
    const segmentDistances = [];
    for (let i = 0; i < realWorldPoints.length - 1; i++) {
        const distance = calculateRealDistance(realWorldPoints[i], realWorldPoints[i + 1]);
        segmentDistances.push(distance);
    }

    // Calculate area using Shoelace Formula
    const area = calculatePolygonArea(realWorldPoints);

    // Create a container for segment distances
    const distanceList = document.createElement('ul');
    distanceList.style.listStyleType = 'none';
    distanceList.style.padding = '0';
    distanceList.style.marginTop = '10px';

    segmentDistances.forEach((distance, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `W ${index + 1}: ${distance.toFixed(2)} meters`;
        distanceList.appendChild(listItem);
    });

    polylineDiv.appendChild(distanceList);

    // Display the area
    const areaParagraph = document.createElement('p');
    areaParagraph.textContent = `Area: ${area.toFixed(2)} square meters`;
    areaParagraph.style.fontWeight = 'bold';
    areaParagraph.style.marginTop = '10px';
    polylineDiv.appendChild(areaParagraph);

    // Insert the polyline info div at the top of the sidebar
    if (polylineInfoContainer.firstChild) {
        polylineInfoContainer.insertBefore(polylineDiv, polylineInfoContainer.firstChild);
    } else {
        polylineInfoContainer.appendChild(polylineDiv);
    }

    // Scroll the sidebar to the top to show the latest polyline
    polylineInfoContainer.scrollTop = 0;

    return currentPolylineId; // Return the unique ID for reference
}

// Event listener for PDF upload
pdfUploadInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const fileReader = new FileReader();
        fileReader.onload = function(e) {
            const typedArray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedArray).promise.then(function(pdfDoc_) {
                pdfDoc = pdfDoc_;
                renderPDF();
                // Ask the user for the story height
                const heightInput = prompt("Enter the story height for this floorplan (in meters):", storyHeight);
                
                if (heightInput && !isNaN(heightInput) && parseFloat(heightInput) > 0) {
                    storyHeight = parseFloat(heightInput);
                    alert(`Story height set to: ${storyHeight} meters.`);
                } else {
                    alert("Invalid input. Using default story height of 3 meters.");
                }

                alert("PDF uploaded successfully. You can now edit the PDF.");
            }).catch(function(error) {
                console.error("Error loading PDF:", error);
                alert("Failed to load PDF. Please ensure the file is a valid PDF.");
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

// Variables for dragging the PDF image
// let dragging = false;
// let startX, startY;  // Initial positions when dragging starts
let pdfOffsetX = 0, pdfOffsetY = 0;  // To track the current position of the PDF image

// Function to render the PDF on the canvas
function renderPDF() {
    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const scaleX = canvasWidth / viewport.width;
        const scaleY = canvasHeight / viewport.height;
        scale = Math.min(scaleX, scaleY);
        const scaledViewport = page.getViewport({ scale: scale });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = scaledViewport.width;
        tempCanvas.height = scaledViewport.height;
        const tempContext = tempCanvas.getContext('2d');

        page.render({ canvasContext: tempContext, viewport: scaledViewport }).promise.then(function() {
            pdfImage = new Image();
            pdfImage.src = tempCanvas.toDataURL();
            pdfImage.onload = function() {
                drawPDFOnCanvas();
            };
        });
    }).catch(function(error) {
        console.error("Error rendering PDF page:", error);
        alert("Failed to render PDF page.");
    });
}

// Function to draw the PDF image on the main canvas along with the grid and polylines
function drawPDFOnCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (pdfImage) {
        // Draw the PDF image at the current position with the current scale
        context.drawImage(pdfImage, pdfOffsetX + deltaX, pdfOffsetY + deltaY, pdfImage.width * scale, pdfImage.height * scale);
    }
    // Draw grid after PDF image
    drawGrid(context, gridUnitSize);
    // Redraw all confirmed polylines
    allPolylines.forEach(polyline => {
        colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);
    });
}

// Add event listeners for mouse/touch dragging
// Add event listeners for mouse dragging
canvas.addEventListener('mousedown', function(e) {
    if (!pdfImage || isDrawing) return;  // Prevent dragging if in drawing mode or if the PDF is not loaded
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener('mousemove', function(e) {
    if (!dragging || !pdfImage || isDrawing) return;  // Prevent dragging if in drawing mode
    const moveX = e.clientX - startX;
    const moveY = e.clientY - startY;

    // Update the offset of the PDF image
    pdfOffsetX += moveX;
    pdfOffsetY += moveY;

    // Redraw the PDF with the updated position
    drawPDFOnCanvas();

    // Update the start positions for the next movement
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener('mouseup', function() {
    dragging = false;  // Stop dragging when mouse is released
});

canvas.addEventListener('mouseleave', function() {
    dragging = false;  // Stop dragging if mouse leaves the canvas
});

// Handle touch events for dragging on mobile devices
canvas.addEventListener('touchstart', function(e) {
    if (!pdfImage || isDrawing) return;  // Prevent dragging if in drawing mode
    const touch = e.touches[0];
    dragging = true;
    startX = touch.clientX;
    startY = touch.clientY;
});

canvas.addEventListener('touchmove', function(e) {
    if (!dragging || !pdfImage || isDrawing) return;  // Prevent dragging if in drawing mode
    const touch = e.touches[0];
    const moveX = touch.clientX - startX;
    const moveY = touch.clientY - startY;

    // Update the offset of the PDF image
    pdfOffsetX += moveX;
    pdfOffsetY += moveY;

    // Redraw the PDF with the updated position
    drawPDFOnCanvas();

    startX = touch.clientX;
    startY = touch.clientY;
});

canvas.addEventListener('touchend', function() {
    dragging = false;  // Stop dragging on touch end
});

canvas.addEventListener('touchcancel', function() {
    dragging = false;  // Stop dragging if touch is canceled
});

// Zoom functionality using mouse wheel
canvas.addEventListener('wheel', function(e) {
    if (isDrawing || !pdfImage) return;  // Prevent zooming if in drawing mode
    e.preventDefault();
    const zoomIntensity = 0.1;
    if (e.deltaY < 0) {
        // Zoom in
        scale += zoomIntensity;
    } else {
        // Zoom out
        scale -= zoomIntensity;
    }
    scale = Math.min(Math.max(0.5, scale), 5);
    drawPDFOnCanvas();
});



// Function to draw the grid on the canvas
function drawGrid(context, gridSize) {
    const width = canvas.width;
    const height = canvas.height;
    
    // Loop to draw vertical lines
    for (let x = 0; x <= width; x += gridSize) {
        if ((x / gridSize) % 10 === 0) {
            context.lineWidth = 2;
            context.strokeStyle = 'rgba(0, 0, 0, 0.25)';  
        } else {
            context.lineWidth = 0.5;
            context.strokeStyle = 'rgba(0, 0, 0, 0.2)';  
        }
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    
    // Loop to draw horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
        if ((y / gridSize) % 10 === 0) {
            context.lineWidth = 2;
            context.strokeStyle = 'rgba(0, 0, 0, 0.25)';  
        } else {
            context.lineWidth = 0.5;
            context.strokeStyle = 'rgba(0, 0, 0, 0.2)';  
        }
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }
}

// Touch event handlers for mobile support
// Add event listeners for mouse/touch dragging
canvas.addEventListener('mousedown', function(e) {
    if (isDrawing || !pdfImage) return;  // Disable dragging if drawing mode is active or if the PDF is not loaded
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener('mousemove', function(e) {
    if (isDrawing || !dragging || !pdfImage) return;  // Disable dragging if drawing mode is active
    const moveX = e.clientX - startX;
    const moveY = e.clientY - startY;

    // Update the offset of the PDF image
    pdfOffsetX += moveX;
    pdfOffsetY += moveY;

    // Redraw the PDF with the updated position
    drawPDFOnCanvas();

    // Update the start positions for the next movement
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener('mouseup', function() {
    dragging = false;  // Stop dragging when mouse is released
});

canvas.addEventListener('mouseleave', function() {
    dragging = false;  // Stop dragging if mouse leaves the canvas
});

// Handle touch events for dragging on mobile devices
canvas.addEventListener('touchstart', function(e) {
    if (isDrawing || !pdfImage) return;  // Disable dragging if drawing mode is active
    const touch = e.touches[0];
    dragging = true;
    startX = touch.clientX;
    startY = touch.clientY;
});

canvas.addEventListener('touchmove', function(e) {
    if (isDrawing || !dragging || !pdfImage) return;  // Disable dragging if drawing mode is active
    const touch = e.touches[0];
    const moveX = touch.clientX - startX;
    const moveY = touch.clientY - startY;

    // Update the offset of the PDF image
    pdfOffsetX += moveX;
    pdfOffsetY += moveY;

    // Redraw the PDF with the updated position
    drawPDFOnCanvas();

    startX = touch.clientX;
    startY = touch.clientY;
});

canvas.addEventListener('touchend', function() {
    dragging = false;  // Stop dragging on touch end
});

canvas.addEventListener('touchcancel', function() {
    dragging = false;  // Stop dragging if touch is canceled
});

// Zoom functionality using mouse wheel
canvas.addEventListener('wheel', function(e) {
    if (isDrawing || !pdfImage) return;  // Disable zooming if drawing mode is active
    e.preventDefault();
    const zoomIntensity = 0.1;
    if (e.deltaY < 0) {
        // Zoom in
        scale += zoomIntensity;
    } else {
        // Zoom out
        scale -= zoomIntensity;
    }
    scale = Math.min(Math.max(0.5, scale), 5);
    drawPDFOnCanvas();
});


// Function to save polylines
function savePolylines() {
    if (allPolylines.length === 0) {
        alert("No polylines to save.");
        return;
    }
    localStorage.setItem('savedPolylines', JSON.stringify(allPolylines));
    alert("Polylines saved successfully.");
}

// Function to load polylines
function loadPolylines() {
    const saved = localStorage.getItem('savedPolylines');
    if (saved) {
        allPolylines = JSON.parse(saved);
        drawPDFOnCanvas();
        // Reset the polylineCounter based on loaded polylines
        polylineCounter = allPolylines.length;
        allPolylines.forEach(polyline => {
            colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);
            displayPolylineInfo(polyline.points);
        });
        alert("Polylines loaded successfully.");
    } else {
        alert("No saved polylines found.");
    }
}

// Function to display polyline information with real-world distances and area
function displayPolylineInfo(points) {
    polylineCounter += 1; // Increment the counter for each new polyline
    const currentPolylineId = `polyline-${polylineCounter}`;

    const polylineDiv = document.createElement('div');
    polylineDiv.classList.add('polyline-info');
    polylineDiv.id = currentPolylineId; // Assign unique ID

    // Create mini canvas to visualize the polyline
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = 200;
    miniCanvas.height = 150;
    const miniContext = miniCanvas.getContext('2d');
    miniContext.clearRect(0, 0, miniCanvas.width, miniCanvas.height);

    // Draw the polyline on the mini canvas (scaled down)
    miniContext.beginPath();
    miniContext.moveTo(points[0].x / 5, points[0].y / 5);
    points.forEach(point => {
        miniContext.lineTo(point.x / 5, point.y / 5);
    });
    miniContext.closePath();
    miniContext.strokeStyle = 'black';
    miniContext.lineWidth = 2;
    miniContext.stroke();
    polylineDiv.appendChild(miniCanvas);

    // Convert points to real-world units
    if (!scaleFactor) {
        // If scaleFactor is not set, default to 1
        scaleFactor = 1;
    }
    const realWorldPoints = points.map(point => ({
        x: point.x * scaleFactor,
        y: point.y * scaleFactor
    }));

    // Calculate per-segment real-world distances (including the closing segment)
    const segmentDistances = [];
    for (let i = 0; i < realWorldPoints.length - 1; i++) {
        const distance = calculateRealDistance(realWorldPoints[i], realWorldPoints[i + 1]);
        segmentDistances.push(distance);
    }

    // Calculate area using Shoelace Formula
    const area = calculatePolygonArea(realWorldPoints);

    // Create a container for segment distances
    const distanceList = document.createElement('ul');
    distanceList.style.listStyleType = 'none';
    distanceList.style.padding = '0';
    distanceList.style.marginTop = '10px';

    segmentDistances.forEach((distance, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `W ${index + 1}: ${distance.toFixed(2)} meters`;
        distanceList.appendChild(listItem);
    });

    polylineDiv.appendChild(distanceList);

    // Display the area
    const areaParagraph = document.createElement('p');
    areaParagraph.textContent = `Area: ${area.toFixed(2)} square meters`;
    areaParagraph.style.fontWeight = 'bold';
    areaParagraph.style.marginTop = '10px';
    polylineDiv.appendChild(areaParagraph);

    // Insert the polyline info div at the top of the sidebar
    if (polylineInfoContainer.firstChild) {
        polylineInfoContainer.insertBefore(polylineDiv, polylineInfoContainer.firstChild);
    } else {
        polylineInfoContainer.appendChild(polylineDiv);
    }

    // Scroll the sidebar to the top to show the latest polyline
    polylineInfoContainer.scrollTop = 0;

    return currentPolylineId; // Return the unique ID for reference
}

// Event listener for "Export JSON" button
exportJsonButton.addEventListener('click', () => {
    if (allPolylines.length === 0) {
        alert("No polylines to export.");
        return;
    }
    if (scaleFactor === null) {
        alert("Scale factor is not set. Please draw the first segment and set the scale factor before exporting.");
        return;
    }

    const panels = {
        "attributes": {},
        "items": {},
        "max_key": 0
    };

    let segmentKey = 0;

    allPolylines.forEach(polyline => {
        const points = polyline.points;
        for (let i = 0; i < points.length - 1; i++) {
            let startPoint = points[i];
            let endPoint = points[i + 1];

            // Determine the point closest to the origin to be the start point
            const distanceToOriginStart = Math.sqrt(Math.pow(startPoint.x, 2) + Math.pow(startPoint.y, 2));
            const distanceToOriginEnd = Math.sqrt(Math.pow(endPoint.x, 2) + Math.pow(endPoint.y, 2));
            
            if (distanceToOriginEnd < distanceToOriginStart) {
                // Swap points if end point is closer to the origin
                [startPoint, endPoint] = [endPoint, startPoint];
            }

            // Calculate deltas
            const deltaXSegment = (endPoint.x - startPoint.x) * scale;
            const deltaYSegment = (endPoint.y - startPoint.y) * scale;

            // Determine the angle of the segment in degrees
            const angle = Math.atan2(deltaYSegment, deltaXSegment) * (180 / Math.PI); // Angle in degrees

            // Determine if the wall is horizontal or vertical based on angle
            const angleThreshold = 45; // degrees
            let normal = '';
            let dimensions = [0, 0, 3]; // [x, y, z]

            // Calculate the real-world distance of the segment
            const realDistance = calculateRealDistance(startPoint, endPoint) * scaleFactor;

            if (Math.abs(angle) <= angleThreshold || Math.abs(angle) >= (180 - angleThreshold)) {
                // Horizontal wall
                normal = 'y'; 
                dimensions[0] = realDistance; // Length in the x-direction
                dimensions[1] = 0.0; // Thickness in the y-direction
            } else {
                // Vertical wall
                normal = 'x'; 
                dimensions[0] = 0.0; // Thickness in the x-direction
                dimensions[1] = realDistance; // Length in the y-direction
            }

            // Assign real-world start point coordinates using scaleFactor
            const realStartX = startPoint.x * scaleFactor;
            const realStartY = startPoint.y * scaleFactor;
            const realEndX = endPoint.x * scaleFactor;
            const realEndY = endPoint.y * scaleFactor;

            // Define the panel object
            const panel = {
                "panel_type": "WallType1",
                "start_point": [
                    parseFloat(realStartX.toFixed(2)),
                    parseFloat(realStartY.toFixed(2)),
                    0.0
                ],
                // "dimensions": [
                //     parseFloat(dimensions[0].toFixed(2)),
                //     parseFloat(dimensions[1].toFixed(2)),
                //     dimensions[2]
                // ]
                "end_point": [
                    parseFloat(realEndX.toFixed(2)),
                    parseFloat(realEndY.toFixed(2)),
                    0.0
                ],
                "height": storyHeight,
                "thickness": 0.2 // Fixed thickness
            };

            // Add the panel to items
            panels.items[segmentKey] = panel;
            segmentKey++;
        }
    });

    // Add max_key to reflect the total number of segments
    panels.max_key = segmentKey;

    const jsonData = {
        "panels": panels
    };

    // Convert JSON object to string
    const jsonString = JSON.stringify(jsonData, null, 4);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: "application/json" });

    // Create a link to download the Blob
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "panels.json";
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert("JSON exported successfully.");
});
