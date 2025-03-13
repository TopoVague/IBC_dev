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

const defineApartmentButton = document.getElementById('defineApartmentButton');
const confirmGroupButton = document.getElementById('confirmGroupButton');

let SNAP_DISTANCE = 5;

// Initialize variables
let allPolylines = [];
let isDefiningApartment = false;
let roomTags = []; // New array to store tags for each room
let currentPolyline = [];
let isClosed = false;
let pdfDoc = null;
let pageNum = 1;
let pdfImage = null;
let pdfX = 0,
    pdfY = 0,
    dragging = false,
    moving = false;
let scale = 1;
let apartmentCounter = 1; // Initialize apartmentCounter here
let scaleFactor = null; // To store the calculated scale factor
let storyHeight = 3; // Default value

let startX, startY;
let deltaX = 0,
    deltaY = 0;

// Define a constant for closure proximity
const CLOSE_DISTANCE = 10; // in pixels

// Initialize a counter for polylines
let polylineCounter = 0;

// Define room colors
const roomColors = {
    'living_room': 'rgba(255, 0, 0, 0.5)', // Red
    'kitchen': 'rgba(0, 255, 0, 0.5)', // Green
    'bathroom': 'rgba(0, 0, 255, 0.5)', // Blue
    'bedroom': 'rgba(255, 255, 0, 0.5)', // Yellow
    'corridor': 'rgba(128, 0, 128, 0.5)', // Purple
    'core': 'rgba(0, 0, 0, 0.5)' // Black
};

let selectedRoomType = 'living_room';

// Introduce the isDrawing flag
let isDrawing = false;

// Initialize grid unit size
let gridUnitSize = parseInt(gridUnitSizeInput.value, 10) || 20;

window.onload = function () {
    drawGrid(context, gridUnitSize);
};

function convertToGrayscale(ctx, canvasWidth, canvasHeight) {
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Compute luminance (standard Rec. 601 weighting)
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i]     = gray; // red channel
        data[i + 1] = gray; // green channel
        data[i + 2] = gray; // blue channel
        // alpha channel (data[i+3]) stays unchanged
    }
    ctx.putImageData(imageData, 0, 0);
}

function adjustBrightness(ctx, canvasWidth, canvasHeight, brightnessValue) {
    // brightnessValue > 0 → image gets brighter
    // brightnessValue < 0 → image gets darker
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        data[i]   += brightnessValue;  // R
        data[i+1] += brightnessValue;  // G
        data[i+2] += brightnessValue;  // B
    }
    ctx.putImageData(imageData, 0, 0);
}

function adjustContrast(ctx, canvasWidth, canvasHeight, contrastValue) {
    // contrastValue > 0 → higher contrast
    // contrastValue < 0 → lower contrast
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));

    for (let i = 0; i < data.length; i += 4) {
        data[i]   = factor * (data[i]   - 128) + 128; // R
        data[i+1] = factor * (data[i+1] - 128) + 128; // G
        data[i+2] = factor * (data[i+2] - 128) + 128; // B
    }
    ctx.putImageData(imageData, 0, 0);
}

function applyThreshold(ctx, canvasWidth, canvasHeight, thresholdValue) {
    // thresholdValue = 128, for instance, makes anything <128 black, else white
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i]; // since it's already grayscale at this point
        if (gray < thresholdValue) {
            // black
            data[i]   = 0;
            data[i+1] = 0;
            data[i+2] = 0;
        } else {
            // white
            data[i]   = 255;
            data[i+1] = 255;
            data[i+2] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// Function to calculate the centroid of a polyline
function calculateCentroid(points) {
    let x = 0, y = 0;
    points.forEach(point => {
        x += point.x;
        y += point.y;
    });
    return { x: x / points.length, y: y / points.length };
}

// Modify the function where the polyline is finalized to add tags
function finalizePolyline() {
    if (isClosed && currentPolyline.length > 2) {
        // Validate that all points have x and y defined before pushing to allPolylines
        const isValidPolyline = currentPolyline.every(point => point.x !== undefined && point.y !== undefined);
        if (isValidPolyline) {
            allPolylines.push({ points: [...currentPolyline], roomType: selectedRoomType });
            
            // Calculate the centroid for the tag
            const centroid = calculateCentroid(currentPolyline);
            roomTags.push({
                id: roomTags.length + 1,
                position: centroid,
                roomType: selectedRoomType,
                selected: false
            });
            // Display polyline information (segment distances and area) and store unique ID
            const polylineId = displayPolylineInfo(currentPolyline, selectedRoomType, "N/A");

            currentPolyline = []; // Reset for the next polyline
            isClosed = false; // Reset closure status
            drawPDFOnCanvas(); // Redraw to include the new polyline and tag
            return polylineId; // Return the unique ID if needed elsewhere
        } else {
            console.warn("Invalid polyline detected; skipping:", currentPolyline);
        }
    }
}



// Draw tags on the canvas
function drawTags() {
    roomTags.forEach(tag => {
        context.fillStyle = tag.selected ? 'orange' : 'black';
        context.font = '12px Arial';
        context.textAlign = 'center';
        context.fillText(
            tag.roomType,
            tag.position.x * scale + deltaX + pdfOffsetX,
            tag.position.y * scale + deltaY + pdfOffsetY
        );
    });
}

// Handle selecting and grouping tags in apartment grouping mode
canvas.addEventListener('click', (e) => {
    if (!isDefiningApartment) return;

    const clickedPoint = getMousePosition(canvas, e);

    // Check if a tag was clicked
    const selectedTag = roomTags.find(tag => isPointNearTag(clickedPoint, tag.position));

    if (selectedTag) {
        // Toggle selection
        selectedTag.selected = !selectedTag.selected;
        drawPDFOnCanvas();
    }
});

// Utility function to check if a point is near a tag
function isPointNearTag(point, tagPosition) {
    const distance = Math.sqrt((point.x - tagPosition.x) ** 2 + (point.y - tagPosition.y) ** 2);
    return distance < 10; // Adjust for sensitivity as needed
}



function groupSelectedTags() {
    const selectedTags = roomTags.filter(tag => tag.selected);

    if (selectedTags.length === 0) {
        alert("No rooms selected to define an apartment.");
        return;
    }

    const apartmentId = `Apartment ${apartmentCounter}`;
    let apartmentEdges = []; // Array to store all edges for the apartment boundary
    const roomTypes = new Set(); // To collect unique room types

    selectedTags.forEach(tag => {
        tag.apartment = apartmentId;
        tag.selected = false; // Clear selection

        // Find the corresponding polyline for the selected tag
        const polyline = allPolylines.find(poly => {
            const centroid = calculateCentroid(poly.points);
            return centroid.x === tag.position.x && centroid.y === tag.position.y;
        });

        // If a matching polyline is found, add its edges and room type
        if (polyline) {
            apartmentEdges = apartmentEdges.concat(getPolylineEdges(polyline.points));
            roomTypes.add(polyline.roomType); // Add room type to the set
        }
    });

    // Generate a comma-separated string of unique room types
    const roomTypeSummary = Array.from(roomTypes).join(", ");

    // Filter to keep only exterior edges and create a continuous boundary
    const apartmentBoundary = getExteriorEdges(apartmentEdges);

    // Display the apartment boundary information with all room types in the summary and apartment ID
    displayPolylineInfo(apartmentBoundary, roomTypeSummary, apartmentId);

    // Display notification in the sidebar
    const apartmentInfo = document.createElement('div');
    apartmentInfo.classList.add('apartment-info');
    apartmentInfo.innerText = `Grouped selected rooms into ${apartmentId}`;
    polylineInfoContainer.appendChild(apartmentInfo);

    apartmentCounter++; // Increment the counter for the next apartment
    drawPDFOnCanvas(); // Redraw to reflect the grouping visually
}

// Function to convert polyline points into edges
function getPolylineEdges(points) {
    let edges = [];
    for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length]; // Wrap around to close the polyline

        // Ensure that start and end have valid x and y properties
        if (start && end && !isNaN(start.x) && !isNaN(start.y) && !isNaN(end.x) && !isNaN(end.y)) {
            edges.push({ start, end });
        } else {
            console.warn("Invalid edge detected:", { start, end });
        }
    }
    return edges;
}

// Function to filter out shared edges and keep only exterior edges
function getExteriorEdges(edges) {
    const edgeMap = new Map();

    edges.forEach(edge => {
        const edgeKey = `${edge.start.x},${edge.start.y}-${edge.end.x},${edge.end.y}`;
        const reverseEdgeKey = `${edge.end.x},${edge.end.y}-${edge.start.x},${edge.start.y}`;

        // Track occurrences of each edge
        if (edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, edgeMap.get(edgeKey) + 1);
        } else if (edgeMap.has(reverseEdgeKey)) {
            edgeMap.set(reverseEdgeKey, edgeMap.get(reverseEdgeKey) + 1);
        } else {
            edgeMap.set(edgeKey, 1);
        }
    });

    // Filter to keep edges that appear only once (exterior edges)
    const exteriorEdges = [];
    edgeMap.forEach((count, key) => {
        if (count === 1) {
            const [startStr, endStr] = key.split('-');
            const [startX, startY] = startStr.split(',').map(Number);
            const [endX, endY] = endStr.split(',').map(Number);
            exteriorEdges.push({
                start: { x: startX, y: startY },
                end: { x: endX, y: endY }
            });
        }
    });

    // Build a continuous path from the exterior edges
    return buildContinuousPath(exteriorEdges);
}

// Function to build a continuous path from unordered edges
function buildContinuousPath(edges) {
    if (edges.length === 0) return [];

    // Start with the first edge
    const path = [edges[0].start, edges[0].end];
    edges.splice(0, 1); // Remove the first edge from the array

    let currentPoint = path[path.length - 1];

    // Iterate until all edges are connected
    while (edges.length > 0) {
        const nextEdgeIndex = edges.findIndex(edge =>
            (edge.start.x === currentPoint.x && edge.start.y === currentPoint.y) ||
            (edge.end.x === currentPoint.x && edge.end.y === currentPoint.y)
        );

        if (nextEdgeIndex === -1) break; // No more connecting edges found

        const nextEdge = edges.splice(nextEdgeIndex, 1)[0];

        // Determine the correct orientation for the next edge
        const nextPoint = (nextEdge.start.x === currentPoint.x && nextEdge.start.y === currentPoint.y)
            ? nextEdge.end
            : nextEdge.start;

        // Add the next point only if it’s not a duplicate of the current point
        if (nextPoint.x !== currentPoint.x || nextPoint.y !== currentPoint.y) {
            path.push(nextPoint);
            currentPoint = nextPoint;
        }
    }

    // Close the path if it's meant to be a closed boundary
    if (path[0].x !== path[path.length - 1].x || path[0].y !== path[path.length - 1].y) {
        path.push(path[0]); // Add the first point at the end to close the loop
    }

    return path;
}




// Function to find the nearest point on a polyline within the snap distance
function findNearestPointOnPolyline(point) {
    let closestPoint = null;
    let minDistance = SNAP_DISTANCE;

    allPolylines.forEach(polyline => {
        for (let i = 0; i < polyline.points.length - 1; i++) {
            const start = polyline.points[i];
            const end = polyline.points[i + 1];
            const projectedPoint = getClosestPointOnSegment(start, end, point);

            const distance = calculatePixelDistance(point, projectedPoint);

            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = projectedPoint;
            }
        }
    });

    return closestPoint;
}

// Function to calculate the closest point on a line segment to a given point
function getClosestPointOnSegment(A, B, P) {
    const AP = { x: P.x - A.x, y: P.y - A.y };
    const AB = { x: B.x - A.x, y: B.y - A.y };
    const abSquared = AB.x * AB.x + AB.y * AB.y;
    const ap_ab = AP.x * AB.x + AP.y * AB.y;
    const t = Math.max(0, Math.min(1, ap_ab / abSquared));

    return {
        x: A.x + AB.x * t,
        y: A.y + AB.y * t
    };
}

// Utility function to calculate pixel distance between two points
function calculatePixelDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}



// Event listener for "Define Apartment" button
defineApartmentButton.addEventListener('click', () => {
    if (allPolylines.length === 0) {
        alert("No rooms available to define apartments.");
        return;
    }

    isDefiningApartment = true;
    isDrawing = false;
    alert("Apartment defining mode activated. Click on tags to select rooms for the apartment.");
    drawPDFOnCanvas(); // Redraw to ensure tags are visible
});

// Event listener for "Confirm Grouping" button
confirmGroupButton.addEventListener('click', groupSelectedTags);





// Event listener for room type selection
roomTypeSelect.addEventListener('change', function (e) {
    selectedRoomType = e.target.value;
});

// Event listener for grid unit size change
gridUnitSizeInput.addEventListener('change', function (e) {
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


canvas.addEventListener('click', (e) => {
    if (moving || dragging || !pdfImage) return;
    if (!isDrawing) return; // Only allow drawing when in drawing mode

    let point = getMousePosition(canvas, e); // Initial clicked position

    // Step 1: Check if the click is near any existing point
    const closestPoint = findClosestPoint(point);
    if (closestPoint) {
        // Snap the current point to the closest existing point
        point = { x: closestPoint.x, y: closestPoint.y };
    } else {
        // Step 2: Check if the click is near any polyline segment
        const snapPoint = findNearestPointOnPolyline(point);
        if (snapPoint) {
            // Snap the point to the nearest point on the polyline segment
            point = snapPoint;
        }
    }

    // Optional: Constrain to horizontal/vertical if Shift is pressed and there's at least one point
    if (currentPolyline.length > 0 && e.shiftKey) {
        const lastPoint = currentPolyline[currentPolyline.length - 1];
        const dx = Math.abs(point.x - lastPoint.x);
        const dy = Math.abs(point.y - lastPoint.y);

        if (dx > dy) {
            point.y = lastPoint.y; // Horizontal line
        } else {
            point.x = lastPoint.x; // Vertical line
        }
    }

    // Add the final snapped or constrained point to the polyline
    currentPolyline.push(point);

    drawCircle(context, point, 5); // Draw circle at each point

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
            // Remove the last point to let the user re-draw the segment
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
        const newTagIndex = roomTags.length;

        // Call finalizePolyline to save the polyline and create a tag
        finalizePolyline();

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
                    roomTags.splice(newTagIndex, 1); 

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
        x: (event.clientX - rect.left - deltaX - pdfOffsetX) / scale,
        y: (event.clientY - rect.top - deltaY - pdfOffsetY) / scale
    };
}

// Function to find the closest point in any polyline within a certain distance
function findClosestPoint(point) {
    let closestPoint = null;
    let minDistance = CLOSE_DISTANCE / scale; // Adjust for current scale

    allPolylines.forEach(polyline => {
        // Check all points in the polyline, not just endpoints
        polyline.points.forEach(polylinePoint => {
            const distance = calculatePixelDistance(point, polylinePoint);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = polylinePoint;
            }
        });
    });

    return closestPoint;
}

// Function to draw a line between two points
function drawLine(context, start, end) {
    context.beginPath();
    context.moveTo(start.x * scale + deltaX + pdfOffsetX, start.y * scale + deltaY + pdfOffsetY);
    context.lineTo(end.x * scale + deltaX + pdfOffsetX, end.y * scale + deltaY + pdfOffsetY);
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.stroke();
    context.closePath();
}

// Function to draw a circle at a point
function drawCircle(context, point, radius) {
    context.beginPath();
    context.arc(point.x * scale + deltaX + pdfOffsetX, point.y * scale + deltaY + pdfOffsetY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = 'red';
    context.fill();
    context.strokeStyle = 'black';
    context.lineWidth = 1;
    context.stroke();
    context.closePath();
}

// Function to check if the last point is close to the first point
function isCloseToFirstPoint(firstPoint, lastPoint) {
    const distance = calculatePixelDistance(firstPoint, lastPoint);
    return distance < CLOSE_DISTANCE / scale; // Adjust for current scale
}

// Function to colorize the enclosed area of a polyline
function colorizeEnclosedArea(context, points, color) {
    context.beginPath();
    context.moveTo(points[0].x * scale + deltaX + pdfOffsetX, points[0].y * scale + deltaY + pdfOffsetY);
    for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i].x * scale + deltaX + pdfOffsetX, points[i].y * scale + deltaY + pdfOffsetY);
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
    const deltaX = (end.x - start.x) * scaleFactor;
    const deltaY = (end.y - start.y) * scaleFactor;
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
    if (allPolylines.length === 0) {
        alert("No polylines to remove.");
        return;
    }

    // Remove the last polyline
    allPolylines.pop();
    // Remove the corresponding room tag
    roomTags.pop();

    // Remove the topmost (most recently added) polyline info from the sidebar
    if (polylineInfoContainer.firstChild) {
        polylineInfoContainer.removeChild(polylineInfoContainer.firstChild);
    }

    // Redraw the canvas (PDF, grid, remaining polylines/tags)
    drawPDFOnCanvas();

}

// Function to clear the PDF
function clearPDF() {
    pdfDoc = null;
    pdfImage = null;
    pageNum = 1;
    scale = 1;
    scaleFactor = null;
    pdfOffsetX = 0;
    pdfOffsetY = 0;
    deltaX = 0;
    deltaY = 0;

    polylineInfoContainer.innerHTML = '';

    // Clear and redraw the canvas grid (no PDF)
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(context, gridUnitSize);
    pdfUploadInput.value = '';

}

// Function to display polyline information with real-world distances and area
function displayPolylineInfo(points, roomType = "N/A", apartmentIndex = "N/A") {
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

    // Display room type and apartment index
    const roomInfo = document.createElement('p');
    roomInfo.textContent = `Room Type: ${roomType}, Apartment: ${apartmentIndex}`;
    roomInfo.style.fontWeight = 'bold';
    roomInfo.style.marginTop = '10px';
    polylineDiv.appendChild(roomInfo);

    // Ensure scaleFactor is set
    if (!scaleFactor) {
        scaleFactor = 1;
    }

    // Calculate per-segment real-world distances (including the closing segment)
    const segmentDistances = [];
    for (let i = 0; i < points.length - 1; i++) {
        const distance = calculateRealDistance(points[i], points[i + 1]);
        segmentDistances.push(distance);
    }

    // Calculate area using Shoelace Formula
    const area = calculatePolygonArea(points.map(point => ({ x: point.x * scaleFactor, y: point.y * scaleFactor })));

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
pdfUploadInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
        const fileName = file.name;
        currentPdfFileBaseName = fileName.replace(/\.[^/.]+$/, "");
        const fileReader = new FileReader();
        fileReader.onload = function (e) {
            const typedArray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedArray).promise.then(function (pdfDoc_) {
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
            }).catch(function (error) {
                console.error("Error loading PDF:", error);
                alert("Failed to load PDF. Please ensure the file is a valid PDF.");
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

// Variables for dragging the PDF image
let pdfOffsetX = 0,
    pdfOffsetY = 0; // To track the current position of the PDF image

// Function to render the PDF on the canvas
function renderPDF() {
    pdfDoc.getPage(pageNum).then(function (page) {
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

        page.render({ canvasContext: tempContext, viewport: scaledViewport }).promise.then(function () {


            // Negative value darkens lines; e.g. -20 or -30
            adjustBrightness(tempContext, tempCanvas.width, tempCanvas.height, -30);

            // 3) Adjust contrast (optional)
            // e.g. 50 or 60 for a strong contrast
            adjustContrast(tempContext, tempCanvas.width, tempCanvas.height, 60);


            pdfImage = new Image();
            pdfImage.src = tempCanvas.toDataURL();
            pdfImage.onload = function () {
                drawPDFOnCanvas();
            };
        });
    }).catch(function (error) {
        console.error("Error rendering PDF page:", error);
        alert("Failed to render PDF page.");
    });
}

// Function to draw the PDF image on the main canvas along with the grid and polylines
function drawPDFOnCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw the PDF image if it exists
    if (pdfImage) {
        context.drawImage(pdfImage, pdfOffsetX + deltaX, pdfOffsetY + deltaY, pdfImage.width * scale, pdfImage.height * scale);
    }

    // Redraw the grid
    drawGrid(context, gridUnitSize);

    // Draw the origin marker
    drawOriginMarker();

    // Redraw all confirmed polylines and their points
    allPolylines.forEach(polyline => {
        // Draw the polyline as a filled area
        colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);

        // Draw red circles for each point in the polyline
        polyline.points.forEach(point => {
            drawCircle(context, point, 5); // Draw the red circle
        });
    });

    // Redraw the current polyline being drawn, if any
    if (currentPolyline.length > 0) {
        currentPolyline.forEach(point => {
            drawCircle(context, point, 5); // Draw red circle for current polyline points
        });
        // Draw lines between points in the current polyline
        for (let i = 1; i < currentPolyline.length; i++) {
            drawLine(context, currentPolyline[i - 1], currentPolyline[i]);
        }
    }
    // Draw tags
    drawTags();
}

// Function to draw the origin marker
function drawOriginMarker() {
    const originX = 0 * scale + deltaX + pdfOffsetX;
    const originY = 0 * scale + deltaY + pdfOffsetY;

    context.beginPath();
    context.arc(originX, originY, 5, 0, 2 * Math.PI, false);
    context.fillStyle = 'blue';
    context.fill();
    context.strokeStyle = 'blue';
    context.lineWidth = 2;
    context.stroke();
    context.closePath();

    // Optional crosshairs
    context.beginPath();
    context.moveTo(originX - 10, originY);
    context.lineTo(originX + 10, originY);
    context.moveTo(originX, originY - 10);
    context.lineTo(originX, originY + 10);
    context.strokeStyle = 'blue';
    context.lineWidth = 2;
    context.stroke();
    context.closePath();
}

// Add event listeners for mouse/touch dragging
canvas.addEventListener('mousedown', function (e) {
    if (!pdfImage || isDrawing) return; // Prevent dragging if in drawing mode or if the PDF is not loaded
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener('mousemove', function (e) {
    if (!pdfImage) return; // Ensure PDF is loaded

    if (dragging && !isDrawing) {
        // Handle dragging logic
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
    } else if (isDrawing) {
        // If in drawing mode, check for snapping to the closest point
        const point = getMousePosition(canvas, e);

        // Find the closest point in any polyline
        const closestPoint = findClosestPoint(point);

        // Redraw everything (PDF and grid) to clear any previous visual feedback
        drawPDFOnCanvas();

        // If we have a nearby point, provide visual feedback (e.g., highlight the point)
        if (closestPoint) {
            drawCircle(context, closestPoint, 7); // Draw a larger circle for feedback
        }

        // If there are points in the current polyline, check if Shift is held to constrain the line
        if (currentPolyline.length > 0) {
            const lastPoint = currentPolyline[currentPolyline.length - 1];

            // Check if the Shift key is pressed
            if (e.shiftKey) {
                const dx = Math.abs(point.x - lastPoint.x);
                const dy = Math.abs(point.y - lastPoint.y);

                // Constrain to horizontal or vertical depending on the greater distance
                if (dx > dy) {
                    point.y = lastPoint.y; // Horizontal line
                } else {
                    point.x = lastPoint.x; // Vertical line
                }
            }
            drawLine(context, lastPoint, point);
        }
    }
});

canvas.addEventListener('mouseup', function () {
    dragging = false; // Stop dragging when mouse is released
});

canvas.addEventListener('mouseleave', function () {
    dragging = false; // Stop dragging if mouse leaves the canvas
});

// Handle touch events for dragging on mobile devices
canvas.addEventListener('touchstart', function (e) {
    if (!pdfImage || isDrawing) return; // Prevent dragging if in drawing mode
    const touch = e.touches[0];
    dragging = true;
    startX = touch.clientX;
    startY = touch.clientY;
});

canvas.addEventListener('touchmove', function (e) {
    if (!dragging || !pdfImage || isDrawing) return; // Prevent dragging if in drawing mode
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

canvas.addEventListener('touchend', function () {
    dragging = false; // Stop dragging on touch end
});

canvas.addEventListener('touchcancel', function () {
    dragging = false; // Stop dragging if touch is canceled
});

// Zoom functionality using mouse wheel
canvas.addEventListener('wheel', function (e) {
    if (isDrawing || !pdfImage) return; // Prevent zooming if in drawing mode
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
            context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        } else {
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
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
            context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        } else {
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        }
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }
}

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
            displayPolylineInfo(polyline.points, polyline.roomType, "N/A");
        });
        alert("Polylines loaded successfully.");
    } else {
        alert("No saved polylines found.");
    }
}

// // // Event listener for "Export JSON" button
// exportJsonButton.addEventListener('click', (event) => {
//     event.preventDefault(); // Prevent any default behavior

//     // Check if there are polylines to export
//     if (allPolylines.length === 0) {
//         alert("No polylines to export.");
//         return;
//     }
//     if (scaleFactor === null) {
//         alert("Scale factor is not set. Please draw the first segment and set the scale factor before exporting.");
//         return;
//     }

//     // Create the panels JSON structure
//     const panels = {
//         "attributes": {},
//         "items": {},
//         "max_key": 0
//     };
//     let segmentKey = 0;

//     allPolylines.forEach(polyline => {
//         const points = polyline.points;
//         const roomType = polyline.roomType;

//         const roomTag = roomTags.find(tag => {
//             const centroid = calculateCentroid(polyline.points);
//             return tag.roomType === roomType &&
//                    tag.position.x === centroid.x &&
//                    tag.position.y === centroid.y;
//         });

//         const apartmentIndex = roomTag ? roomTag.apartment : "N/A";

//         for (let i = 0; i < points.length - 1; i++) {
//             const startPoint = points[i];
//             const endPoint = points[i + 1];

//             const realStartX = startPoint.x * scaleFactor;
//             const realStartY = startPoint.y * scaleFactor;
//             const realEndX = endPoint.x * scaleFactor;
//             const realEndY = endPoint.y * scaleFactor;

//             const panel = {
//                 "panel_type": "WAL_21_CNI_REN",
//                 "start_point": [
//                     parseFloat(realStartX.toFixed(2)),
//                     parseFloat(realStartY.toFixed(2)),
//                     0.0
//                 ],
//                 "end_point": [
//                     parseFloat(realEndX.toFixed(2)),
//                     parseFloat(realEndY.toFixed(2)),
//                     0.0
//                 ],
//                 "height": storyHeight,
//                 "thickness": 0.2,
//                 "room": roomType,
//                 "apartment": apartmentIndex
//             };

//             panels.items[segmentKey] = panel;
//             segmentKey++;
//         }
//     });

//     panels.max_key = segmentKey;

//     const jsonData = {
//         "panels": panels
//     };

//     const jsonString = JSON.stringify(jsonData, null, 4);

//     const blob = new Blob([jsonString], { type: "application/json" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = "panels.json";
//     document.body.appendChild(a);
//     a.click();

//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);

//     console.log("JSON exported successfully.");
//     // Do NOT call drawPDFOnCanvas() or clear allPolylines here
// });


exportJsonButton.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent any default behavior

    // Check if there are polylines to export
    if (allPolylines.length === 0) {
        alert("No polylines to export.");
        return;
    }
    if (scaleFactor === null) {
        alert("Scale factor is not set. Please draw the first segment and set the scale factor before exporting.");
        return;
    }

    // Create the panels and rooms JSON structures
    const panels = {
        "attributes": {},
        "items": {},
        "max_key": 0
    };
    const rooms = {}; // Initialize the rooms object
    let segmentKey = 0;
    let roomId = 0;

    allPolylines.forEach(polyline => {
        const points = polyline.points;
        const roomType = polyline.roomType;

        // Find the associated room tag
        const roomTag = roomTags.find(tag => {
            const centroid = calculateCentroid(polyline.points);
            return tag.roomType === roomType &&
                   tag.position.x === centroid.x &&
                   tag.position.y === centroid.y;
        });

        const apartmentIndex = roomTag ? roomTag.apartment : "N/A";

        // Create a unique identifier for the room (room type + apartment association)
        const roomKey = roomId;
        const roomPoints = points.map(point => ({
            x: parseFloat((point.x * scaleFactor).toFixed(2)),
            y: parseFloat((point.y * scaleFactor).toFixed(2)),
            z: 0.0 // Assume all rooms are on the same plane
        }));

        // Add the room to the rooms object
        rooms[roomKey] = {
            "room_type": roomType,
            "apartment": apartmentIndex,
            "coordinates": roomPoints
        };

        // Add panels for each segment of the polyline
        for (let i = 0; i < points.length - 1; i++) {
            const startPoint = points[i];
            const endPoint = points[i + 1];

            const realStartX = startPoint.x * scaleFactor;
            const realStartY = startPoint.y * scaleFactor;
            const realEndX = endPoint.x * scaleFactor;
            const realEndY = endPoint.y * scaleFactor;

            const panel = {
                "panel_type": "WAL_21_CNI_REN",
                "start_point": [
                    parseFloat(realStartX.toFixed(2)),
                    parseFloat(realStartY.toFixed(2)),
                    0.0
                ],
                "end_point": [
                    parseFloat(realEndX.toFixed(2)),
                    parseFloat(realEndY.toFixed(2)),
                    0.0
                ],
                "height": storyHeight,
                "thickness": 0.2,
                "room": roomType,
                "apartment": apartmentIndex
            };

            panels.items[segmentKey] = panel;
            segmentKey++;
        }

        roomId++; // Increment the room ID for unique identification
    });

    panels.max_key = segmentKey;

    const jsonData = {
        "panels": panels,
        "rooms": rooms
    };

    const jsonString = JSON.stringify(jsonData, null, 4);

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPdfFileBaseName}_bom.json`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("JSON with rooms exported successfully.");
});

