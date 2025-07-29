const FRAME_TIME = 33;  // ms

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');

let startTime = null;
let frameTimer = null;
let frameCount = 0;

let drawWidth, drawHeight;
let offsetX, offsetY;

let keys = {
  A: false,
  D: false,
  W: false,
  S: false,
  Backspace: false,
  ArrowLeft: false,
  ArrowRight: false,
};

let bgImage;
const fingerprintImages = [];
const fingerprintHighlightedImages = [];
const rowsImages = [];
const rowsHighlightedImages = [];
let selectorImage;
let miniPrintBorderImage;
let miniPrintBorderHighlightedImage;
const successImages = [];
const digitImages = [];
let colonImage;
let keysImage;

const MAX_FINGERPRINTS = 8;
const MAX_ROWS = 8;
const MAX_DIFFICULTY = 4;
const fingerprintX = 1230;  // 0.75 * 1080 + 420
const fingerprintY = 648;  // 0.6 * 1080
const rowsYs = [386, 462, 538, 614, 690, 766, 842, 918];
const rowsX = 626;  // 616.56;
const miniPrintsXs = [1037, 1173, 1309, 1445];  // [1047.48, 1183.56, 1319.64, 1455.72];
const miniPrintsY = 196;
const miniPrintScale = 128/648;
const digitX = 515;  // 563.1
const digitY = 155;  // 155.52
const digitSep = 33;  // 33.48

const SUCCESS_COOLDOWN = 1500;  // ms
const SUCCESS_CYCLE = 500;  // ms

let difficulty = 4;
let fingerprintCol = 0;
let selectedRow = 0;
let shuffledRows = [];
let fingerprints = [];
let solved = false;
let levelStartTime;
let solvingTime = 0;
let cooldown = 0;


function formatTimeInterval(date1, date2 = 0) {
  let diffMs = Math.abs(date2 - date1);

  let totalSeconds = Math.floor(diffMs / 1000);
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;
  let centiseconds = Math.floor((diffMs % 1000) / 10);

  const pad = (num) => String(num).padStart(2, '0');

  return `${pad(minutes)}:${pad(seconds)}:${pad(centiseconds)}`;
}


function getTintedImage(img, tintColor = "#29C252") {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = img.width;
  offCanvas.height = img.height;
  const offCtx = offCanvas.getContext("2d");

  offCtx.drawImage(img, 0, 0);
  const imageData = offCtx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  const tempCtx = document.createElement("canvas").getContext("2d");
  tempCtx.fillStyle = tintColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const [rTint, gTint, bTint] = tempCtx.getImageData(0, 0, 1, 1).data;

  // Apply tint based on brightness
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];

    const brightness = (r + g + b) / 3 / 255;

    data[i]     = rTint * brightness;
    data[i + 1] = gTint * brightness;
    data[i + 2] = bTint * brightness;
    data[i + 3] = alpha; // Preserve original alpha
  }

  offCtx.putImageData(imageData, 0, 0);
  return offCanvas;
}


async function loadAssets() {
  // Load background image
  bgImage = await loadImage('sprites/fingerprint_hacking_minigame_background.png');

  const loadPromises = [];
  for (let i = 0; i < MAX_FINGERPRINTS; i++) {
    const fingerprintPromise = loadImage(`sprites/printfull/fingerprint_hacking_minigame_fingerprints_0${i+1}.png`).then(img => {
      fingerprintHighlightedImages[i] = img;
    });
    loadPromises.push(fingerprintPromise);
    rowsHighlightedImages[i] = [];
    for (let r = 0; r < MAX_ROWS; r++) {
      const rowPromise = loadImage(`sprites/printfull/fingerprint_hacking_minigame_fingerprints_0${i+1}_slice_0${r+1}.png`).then(img => {
        rowsHighlightedImages[i][r] = img;
      });
      loadPromises.push(rowPromise); 
    }
  }
  for (let i = 0; i < 10; i++) {
    const digitPromise = loadImage(`sprites/fingerprint_hacking_minigame_numbers_0${i}.png`).then(img => {
      digitImages[i] = img;
    });
    loadPromises.push(digitPromise);
  }
  colonImage = await loadImage('sprites/fingerprint_hacking_minigame_numbers_colon.png');
  
  selectorImage = await loadImage('sprites/selectorframe.png');
  miniPrintBorderHighlightedImage = await loadImage('sprites/decyphered_selector.png');
  
  successImages[0] = await loadImage('sprites/fingerprint_hacking_minigame_messages_correct_00.png');
  successImages[1] = await loadImage('sprites/fingerprint_hacking_minigame_messages_correct_01.png');
  
  keysImage = await loadImage('keys.svg');

  await Promise.all(loadPromises);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function shuffleRows() {
  solved = false;
  selectedRow = 0;
  shuffledRows = [];
  for (let i = 0; i < MAX_ROWS; i++)
    shuffledRows.push(i);
  for (let i = 0; i < MAX_ROWS; i++) {
    let randRow = i + Math.floor(Math.random() * (MAX_ROWS - i));
    let temp = shuffledRows[i]
    shuffledRows[i] = shuffledRows[randRow];
    shuffledRows[randRow] = temp;
  }
  const nRandRows = [4, 5, 6, 8];
  for (let i = nRandRows[fingerprintCol]; i < MAX_ROWS; i++)
    shuffledRows[i] = i;
  
  let isOrdered = true;
  for (let i = 0; i < MAX_ROWS; i++)
    if (shuffledRows[i] != i)
      isOrdered = false;
  if (isOrdered)
    shuffledRows[0] = 1;
}

function switchRow(xSign, ySign) {
  if (solved)
    return;
  if (xSign == 0) {
    selectedRow = (MAX_ROWS + selectedRow + ySign) % MAX_ROWS;
  }
  else {
    shuffledRows[selectedRow] = (MAX_ROWS + shuffledRows[selectedRow] + xSign) % MAX_ROWS;
  }
}

function updateLevel(nFrames) {
  if (solved) {
    cooldown -= nFrames * FRAME_TIME;
    if (cooldown <= 0) {
      cooldown = 0;
      fingerprintCol += 1;
      if (fingerprintCol == difficulty)
        loadLevel();
      else
        shuffleRows();
    }
  }
  else {
    solvingTime = performance.now() - levelStartTime - fingerprintCol * SUCCESS_COOLDOWN;
    let tempSolved = true;
    for (let i = 0; i < MAX_ROWS; i++)
      if (shuffledRows[i] != i)
        tempSolved = false;
    if (tempSolved) {
      solved = true;
      cooldown = SUCCESS_COOLDOWN;
    }
  }
}

function loadLevel() {
  fingerprintCol = 0;
  fingerprints = [];
  for (let i = 0; i < difficulty; i++)
    fingerprints[i] = Math.floor(Math.random() * MAX_FINGERPRINTS);
  levelStartTime = performance.now();
  shuffleRows();
}

function drawKeysMenu() {
  const scale = canvas.width / 1657;
  const aspectRatio = 1.152;
  const size = 145 * scale;
  ctx.drawImage(keysImage, offsetX + 5*scale, offsetY + 5*scale, size*aspectRatio, size);
}

function drawCentered(img, cx, cy, scale = 1.0) {
  let ratioX = drawWidth / bgImage.width;
  let ratioY = drawHeight / bgImage.height;
  let newCx = cx * ratioX;
  let newCy = cy * ratioY;
  let imgWidth = img.width * ratioX * scale;
  let imgHeight = img.height * ratioY * scale;
  ctx.drawImage(img, offsetX + newCx - imgWidth/2, offsetY + newCy - imgHeight/2, imgWidth, imgHeight);
}

function drawLevel() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const canvasRatio = canvas.width / canvas.height;
  const imageRatio = bgImage.width / bgImage.height;

  if (imageRatio > canvasRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imageRatio;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imageRatio;
  }

  offsetX = (canvas.width - drawWidth) / 2;
  offsetY = (canvas.height - drawHeight) / 2;

  ctx.drawImage(bgImage, offsetX, offsetY, drawWidth, drawHeight);
  let n0 = fingerprints[fingerprintCol];
  drawCentered(fingerprintImages[n0], fingerprintX, fingerprintY);
  for (let r = 0; r < MAX_ROWS; r++) {
    if (r == selectedRow) {
      drawCentered(rowsHighlightedImages[n0][shuffledRows[r]], rowsX, rowsYs[r]);
      drawCentered(selectorImage, rowsX, rowsYs[r]);
    }
    else
      drawCentered(rowsImages[n0][shuffledRows[r]], rowsX, rowsYs[r]);
  }
  for (let col = 0; col < difficulty; col++) {
    let n = fingerprints[col];
    if (col == fingerprintCol) {
      drawCentered(fingerprintHighlightedImages[n], miniPrintsXs[col], miniPrintsY, miniPrintScale);
      drawCentered(miniPrintBorderHighlightedImage, miniPrintsXs[col], miniPrintsY);
    }
    else {
      drawCentered(fingerprintImages[n], miniPrintsXs[col], miniPrintsY, miniPrintScale);
      drawCentered(miniPrintBorderImage, miniPrintsXs[col], miniPrintsY);
    }
  }
  
  let elapsedText = formatTimeInterval(solvingTime);
  if (elapsedText.length != 8)
    elapsedText = "99:59:99";
  for (let i = 0; i < 8; i++) {
    let c = elapsedText[i];
    let img = colonImage;
    if (c != ":")
      img = digitImages[parseInt(c)];
    drawCentered(img, digitX + i*digitSep, digitY);
  }
    
  if (solved) {
    let n = Math.max(0, Math.floor((cooldown / SUCCESS_CYCLE) % 2));
    drawCentered(successImages[n], 1920/2, 1080/2);
  }
  
  drawKeysMenu();
}

function startFrameLoop() {
  function loop() {
    const elapsed = performance.now() - startTime;
    const nextFrame = Math.floor(elapsed / FRAME_TIME);
    
    if (nextFrame > frameCount) {
      updateLevel(nextFrame - frameCount);
      drawLevel();
      frameCount = nextFrame;
      
      let changeLevel = false;
      
      if (changeLevel) {
        loadLevel();
        drawLevel();
        startTime = performance.now();
        frameCount = 0;
      }
    }

    const timeToNext = FRAME_TIME - elapsed % FRAME_TIME;
    frameTimer = setTimeout(loop, timeToNext);
  }

  loadLevel();
  drawLevel();
  startTime = performance.now();
  frameCount = 0;
  loop();
}

// To stop the level
function stopFrameLoop() {
  clearTimeout(frameTimer);
}

window.addEventListener("resize", () => {
  if (canvas.style.display === "block") {
    drawLevel(); // Redraw current level on resize
  }
});

loadAssets().then(() => {
  // Tint
  bgImage = getTintedImage(bgImage);
  for (let i = 0; i < MAX_FINGERPRINTS; i++) {
    fingerprintImages[i] = getTintedImage(fingerprintHighlightedImages[i]);
    rowsImages[i] = [];
    for (let r = 0; r < MAX_ROWS; r++) {
      rowsImages[i][r] = getTintedImage(rowsHighlightedImages[i][r]);
    }
  }
  miniPrintBorderImage = getTintedImage(miniPrintBorderHighlightedImage);
  
  canvas.style.display = 'block';
  loading.style.display = "none";
  
  startFrameLoop();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyA") {
    keys.A = true;
    switchRow(-1, 0);
  }
  if (e.code === "KeyD") {
    keys.D = true;
    switchRow(1, 0);
  }
  if (e.code === "KeyW") {
    keys.W = true;
    switchRow(0, -1);
  }
  if (e.code === "KeyS") {
    keys.S = true;
    switchRow(0, 1);
  }
  if (e.code === "Backspace") {
    keys.Backspace = true;
    stopFrameLoop();
    startFrameLoop();
  }
  if (e.code === "ArrowLeft") keys.ArrowLeft = true;
  if (e.code === "ArrowRight") keys.ArrowRight = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "KeyA") keys.A = false;
  if (e.code === "KeyD") keys.D = false;
  if (e.code === "KeyW") keys.W = false;
  if (e.code === "KeyS") keys.S = false;
  if (e.code === "Backspace") keys.Backspace = false;
  if (e.code === "ArrowLeft") keys.ArrowLeft = false;
  if (e.code === "ArrowRight") keys.ArrowRight = false;
});

window.addEventListener("blur", () => {
  keys.A = false;
  keys.D = false;
  keys.W = false;
  keys.S = false;
  keys.Backspace = false;
  keys.ArrowLeft = false;
  keys.ArrowRight = false;
});
