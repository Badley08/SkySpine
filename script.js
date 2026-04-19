// -------------------------------------------------------
// SkySpine - Moteur de jeu complet
// Je gere tout le jeu ici : assets, physique, obstacles,
// meteo, collisions, scores et navigation entre ecrans.
// Pas de framework, pas de dependances, pas d'emoji.
// Commentaires ecrits a la premiere personne.
// -------------------------------------------------------

(function () {
  'use strict';

  // =======================================================
  // 1. INDEXEDDB - Je gere la persistance des scores
  // =======================================================

  const DB_NAME = 'SkySpineDB';
  const DB_VERSION = 1;
  const STORE_SCORES = 'scores';
  const STORE_SETTINGS = 'settings';

  // J'ouvre la base de donnees et je cree les stores si necessaire
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SCORES)) {
          const store = db.createObjectStore(STORE_SCORES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('distance', 'distance', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Je sauvegarde un score dans IndexedDB
  async function saveScore(name, distance) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCORES, 'readwrite');
      tx.objectStore(STORE_SCORES).add({
        name: name,
        distance: Math.floor(distance),
        date: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Je recupere les meilleurs scores tries par distance decroissante
  async function getTopScores(limit = 10) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCORES, 'readonly');
      const store = tx.objectStore(STORE_SCORES);
      const request = store.getAll();
      request.onsuccess = () => {
        const scores = request.result
          .sort((a, b) => b.distance - a.distance)
          .slice(0, limit);
        resolve(scores);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Je calcule le rang d'un score donne
  async function getRank(distance) {
    const scores = await getTopScores(100);
    const rank = scores.filter((s) => s.distance > distance).length + 1;
    return rank;
  }

  // Je supprime tous les scores
  async function clearAllScores() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCORES, 'readwrite');
      tx.objectStore(STORE_SCORES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Je sauvegarde un parametre
  async function saveSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Je recupere un parametre
  async function getSetting(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const request = tx.objectStore(STORE_SETTINGS).get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  // =======================================================
  // 2. GESTIONNAIRE D'ASSETS - Je pre-charge toutes les images
  // =======================================================

  const ASSET_LIST = {
    biplane: 'assets/biplane.png',
    avion_bleu: 'assets/avion_bleu.png',
    explosion: 'assets/explosion_2d.png',
    logo: 'assets/skypine.png',
    bg_plage: 'assets/backgrounds/background_plage.png',
    bg_village: 'assets/backgrounds/village.png',
    ennemi_avion: 'assets/ennemis/avion_rouge.png',
    ennemi_nuage: 'assets/ennemis/nuage_eclair.png',
    oiseau_1: 'assets/ennemis/oiseau_1_gauche.png',
    oiseau_2: 'assets/ennemis/oiseau_2_gauche.png'
  };

  const assets = {};

  // Je charge une image et je la retourne
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Impossible de charger: ' + src));
      img.src = src;
    });
  }

  // Je charge tous les assets et je mets a jour la barre de progression
  async function loadAllAssets() {
    const keys = Object.keys(ASSET_LIST);
    const total = keys.length;
    let loaded = 0;

    const barEl = document.getElementById('loading-bar');
    const percentEl = document.getElementById('loading-percent');

    for (const key of keys) {
      assets[key] = await loadImage(ASSET_LIST[key]);
      loaded++;
      const pct = Math.round((loaded / total) * 100);
      barEl.style.width = pct + '%';
      percentEl.textContent = pct + '%';
    }
  }

  // =======================================================
  // 3. NAVIGATION - Je gere les transitions entre ecrans
  // =======================================================

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // =======================================================
  // 4. CONFIGURATION DU JEU
  // =======================================================

  // Je definis les constantes du jeu ici pour pouvoir les ajuster facilement
  const CONFIG = {
    GRAVITY: 0.35,
    THRUST: -6,
    MAX_FALL_SPEED: 8,
    PLANE_WIDTH: 70,
    PLANE_HEIGHT: 45,
    PLANE_X: 80,
    SCROLL_SPEED_BASE: 3,
    SCROLL_SPEED_INCREMENT: 0.15,
    MAX_SCROLL_SPEED: 8,

    // Je definis les durees des phases meteo en secondes
    WEATHER_CLEAR_DURATION: 120,
    WEATHER_CLOUDY_DURATION: 120,

    // Je definis les intervalles d'apparition des obstacles (en frames)
    OBSTACLE_INTERVAL_CLEAR: 90,
    OBSTACLE_INTERVAL_CLOUDY: 65,
    OBSTACLE_INTERVAL_STORM: 50,

    // Eclairs
    LIGHTNING_INTERVAL: 80,
    LIGHTNING_SPEED: 5,

    SCORE_PER_FRAME: 0.5
  };

  // =======================================================
  // 5. GAME STATE - Je maintiens l'etat du jeu
  // =======================================================

  let canvas, ctx;
  let gameRunning = false;
  let gameStarted = false;
  let animFrameId = null;

  let selectedPlane = 'biplane';
  let pilotName = 'Pilote';

  const state = {
    planeY: 0,
    planeVelocity: 0,
    pressing: false,
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
    explosionTimer: 0,
    frameCount: 0
  };

  // =======================================================
  // 6. INITIALISATION DU CANVAS
  // =======================================================

  // Je redimensionne le canvas pour qu'il remplisse l'ecran
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // =======================================================
  // 7. CONTROLES - J'ecoute les entrees utilisateur
  // =======================================================

  function onPressStart(e) {
    if (e) e.preventDefault();

    if (!gameStarted) {
      // Je demarre le jeu au premier appui
      gameStarted = true;
      document.getElementById('pause-hint').classList.add('hidden');
    }

    state.pressing = true;
  }

  function onPressEnd(e) {
    if (e) e.preventDefault();
    state.pressing = false;
  }

  function setupControls() {
    // J'ecoute les touches clavier pour le PC
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && gameRunning) {
        e.preventDefault();
        onPressStart();
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        onPressEnd();
      }
    });

    // J'ecoute les evenements tactiles pour le mobile
    canvas.addEventListener('touchstart', onPressStart, { passive: false });
    canvas.addEventListener('touchend', onPressEnd, { passive: false });
    canvas.addEventListener('touchcancel', onPressEnd, { passive: false });

    // J'ecoute aussi le clic souris pour le PC
    canvas.addEventListener('mousedown', onPressStart);
    canvas.addEventListener('mouseup', onPressEnd);
  }

  // =======================================================
  // 8. SYSTEME METEO - Je gere les transitions progressives
  // =======================================================

  // Je determine la phase meteo en fonction du temps ecoule
  function updateWeather() {
    const seconds = state.elapsedTime / 60; // Je convertis les frames en secondes (60fps)

    if (seconds < CONFIG.WEATHER_CLEAR_DURATION) {
      state.weather = 'clear';
    } else if (seconds < CONFIG.WEATHER_CLEAR_DURATION + CONFIG.WEATHER_CLOUDY_DURATION) {
      state.weather = 'cloudy';
    } else {
      state.weather = 'storm';
    }

    // Je mets a jour le HUD meteo
    const weatherEl = document.getElementById('hud-weather');
    const labels = { clear: 'Clair', cloudy: 'Nuageux', storm: 'Orage' };
    weatherEl.textContent = labels[state.weather];
  }

  // =======================================================
  // 9. GENERATEUR D'OBSTACLES
  // =======================================================

  // Je cree un obstacle selon la phase meteo actuelle
  function spawnObstacle() {
    const h = canvas.height;
    const w = canvas.width;

    if (state.weather === 'clear') {
      // Je genere des oiseaux normaux en phase claire
      const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
      state.obstacles.push({
        type: 'bird',
        asset: birdType,
        x: w + 50,
        y: 40 + Math.random() * (h - 120),
        width: 50,
        height: 40,
        speed: state.scrollSpeed + 0.5 + Math.random() * 1.5,
        // Je rends certains oiseaux plongeurs pour varier le gameplay
        diving: false,
        divingSpeed: 0
      });
    } else if (state.weather === 'cloudy') {
      // Je melange oiseaux en formation et avions ennemis en phase nuageuse
      const roll = Math.random();

      if (roll < 0.4) {
        // Je genere un avion ennemi rouge
        state.obstacles.push({
          type: 'plane',
          asset: 'ennemi_avion',
          x: w + 50,
          y: 30 + Math.random() * (h - 100),
          width: 60,
          height: 40,
          speed: state.scrollSpeed + 1.5 + Math.random()
        });
      } else if (roll < 0.7) {
        // Je genere une formation de 2-3 oiseaux
        const baseY = 60 + Math.random() * (h - 200);
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
          state.obstacles.push({
            type: 'bird',
            asset: birdType,
            x: w + 50 + i * 45,
            y: baseY + i * 30,
            width: 45,
            height: 35,
            speed: state.scrollSpeed + 0.8 + Math.random(),
            diving: false,
            divingSpeed: 0
          });
        }
      } else {
        // Je genere un oiseau plongeur (descend en diagonale)
        const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
        state.obstacles.push({
          type: 'bird',
          asset: birdType,
          x: w + 50,
          y: 30 + Math.random() * (h * 0.3),
          width: 50,
          height: 40,
          speed: state.scrollSpeed + 1,
          diving: true,
          divingSpeed: 1 + Math.random() * 1.5
        });
      }
    } else {
      // En phase d'orage, je genere des nuages eclairs et des oiseaux
      const roll = Math.random();

      if (roll < 0.5) {
        // Je genere un nuage eclair
        state.obstacles.push({
          type: 'cloud',
          asset: 'ennemi_nuage',
          x: w + 80,
          y: 20 + Math.random() * (h * 0.4),
          width: 70,
          height: 55,
          speed: state.scrollSpeed + 0.5
        });
      } else {
        // Je genere un oiseau rapide
        const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
        state.obstacles.push({
          type: 'bird',
          asset: birdType,
          x: w + 50,
          y: 40 + Math.random() * (h - 120),
          width: 50,
          height: 40,
          speed: state.scrollSpeed + 2 + Math.random() * 2,
          diving: Math.random() > 0.6,
          divingSpeed: 1.5 + Math.random() * 2
        });
      }
    }
  }

  // =======================================================
  // 10. GENERATEUR D'ECLAIRS (phase d'orage)
  // =======================================================

  // Je genere un eclair diagonal ou vertical pendant l'orage
  function spawnLightning() {
    if (state.weather !== 'storm') return;

    const w = canvas.width;
    const h = canvas.height;
    const startX = w * 0.3 + Math.random() * w * 0.6;
    const diagonal = Math.random() > 0.4;

    // Je dessine l'eclair segment par segment pour un effet naturel
    const segments = [];
    let x = startX;
    let y = 0;
    const segCount = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < segCount; i++) {
      const nextX = diagonal
        ? x + (Math.random() - 0.3) * 60
        : x + (Math.random() - 0.5) * 40;
      const nextY = y + (h / segCount) + Math.random() * 20;
      segments.push({ x1: x, y1: y, x2: nextX, y2: nextY });
      x = nextX;
      y = nextY;
    }

    state.lightnings.push({
      segments: segments,
      alpha: 1,
      decay: 0.02 + Math.random() * 0.02
    });

    // Je declenche un flash blanc sur le fond
    state.bgFlashAlpha = 0.3;
  }

  // =======================================================
  // 11. DETECTION DE COLLISION
  // =======================================================

  // Je verifie si deux rectangles se chevauchent
  function checkCollision(ax, ay, aw, ah, bx, by, bw, bh) {
    // Je reduis les boites de collision de 20% pour plus d'indulgence
    const shrink = 0.2;
    const asx = ax + aw * shrink;
    const asy = ay + ah * shrink;
    const asw = aw * (1 - 2 * shrink);
    const ash = ah * (1 - 2 * shrink);

    const bsx = bx + bw * shrink;
    const bsy = by + bh * shrink;
    const bsw = bw * (1 - 2 * shrink);
    const bsh = bh * (1 - 2 * shrink);

    return asx < bsx + bsw && asx + asw > bsx && asy < bsy + bsh && asy + ash > bsy;
  }

  // Je verifie si l'avion est touche par un eclair
  function checkLightningCollision() {
    const px = CONFIG.PLANE_X;
    const py = state.planeY;
    const pw = CONFIG.PLANE_WIDTH;
    const ph = CONFIG.PLANE_HEIGHT;

    for (const lightning of state.lightnings) {
      for (const seg of lightning.segments) {
        // Je verifie si un segment de l'eclair traverse la zone de l'avion
        if (lineIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, px, py, pw, ph)) {
          return true;
        }
      }
    }
    return false;
  }

  // Je verifie si un segment de droite intersecte un rectangle
  function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Je reduis la zone pour etre indulgent
    const s = 0.25;
    rx += rw * s;
    ry += rh * s;
    rw *= (1 - 2 * s);
    rh *= (1 - 2 * s);

    // Je verifie les 4 cotes du rectangle
    return (
      lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
      lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
      lineIntersectsLine(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh) ||
      lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx, ry + rh)
    );
  }

  // Je calcule l'intersection de deux segments de droite
  function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // =======================================================
  // 12. BOUCLE DE JEU PRINCIPALE
  // =======================================================

  function gameLoop() {
    if (!gameRunning) return;
    animFrameId = requestAnimationFrame(gameLoop);

    // Je ne mets a jour la physique que si le joueur a commence
    if (!gameStarted) {
      drawScene();
      return;
    }

    state.frameCount++;
    state.elapsedTime++;

    // Je mets a jour la meteo
    updateWeather();

    // J'augmente progressivement la vitesse de defilement
    if (state.scrollSpeed < CONFIG.MAX_SCROLL_SPEED) {
      state.scrollSpeed += CONFIG.SCROLL_SPEED_INCREMENT / 60;
    }

    // --- Physique de l'avion ---
    // J'applique la gravite en permanence
    if (state.pressing) {
      state.planeVelocity += CONFIG.THRUST * 0.15;
    }
    state.planeVelocity += CONFIG.GRAVITY;

    // Je limite la vitesse de chute
    if (state.planeVelocity > CONFIG.MAX_FALL_SPEED) {
      state.planeVelocity = CONFIG.MAX_FALL_SPEED;
    }
    if (state.planeVelocity < -CONFIG.MAX_FALL_SPEED) {
      state.planeVelocity = -CONFIG.MAX_FALL_SPEED;
    }

    state.planeY += state.planeVelocity;

    // Je bloque l'avion dans les limites de l'ecran
    if (state.planeY < 0) {
      state.planeY = 0;
      state.planeVelocity = 0;
    }
    if (state.planeY > canvas.height - CONFIG.PLANE_HEIGHT) {
      state.planeY = canvas.height - CONFIG.PLANE_HEIGHT;
      state.planeVelocity = 0;
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
      spawnObstacle();
      state.obstacleTimer = 0;
    }

    // --- Eclairs en phase d'orage ---
    if (state.weather === 'storm') {
      state.lightningTimer++;
      if (state.lightningTimer >= CONFIG.LIGHTNING_INTERVAL) {
        spawnLightning();
        state.lightningTimer = 0;
      }
    }

    // --- Mise a jour des obstacles ---
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obs = state.obstacles[i];
      obs.x -= obs.speed;

      // Je fais plonger les oiseaux qui doivent plonger
      if (obs.diving) {
        obs.y += obs.divingSpeed;
      }

      // Je supprime les obstacles sortis de l'ecran
      if (obs.x + obs.width < -50) {
        state.obstacles.splice(i, 1);
        continue;
      }

      // Je verifie la collision avec l'avion
      if (checkCollision(
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

    // Je verifie les collisions avec les eclairs
    if (state.lightnings.length > 0 && checkLightningCollision()) {
      triggerGameOver();
      return;
    }

    // Je reduis le flash de l'ecran
    if (state.bgFlashAlpha > 0) {
      state.bgFlashAlpha -= 0.015;
      if (state.bgFlashAlpha < 0) state.bgFlashAlpha = 0;
    }

    // --- Rendu ---
    drawScene();
  }

  // =======================================================
  // 13. RENDU GRAPHIQUE
  // =======================================================

  function drawScene() {
    const w = canvas.width;
    const h = canvas.height;

    // --- Je dessine le fond selon la phase meteo ---
    drawBackground(w, h);

    // --- Je dessine les obstacles ---
    for (const obs of state.obstacles) {
      const img = assets[obs.asset];
      if (img) {
        ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
      }
    }

    // --- Je dessine les eclairs ---
    for (const lightning of state.lightnings) {
      ctx.save();
      ctx.globalAlpha = lightning.alpha;
      ctx.strokeStyle = '#ffe566';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      for (const seg of lightning.segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();

      // Je dessine une deuxieme couche plus fine et blanche pour le coeur de l'eclair
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (const seg of lightning.segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // --- Je dessine le flash blanc de l'orage ---
    if (state.bgFlashAlpha > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + state.bgFlashAlpha + ')';
      ctx.fillRect(0, 0, w, h);
    }

    // --- Je dessine l'avion ---
    const planeImg = assets[selectedPlane];
    if (planeImg) {
      ctx.save();
      // J'incline legerement l'avion selon la vitesse verticale
      const tilt = state.planeVelocity * 2;
      const cx = CONFIG.PLANE_X + CONFIG.PLANE_WIDTH / 2;
      const cy = state.planeY + CONFIG.PLANE_HEIGHT / 2;
      ctx.translate(cx, cy);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.drawImage(
        planeImg,
        -CONFIG.PLANE_WIDTH / 2,
        -CONFIG.PLANE_HEIGHT / 2,
        CONFIG.PLANE_WIDTH,
        CONFIG.PLANE_HEIGHT
      );
      ctx.restore();
    }

    // --- Je dessine l'explosion si elle est active ---
    if (state.explosionActive) {
      const expSize = 80;
      ctx.drawImage(
        assets.explosion,
        state.explosionX - expSize / 2,
        state.explosionY - expSize / 2,
        expSize,
        expSize
      );
    }
  }

  // Je dessine le fond du jeu avec parallax et effet meteo
  function drawBackground(w, h) {
    let bgImg;

    if (state.weather === 'clear') {
      bgImg = assets.bg_plage;
    } else {
      bgImg = assets.bg_village;
    }

    if (!bgImg) {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // Je calcule le defilement parallax du fond
    const bgW = (bgImg.width / bgImg.height) * h;
    const offset = state.scrollOffset % bgW;

    // Je dessine deux copies du fond pour un defilement continu
    ctx.drawImage(bgImg, -offset, 0, bgW, h);
    ctx.drawImage(bgImg, -offset + bgW, 0, bgW, h);

    if (offset > 0) {
      ctx.drawImage(bgImg, -offset + bgW * 2, 0, bgW, h);
    }

    // J'assombris le ciel en phase orageuse
    if (state.weather === 'storm') {
      ctx.fillStyle = 'rgba(10, 10, 30, 0.5)';
      ctx.fillRect(0, 0, w, h);
    } else if (state.weather === 'cloudy') {
      ctx.fillStyle = 'rgba(30, 30, 50, 0.2)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // =======================================================
  // 14. GAME OVER
  // =======================================================

  // Je declanche la fin de partie
  async function triggerGameOver() {
    gameRunning = false;
    gameStarted = false;

    // Je montre l'explosion a la position de l'avion
    state.explosionActive = true;
    state.explosionX = CONFIG.PLANE_X + CONFIG.PLANE_WIDTH / 2;
    state.explosionY = state.planeY + CONFIG.PLANE_HEIGHT / 2;

    // Je dessine la scene finale avec l'explosion
    drawScene();

    // J'attends un moment pour laisser le joueur voir l'explosion
    await new Promise((r) => setTimeout(r, 800));

    state.explosionActive = false;

    const distance = Math.floor(state.score);

    // Je sauvegarde le score dans IndexedDB
    await saveScore(pilotName, distance);

    // Je recupere le rang
    const rank = await getRank(distance);

    // J'affiche l'ecran de fin
    document.getElementById('gameover-distance').textContent = distance + ' m';
    document.getElementById('gameover-pilot').textContent = pilotName;
    document.getElementById('gameover-rank').textContent = '#' + rank;

    showScreen('screen-gameover');
  }

  // =======================================================
  // 15. DEMARRAGE D'UNE PARTIE
  // =======================================================

  // Je remets tout a zero pour une nouvelle partie
  function startGame() {
    state.planeY = canvas.height / 2 - CONFIG.PLANE_HEIGHT / 2;
    state.planeVelocity = 0;
    state.pressing = false;
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
    state.frameCount = 0;

    document.getElementById('hud-score').textContent = '0 m';
    document.getElementById('hud-weather').textContent = 'Clair';
    document.getElementById('pause-hint').classList.remove('hidden');

    gameRunning = true;
    gameStarted = false;

    showScreen('screen-game');

    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
  }

  // =======================================================
  // 16. CLASSEMENT - Je remplis la liste du leaderboard
  // =======================================================

  async function renderLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    const scores = await getTopScores(10);

    if (scores.length === 0) {
      listEl.innerHTML = '<p class="leaderboard-empty">Aucun score enregistre</p>';
      return;
    }

    listEl.innerHTML = scores
      .map((s, i) => {
        return (
          '<div class="lb-entry">' +
          '<div class="lb-rank">' + (i + 1) + '</div>' +
          '<div class="lb-name">' + escapeHTML(s.name) + '</div>' +
          '<div class="lb-score">' + s.distance + ' m</div>' +
          '</div>'
        );
      })
      .join('');
  }

  // Je protege contre les injections HTML
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =======================================================
  // 17. WIRE UP - Je connecte les boutons et les ecrans
  // =======================================================

  async function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Je charge les controles
    setupControls();

    // Je charge tous les assets et j'affiche la progression
    try {
      await loadAllAssets();
    } catch (err) {
      console.error('Erreur lors du chargement des assets:', err);
    }

    // Je recupere le nom du pilote et l'avion sauvegarde
    const savedPilot = await getSetting('pilotName');
    if (savedPilot) {
      document.getElementById('pilot-name').value = savedPilot;
      pilotName = savedPilot;
    }

    const savedPlane = await getSetting('selectedPlane');
    if (savedPlane) {
      selectedPlane = savedPlane;
      document.querySelectorAll('.plane-option').forEach((el) => {
        el.classList.toggle('selected', el.dataset.plane === selectedPlane);
      });
    }

    // J'attends un court delai pour que l'ecran de chargement soit visible
    await new Promise((r) => setTimeout(r, 500));

    // Je passe au menu principal
    showScreen('screen-menu');

    // --- Bouton Jouer ---
    document.getElementById('btn-play').addEventListener('click', () => {
      const nameInput = document.getElementById('pilot-name').value.trim();
      if (nameInput) {
        pilotName = nameInput;
        saveSetting('pilotName', pilotName);
      } else {
        pilotName = 'Pilote';
      }
      startGame();
    });

    // --- Bouton Classement ---
    document.getElementById('btn-leaderboard').addEventListener('click', async () => {
      await renderLeaderboard();
      showScreen('screen-leaderboard');
    });

    // --- Bouton Retour du classement ---
    document.getElementById('btn-leaderboard-back').addEventListener('click', () => {
      showScreen('screen-menu');
    });

    // --- Bouton Parametres ---
    document.getElementById('btn-settings').addEventListener('click', () => {
      showScreen('screen-settings');
    });

    // --- Bouton Retour des parametres ---
    document.getElementById('btn-settings-back').addEventListener('click', () => {
      showScreen('screen-menu');
    });

    // --- Selection de l'avion ---
    document.querySelectorAll('.plane-option').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.plane-option').forEach((e) => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedPlane = el.dataset.plane;
        saveSetting('selectedPlane', selectedPlane);
      });
    });

    // --- Bouton Effacer les scores ---
    document.getElementById('btn-clear-scores').addEventListener('click', async () => {
      await clearAllScores();
      // Je donne un feedback visuel
      const btn = document.getElementById('btn-clear-scores');
      btn.textContent = 'Scores effaces';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = 'Effacer les scores';
        btn.disabled = false;
      }, 1500);
    });

    // --- Bouton Rejouer ---
    document.getElementById('btn-retry').addEventListener('click', () => {
      startGame();
    });

    // --- Bouton Menu (depuis game over) ---
    document.getElementById('btn-back-menu').addEventListener('click', () => {
      showScreen('screen-menu');
    });
  }

  // =======================================================
  // 18. SERVICE WORKER - J'enregistre le SW pour le hors ligne
  // =======================================================

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker non enregistre:', err);
    });
  }

  // =======================================================
  // LANCEMENT
  // =======================================================

  // Je lance l'initialisation quand le DOM est pret
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
