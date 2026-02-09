// Select DOM elements
const canvas = document.getElementById('drawingCanvas');
const context = canvas.getContext('2d');
const polylineInfoContainer = document.getElementById('polylineInfoContainer');
const roomTypeSelect = document.getElementById('roomType');
const pdfUploadInput = document.getElementById('pdfUpload');
const startDrawingButton = document.getElementById('startDrawingButton');

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

// Event listener for room type selection
roomTypeSelect.addEventListener('change', function(e) {
    selectedRoomType = e.target.value;
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
            context.clearRect(0, 0, canvas.width, canvas.height);
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
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// Function to draw a line between two points
function drawLine(context, start, end) {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.stroke();
    context.closePath();
}

// Function to draw a circle at a point
function drawCircle(context, point, radius) {
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
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
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i].x, points[i].y);
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
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// Function to calculate real-world distance between two points
function calculateRealDistance(start, end) {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
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
    context.clearRect(0, 0, canvas.width, canvas.height);
    allPolylines = [];
    currentPolyline = [];
    isClosed = false;
    polylineInfoContainer.innerHTML = '';
    if (pdfImage) {
        drawPDFOnCanvas();
    }
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
        listItem.textContent = `Segment ${index + 1}: ${distance.toFixed(2)} units`;
        distanceList.appendChild(listItem);
    });

    polylineDiv.appendChild(distanceList);

    // Display the area
    const areaParagraph = document.createElement('p');
    areaParagraph.textContent = `Area: ${area.toFixed(2)} square units`;
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
                alert("PDF uploaded successfully. You can now edit the PDF.");
            }).catch(function(error) {
                console.error("Error loading PDF:", error);
                alert("Failed to load PDF. Please ensure the file is a valid PDF.");
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

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

// Function to draw the PDF image on the main canvas
function drawPDFOnCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (pdfImage) {
        context.drawImage(pdfImage, pdfX + deltaX, pdfY + deltaY, pdfImage.width * scale, pdfImage.height * scale);
    }
    // Redraw all confirmed polylines
    allPolylines.forEach(polyline => {
        colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);
    });
}

// Touch event handlers for mobile support
canvas.addEventListener('touchstart', function(e) {
    if (isDrawing) return; // Disable panning while drawing
    if (e.touches.length === 1 && pdfImage) {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        dragging = true; // Set dragging to true when touch starts
        e.preventDefault();
    }
});

canvas.addEventListener('touchmove', function(e) {
    if (isDrawing) return; // Disable panning while drawing
    if (e.touches.length === 1 && pdfImage && dragging) {
        const touch = e.touches[0];
        const moveX = touch.clientX - startX;
        const moveY = touch.clientY - startY;

        deltaX += moveX;
        deltaY += moveY;

        drawPDFOnCanvas();

        startX = touch.clientX;
        startY = touch.clientY;

        e.preventDefault();
    }
});

canvas.addEventListener('touchend', function(e) {
    if (isDrawing) return; // Disable panning while drawing
    dragging = false; // Reset dragging flag when touch ends
    startX = null;
    startY = null;
});

// Zoom functionality using mouse wheel
canvas.addEventListener('wheel', function(e) {
    if (isDrawing) return; // Disable zooming while drawing
    if (pdfImage) {
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
    }
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
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (pdfImage) {
            drawPDFOnCanvas();
        }
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
