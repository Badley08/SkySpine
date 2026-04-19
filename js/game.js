// -------------------------------------------------------
// SkySpine - Moteur de jeu
// Je gere la boucle de jeu, la physique et le state.
// -------------------------------------------------------

import { assets } from './assets.js';
import { isPressing, setFirstPressCallback, resetControls } from './controls.js';
import { getWeatherPhase, getWeatherLabel } from './weather.js';
import { spawnObstacle, spawnLightning } from './obstacles.js';
import { rectsCollide, checkGroundCollision, checkLightningHit } from './collision.js';
import { drawBackground, drawGroundLine, drawObstacles, drawLightnings, drawFlash, drawPlane, drawExplosion } from './renderer.js';
import { saveScore, getRank } from './db.js';

// -- Configuration du jeu --
// Je definis les constantes ici pour les ajuster facilement
const CONFIG = {
  GRAVITY: 0.35,
  THRUST: -0.9,
  MAX_FALL_SPEED: 8,
  PLANE_WIDTH: 110,
  PLANE_HEIGHT: 70,
  PLANE_X: 90,
  SCROLL_SPEED_BASE: 3,
  SCROLL_SPEED_INCREMENT: 0.15,
  MAX_SCROLL_SPEED: 8,

  // Je place le sol a 78% de la hauteur de l'ecran (sable/arbres en dessous)
  GROUND_LEVEL_PERCENT: 0.78,

  OBSTACLE_INTERVAL_CLEAR: 90,
  OBSTACLE_INTERVAL_CLOUDY: 65,
  OBSTACLE_INTERVAL_STORM: 50,

  LIGHTNING_INTERVAL: 80,
  SCORE_PER_FRAME: 0.5
};

// -- Game state --
let canvas = null;
let ctx = null;
let gameRunning = false;
let gameStarted = false;
let animFrameId = null;
let selectedPlane = 'biplane';
let pilotName = 'Pilote';
let onGameOverCallback = null;

const state = {
  planeY: 0,
  planeVelocity: 0,
  scrollOffset: 0,
  scrollSpeed: CONFIG.SCROLL_SPEED_BASE,
  score: 0,
  elapsedTime: 0,
  weather: 'clear',
  obstacles: [],
  lightnings: [],
  obstacleTimer: 0,
  lightningTimer: 0,
  bgFlashAlpha: 0,
  explosionActive: false,
  explosionX: 0,
  explosionY: 0,
  groundY: 0
};

// -- Initialisation --
export function initGame(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

export function setSelectedPlane(planeName) {
  selectedPlane = planeName;
}

export function setPilotName(name) {
  pilotName = name;
}

export function setGameOverCallback(cb) {
  onGameOverCallback = cb;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Je recalcule le sol a chaque redimensionnement
  state.groundY = Math.floor(canvas.height * CONFIG.GROUND_LEVEL_PERCENT);
}

// -- Demarrage d'une partie --
export function startGame() {
  // Je remets tout a zero
  state.planeY = canvas.height * 0.35;
  state.planeVelocity = 0;
  state.scrollOffset = 0;
  state.scrollSpeed = CONFIG.SCROLL_SPEED_BASE;
  state.score = 0;
  state.elapsedTime = 0;
  state.weather = 'clear';
  state.obstacles = [];
  state.lightnings = [];
  state.obstacleTimer = 0;
  state.lightningTimer = 0;
  state.bgFlashAlpha = 0;
  state.explosionActive = false;
  state.groundY = Math.floor(canvas.height * CONFIG.GROUND_LEVEL_PERCENT);

  resetControls();

  document.getElementById('hud-score').textContent = '0 m';
  document.getElementById('hud-weather').textContent = 'Clair';
  document.getElementById('pause-hint').classList.remove('hidden');

  gameRunning = true;
  gameStarted = false;

  // J'attends le premier appui pour demarrer
  setFirstPressCallback(() => {
    gameStarted = true;
    document.getElementById('pause-hint').classList.add('hidden');
  });

  if (animFrameId) cancelAnimationFrame(animFrameId);
  gameLoop();
}

// -- Boucle de jeu --
function gameLoop() {
  if (!gameRunning) return;
  animFrameId = requestAnimationFrame(gameLoop);

  // Je ne mets a jour la physique que si le joueur a commence
  if (!gameStarted) {
    render();
    return;
  }

  state.elapsedTime++;

  // Je mets a jour la meteo
  state.weather = getWeatherPhase(state.elapsedTime);
  document.getElementById('hud-weather').textContent = getWeatherLabel(state.weather);

  // J'augmente progressivement la vitesse
  if (state.scrollSpeed < CONFIG.MAX_SCROLL_SPEED) {
    state.scrollSpeed += CONFIG.SCROLL_SPEED_INCREMENT / 60;
  }

  // --- Physique de l'avion ---
  if (isPressing()) {
    state.planeVelocity += CONFIG.THRUST;
  }
  state.planeVelocity += CONFIG.GRAVITY;

  // Je limite la vitesse maximale
  if (state.planeVelocity > CONFIG.MAX_FALL_SPEED) state.planeVelocity = CONFIG.MAX_FALL_SPEED;
  if (state.planeVelocity < -CONFIG.MAX_FALL_SPEED) state.planeVelocity = -CONFIG.MAX_FALL_SPEED;

  state.planeY += state.planeVelocity;

  // Je bloque l'avion au plafond
  if (state.planeY < 0) {
    state.planeY = 0;
    state.planeVelocity = 0;
  }

  // --- COLLISION SOL ---
  // Je verifie si l'avion touche le sol (sable, arbres) = game over
  if (checkGroundCollision(state.planeY, CONFIG.PLANE_HEIGHT, state.groundY)) {
    triggerGameOver();
    return;
  }

  // --- Defilement du decor ---
  state.scrollOffset += state.scrollSpeed;

  // --- Score ---
  state.score += CONFIG.SCORE_PER_FRAME;
  document.getElementById('hud-score').textContent = Math.floor(state.score) + ' m';

  // --- Generation d'obstacles ---
  state.obstacleTimer++;
  let interval = CONFIG.OBSTACLE_INTERVAL_CLEAR;
  if (state.weather === 'cloudy') interval = CONFIG.OBSTACLE_INTERVAL_CLOUDY;
  if (state.weather === 'storm') interval = CONFIG.OBSTACLE_INTERVAL_STORM;

  if (state.obstacleTimer >= interval) {
    const newObs = spawnObstacle(state.weather, canvas.width, canvas.height, state.groundY, state.scrollSpeed);
    state.obstacles.push(...newObs);
    state.obstacleTimer = 0;
  }

  // --- Eclairs ---
  if (state.weather === 'storm') {
    state.lightningTimer++;
    if (state.lightningTimer >= CONFIG.LIGHTNING_INTERVAL) {
      state.lightnings.push(spawnLightning(canvas.width, canvas.height));
      state.bgFlashAlpha = 0.3;
      state.lightningTimer = 0;
    }
  }

  // --- Mise a jour des obstacles ---
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const obs = state.obstacles[i];
    obs.x -= obs.speed;

    if (obs.diving) {
      obs.y += obs.divingSpeed;
    }

    // Je supprime les obstacles hors ecran
    if (obs.x + obs.width < -50) {
      state.obstacles.splice(i, 1);
      continue;
    }

    // Je verifie la collision avec l'avion
    if (rectsCollide(
      CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT,
      obs.x, obs.y, obs.width, obs.height
    )) {
      triggerGameOver();
      return;
    }
  }

  // --- Mise a jour des eclairs ---
  for (let i = state.lightnings.length - 1; i >= 0; i--) {
    state.lightnings[i].alpha -= state.lightnings[i].decay;
    if (state.lightnings[i].alpha <= 0) {
      state.lightnings.splice(i, 1);
    }
  }

  // Je verifie si un eclair touche l'avion
  if (state.lightnings.length > 0 && checkLightningHit(
    state.lightnings, CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT
  )) {
    triggerGameOver();
    return;
  }

  // Je reduis le flash
  if (state.bgFlashAlpha > 0) {
    state.bgFlashAlpha -= 0.015;
    if (state.bgFlashAlpha < 0) state.bgFlashAlpha = 0;
  }

  render();
}

// -- Rendu --
function render() {
  const w = canvas.width;
  const h = canvas.height;

  drawBackground(ctx, w, h, state.weather, state.scrollOffset);
  drawGroundLine(ctx, w, state.groundY);
  drawObstacles(ctx, state.obstacles);
  drawLightnings(ctx, state.lightnings);
  drawFlash(ctx, w, h, state.bgFlashAlpha);
  drawPlane(ctx, assets[selectedPlane], CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT, state.planeVelocity);

  if (state.explosionActive) {
    drawExplosion(ctx, state.explosionX, state.explosionY);
  }
}

// -- Game Over --
async function triggerGameOver() {
  gameRunning = false;
  gameStarted = false;

  // Je montre l'explosion
  state.explosionActive = true;
  state.explosionX = CONFIG.PLANE_X + CONFIG.PLANE_WIDTH / 2;
  state.explosionY = state.planeY + CONFIG.PLANE_HEIGHT / 2;
  render();

  await new Promise((r) => setTimeout(r, 800));
  state.explosionActive = false;

  const distance = Math.floor(state.score);

  // Je sauvegarde le score
  await saveScore(pilotName, distance);
  const rank = await getRank(distance);

  // Je notifie l'ecran de game over
  if (onGameOverCallback) {
    onGameOverCallback(distance, pilotName, rank);
  }
}
