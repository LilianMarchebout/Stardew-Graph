// src/trajectoire.js

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const exportBtn = document.getElementById('exportBtn');
const distPxEl = document.getElementById('distPx');
const modeEl = document.getElementById('mode');

// CONSTANTE POUR LE CHEMIN DE L'IMAGE
const MAP_PATH = 'public/map.png';

let img = new Image();
let zoom = 1;
let imgLoaded = false;
let points = [];
let draggingIndex = -1;

let panX = 0;
let panY = 0;
let panning = false;
let panStart = { x: 0, y: 0 }; 
let initialPan = { x: 0, y: 0 }; 

let lowResImage = new Image();
let useLowRes = false;
const LOW_RES_FACTOR = 0.25; 
let zoomRedrawTimeout = null; 

const ZOOM_INCREMENT = 0.1; 
const PAN_SPEED_FACTOR = 4;

const TEXT_BASE_SIZE = 30*5; 
const TEXT_STROKE_BASE_WIDTH = 20;

// Couleur de pixel à ignorer (#121543)
const IGNORE_COLOR = { r: 18, g: 21, b: 67 }; 
const IGNORE_TOLERANCE = 5; 

img.crossOrigin = "anonymous"; 

let rawDataCanvas = null;
let rawDataCtx = null;

function setupRawDataCanvas() {
    if (!rawDataCanvas) {
        rawDataCanvas = document.createElement('canvas');
        rawDataCtx = rawDataCanvas.getContext('2d');
    }
    rawDataCanvas.width = img.width;
    rawDataCanvas.height = img.height;
    
    try {
        rawDataCtx.drawImage(img, 0, 0); 
    } catch (e) {
        console.error("CORS issue prevents drawing image data to off-screen canvas. Color exclusion may fail.");
        rawDataCanvas = null;
        rawDataCtx = null;
    }
}

function loadMapImage() {
    img.onload = () => {
        imgLoaded = true;
        canvas.width = img.width;
        canvas.height = img.height;
        panX = 0; panY = 0; 
        zoom = 1; 
        
        createLowResImage(img);
        setupRawDataCanvas();
        
        draw();
    };
    img.onerror = () => {
        console.error(`Erreur de chargement de l'image ${MAP_PATH}. Vérifiez le chemin.`);
        draw();
    };
    img.src = MAP_PATH;
}

function createLowResImage(originalImg) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImg.width * LOW_RES_FACTOR;
    tempCanvas.height = originalImg.height * LOW_RES_FACTOR;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(originalImg, 0, 0, tempCanvas.width, tempCanvas.height);
    
    lowResImage.src = tempCanvas.toDataURL();
}

function distance(a, b){
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 🆕 NOUVEAU : Vérifie si un point se trouve en dehors des limites de l'image.
 */
function isOutsideImageBounds(p) {
    if (!imgLoaded) return true; // Si pas d'image, considérons que c'est hors-contexte.
    
    // On vérifie si x ou y est en dehors des bornes [0, width] ou [0, height]
    return p.x < 0 || p.x > img.width || p.y < 0 || p.y > img.height;
}

function getPixelDataFromRawCoordinates(x, y) {
    if (!rawDataCtx) return null; 
    
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= rawDataCanvas.width || y < 0 || y >= rawDataCanvas.height) return null;

    try {
        return rawDataCtx.getImageData(x, y, 1, 1).data;
    } catch (e) {
        console.warn("Erreur de lecture de pixel (probablement CORS après coup).");
        return null;
    }
}

function colorMatch(r, g, b) {
  return (
    Math.abs(r - IGNORE_COLOR.r) <= IGNORE_TOLERANCE &&
    Math.abs(g - IGNORE_COLOR.g) <= IGNORE_TOLERANCE &&
    Math.abs(b - IGNORE_COLOR.b) <= IGNORE_TOLERANCE
  );
}

/**
 * MODIFIÉ : Vérifie si un segment doit être ignoré.
 * Un segment est ignoré si une extrémité est hors limite OU touche la couleur d'ignorance.
 */
function isColorIgnored(p1, p2) {
  // 1. NOUVEAU : Vérification des bornes
  if (isOutsideImageBounds(p1) || isOutsideImageBounds(p2)) {
      return true;
  }
  
  // 2. Vérification de la couleur (seulement si dans les bornes)
  if (!imgLoaded || !rawDataCtx) return false;

  // Vérification du point 1 (couleur)
  const data1 = getPixelDataFromRawCoordinates(p1.x, p1.y);
  if (data1 && colorMatch(data1[0], data1[1], data1[2])) {
      return true;
  }

  // Vérification du point 2 (couleur)
  const data2 = getPixelDataFromRawCoordinates(p2.x, p2.y);
  if (data2 && colorMatch(data2[0], data2[1], data2[2])) {
      return true;
  }
  
  return false;
}

function calculateTotalDistance() {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];

    if (!isColorIgnored(p1, p2)) {
      total += distance(p1, p2);
    }
  }
  return total;
}


function draw() {
  canvas.style.transform = ''; 
  canvas.style.transition = 'none';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  let imageToDraw = img;
  
  if (useLowRes && lowResImage.src) {
      imageToDraw = lowResImage;
      ctx.scale(1 / LOW_RES_FACTOR, 1 / LOW_RES_FACTOR);
  }

  if (imgLoaded) ctx.drawImage(imageToDraw, 0, 0);

  if (points.length > 0) {
    ctx.lineWidth = 8 / zoom; 
    
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        // La couleur de la ligne dépend de la fonction isColorIgnored
        if (isColorIgnored(p1, p2)) {
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)'; 
            ctx.setLineDash([10 / zoom, 10 / zoom]);
        } else {
            ctx.strokeStyle = 'rgba(255,0,0,0.9)'; 
            ctx.setLineDash([]);
        }
        ctx.stroke();
    }
  }
  
  ctx.setLineDash([]); 
  
  if (points.length >= 2) {
    const totalDistance = calculateTotalDistance();
    
    const lastIndex = points.length - 1;
    const p1 = points[lastIndex - 1];
    const p2 = points[lastIndex];
    
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    
    const textSize = TEXT_BASE_SIZE / zoom;
    const strokeWidth = TEXT_STROKE_BASE_WIDTH / zoom;

    ctx.fillStyle = 'red';
    ctx.font = `bold ${textSize}px sans-serif`; 
    ctx.textAlign = 'center';
    
    const text = `Total: ${totalDistance.toFixed(2)} px`;

    ctx.strokeStyle = 'black'; 
    ctx.lineWidth = strokeWidth; 
    ctx.strokeText(text, midX, midY - textSize); 
    
    ctx.fillText(text, midX, midY - textSize); 
  }

  for (let i = 0; i < points.length; i++) {
    drawPoint(points[i], i === draggingIndex);
  }

  ctx.restore();
  updateDistances();
}

function drawPoint(p, active = false, color = 'red'){
  const radius = 15 / zoom;
  const lineWidth = 4 / zoom;
  ctx.beginPath();
  ctx.fillStyle = active ? 'yellow' : 'white';
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function getMousePosInCanvasBuffer(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX_display = e.clientX - rect.left;
    const mouseY_display = e.clientY - rect.top;

    const mouseX_buffer = mouseX_display * (canvas.width / rect.width);
    const mouseY_buffer = mouseY_display * (canvas.height / rect.height);
    return { x: mouseX_buffer, y: mouseY_buffer }; 
}

function getCanvasCoordinates(e){
  const mBuffer = getMousePosInCanvasBuffer(e);
  const x = (mBuffer.x - panX) / zoom;
  const y = (mBuffer.y - panY) / zoom;
  return { x: x, y: y };
}

canvas.addEventListener('mousedown', e => {
  e.preventDefault();

  if (e.button === 2) { 
      points.pop();
      draw();
      return;
  }
  
  if (e.button === 1) { 
    panning = true;
    panStart = { x: e.clientX, y: e.clientY }; 
    initialPan = { x: panX, y: panY }; 
    
    canvas.style.cursor = 'all-scroll';
    
    if (!useLowRes) {
        useLowRes = true;
        draw(); 
    }

    return;
  }

  const m = getCanvasCoordinates(e);

  for (let i = 0; i < points.length; i++){
    if (distance(points[i], m) * zoom < 20){
      draggingIndex = i;
      canvas.style.cursor = 'grabbing';
      return;
    }
  }

  points.push(m);
  draw();
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    
    const mousePos = getMousePosInCanvasBuffer(e);
    const oldZoom = zoom;
    
    const deltaFactor = e.deltaY > 0 ? (1 - ZOOM_INCREMENT) : (1 + ZOOM_INCREMENT); 
    zoom *= deltaFactor;

    zoom = Math.max(0.05, Math.min(20, zoom)); 
    
    if (oldZoom === zoom) return;

    const fixedPointX = (mousePos.x - panX) / oldZoom;
    const fixedPointY = (mousePos.y - panY) / oldZoom;

    panX = mousePos.x - (fixedPointX * zoom);
    panY = mousePos.y - (fixedPointY * zoom);
    
    useLowRes = true;
    
    draw(); 

    clearTimeout(zoomRedrawTimeout);
    zoomRedrawTimeout = setTimeout(() => {
        useLowRes = false;
        draw(); 
    }, 100); 
});

canvas.addEventListener('mousemove', e => {
  if (panning) {
    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;
    
    panX = initialPan.x + deltaX * PAN_SPEED_FACTOR;
    panY = initialPan.y + deltaY * PAN_SPEED_FACTOR;
    
    draw(); 
    return;
  }

  if (draggingIndex !== -1){
    const m = getCanvasCoordinates(e);
    points[draggingIndex] = m;
    draw(); 
  }

  const m = getCanvasCoordinates(e);
  let foundPoint = false;
  for (let i = 0; i < points.length; i++){
    if (distance(points[i], m) * zoom < 20){ 
      canvas.style.cursor = 'grab';
      foundPoint = true;
      break;
    }
  }
  if (!foundPoint && draggingIndex === -1 && !panning) {
      canvas.style.cursor = 'default';
  }
});

window.addEventListener('mouseup', e => {
  if (panning) {
    panning = false;
    
    if (useLowRes) {
        useLowRes = false;
        draw(); 
    }
  }
  
  if (draggingIndex !== -1){ 
    draggingIndex = -1; 
    if (!panning) { 
        draw(); 
    }
  }
  
  canvas.style.cursor = 'default';
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

undoBtn.addEventListener('click', () => { points.pop(); draw(); });

clearBtn.addEventListener('click', () => {
  points = [];
  modeEl.textContent = 'Placer points';
  panX = 0; panY = 0; zoom = 1; 
  draw();
});

function updateDistances(){
  const total = calculateTotalDistance();
  distPxEl.textContent = total.toFixed(2);
}

exportBtn.addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = imgLoaded ? img.width : canvas.width;
  out.height = imgLoaded ? img.height : canvas.height;
  const octx = out.getContext('2d');
  if (imgLoaded) octx.drawImage(img, 0, 0, out.width, out.height);

  const totalDistance = calculateTotalDistance();

  if (points.length > 0){
    octx.lineWidth = 8; octx.strokeStyle = 'red'; 
    octx.beginPath(); 
    octx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) octx.lineTo(points[i].x, points[i].y);
    octx.stroke();

    for (let i = 0; i < points.length; i++){
      octx.beginPath(); octx.fillStyle = 'white'; octx.strokeStyle = 'red'; octx.lineWidth = 4;
      octx.arc(points[i].x, points[i].y, 15, 0, Math.PI * 2);
      octx.fill(); octx.stroke();
    }
    
    if (points.length >= 2) {
        const lastIndex = points.length - 1;
        const p1 = points[lastIndex - 1];
        const p2 = points[lastIndex];
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const textSize = TEXT_BASE_SIZE;
        const strokeWidth = TEXT_STROKE_BASE_WIDTH;

        octx.fillStyle = 'red';
        octx.font = `bold ${textSize}px sans-serif`; 
        octx.textAlign = 'center';
        
        const text = `Total: ${totalDistance.toFixed(2)} px`;
        
        octx.strokeStyle = 'black'; 
        octx.lineWidth = strokeWidth; 
        octx.strokeText(text, midX, midY - textSize);
        octx.fillText(text, midX, midY - textSize); 
    }
  }
  
  octx.fillStyle = 'black'; octx.font = '16px sans-serif';
  octx.fillText('Distance (info): '+ totalDistance.toFixed(2) + ' px', 10, 20);


  const url = out.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = 'trajectory.png'; a.click();
});

// Lancer le chargement de l'image au démarrage
loadMapImage();