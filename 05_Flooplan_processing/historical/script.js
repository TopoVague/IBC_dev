const canvas = document.getElementById('drawingCanvas');
const context = canvas.getContext('2d');
const polylineInfoContainer = document.getElementById('polylineInfoContainer');
const roomTypeSelect = document.getElementById('roomType');
const pdfUploadInput = document.getElementById('pdfUpload');

// Initialize variables
let allPolylines = [];
let currentPolyline = [];
let isClosed = false;
let pdfDoc = null;
let pageNum = 1;
let pdfImage = null;
let pdfX = 0, pdfY = 0, dragging = false, moving = false;
let scale = 1;
let scaleFactor = null;  

let startX, startY;
let deltaX = 0, deltaY = 0;

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

roomTypeSelect.addEventListener('change', function(e) {
    selectedRoomType = e.target.value;
});

canvas.addEventListener('click', (e) => {
    if (moving || dragging || !pdfImage) return;

    const point = getMousePosition(canvas, e);
    currentPolyline.push(point);

    drawCircle(context, point, 5);  

    if (currentPolyline.length > 1) {
        drawLine(context, currentPolyline[currentPolyline.length - 2], currentPolyline[currentPolyline.length - 1]);

        if (scaleFactor === null) {
            const pixelDistance = calculatePixelDistance(currentPolyline[currentPolyline.length - 2], currentPolyline[currentPolyline.length - 1]);
            const realDistance = prompt("Enter the real-world distance for this line segment (e.g., meters):");
            if (realDistance && !isNaN(realDistance)) {
                scaleFactor = parseFloat(realDistance) / pixelDistance;
                alert(`Scale factor set: 1 pixel = ${scaleFactor} real-world meters.`);
            }
        } else if (currentPolyline.length === 3) {
            const pixelDistance = calculatePixelDistance(currentPolyline[currentPolyline.length - 2], currentPolyline[currentPolyline.length - 1]);
            const realDistance = pixelDistance * scaleFactor;

            const userConfirmed = confirm(`The calculated real distance for this segment is ${realDistance} meters. Is this correct?`);
            if (!userConfirmed) {
                const newRealDistance = prompt("Enter the correct real-world distance for this second line segment:");
                if (newRealDistance && !isNaN(newRealDistance)) {
                    scaleFactor = parseFloat(newRealDistance) / pixelDistance;
                    alert(`Scale factor updated: 1 pixel = ${scaleFactor} real-world meters.`);
                }
            }
        }
    }

    if (currentPolyline.length > 2 && isCloseToFirstPoint(currentPolyline[0], currentPolyline[currentPolyline.length - 1])) {
        drawLine(context, currentPolyline[currentPolyline.length - 1], currentPolyline[0]);
        colorizeEnclosedArea(context, currentPolyline, roomColors[selectedRoomType]);
        isClosed = true;
        allPolylines.push({ points: [...currentPolyline], roomType: selectedRoomType });
        displayPolylineInfo(currentPolyline);
        currentPolyline = [];
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
    return distance < 10;
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
}

// Function to calculate pixel distance between two points
function calculatePixelDistance(start, end) {
    return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
}

// Function to calculate real-world distance for a polyline segment
function calculateRealDistance(start, end) {
    const pixelDistance = calculatePixelDistance(start, end);
    return scaleFactor ? pixelDistance * scaleFactor : pixelDistance;
}

// Function to finish the current polyline
function finishPolyline() {
    if (currentPolyline.length > 1) {
        let totalDistance = 0;
        for (let i = 0; i < currentPolyline.length - 1; i++) {
            const realDistance = calculateRealDistance(currentPolyline[i], currentPolyline[i + 1]);
            totalDistance += realDistance;
            console.log(`Segment ${i + 1} real distance: ${realDistance} meters`);
        }
        console.log(`Total real distance: ${totalDistance} meters`);
        displayPolylineInfo(currentPolyline);
        currentPolyline = [];
        isClosed = false;
    }
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
}

// Function to clear the PDF
function clearPDF() {
    pdfImage = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    allPolylines.forEach(polyline => {
        colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);
    });
}

// Function to display polyline information with real-world distances
function displayPolylineInfo(points) {
    const polylineDiv = document.createElement('div');
    polylineDiv.classList.add('polyline-info');

    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = 200;
    miniCanvas.height = 150;
    const miniContext = miniCanvas.getContext('2d');
    miniContext.clearRect(0, 0, miniCanvas.width, miniCanvas.height);

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

    const distanceList = document.createElement('ul');
    distanceList.style.listStyleType = 'none';
    distanceList.style.padding = '0';
    distanceList.style.marginTop = '10px';

    let totalRealDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const pixelDistance = calculatePixelDistance(start, end);
        let realDistance = 'N/A';

        if (scaleFactor !== null) {
            realDistance = (pixelDistance * scaleFactor).toFixed(2) + ' meters';
            totalRealDistance += parseFloat(realDistance);
        }

        const listItem = document.createElement('li');
        listItem.textContent = `Segment ${i + 1}: ${realDistance}`;
        distanceList.appendChild(listItem);
    }

    if (isClosed && points.length > 2) {
        const start = points[points.length - 1];
        const end = points[0];
        const pixelDistance = calculatePixelDistance(start, end);
        let realDistance = 'N/A';

        if (scaleFactor !== null) {
            realDistance = (pixelDistance * scaleFactor).toFixed(2) + ' meters';
            totalRealDistance += parseFloat(realDistance);
        }

        const listItem = document.createElement('li');
        listItem.textContent = `Segment ${points.length}: ${realDistance}`;
        distanceList.appendChild(listItem);
    }

    if (scaleFactor !== null) {
        const totalDistanceItem = document.createElement('li');
        totalDistanceItem.style.marginTop = '10px';
        totalDistanceItem.style.fontWeight = 'bold';
        totalDistanceItem.textContent = `Total Real Distance: ${totalRealDistance.toFixed(2)} meters`;
        distanceList.appendChild(totalDistanceItem);
    }

    polylineDiv.appendChild(distanceList);
    polylineInfoContainer.appendChild(polylineDiv);
}


pdfUploadInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const fileReader = new FileReader();
        fileReader.onload = function(e) {
            const typedArray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedArray).promise.then(function(pdfDoc_) {
                pdfDoc = pdfDoc_;
                renderPDF();
            }).catch(function(error) {
                console.error("Error loading PDF:", error);
                alert("Failed to load PDF. Please ensure the file is a valid PDF.");
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

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
    allPolylines.forEach(polyline => {
        colorizeEnclosedArea(context, polyline.points, roomColors[polyline.roomType]);
    });
}

canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1 && pdfImage) {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        e.preventDefault();
    }
});

canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1 && pdfImage) {
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
    startX = null;
    startY = null;
});

// Zoom functionality using mouse wheel
canvas.addEventListener('wheel', function(e) {
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
