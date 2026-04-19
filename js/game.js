// -------------------------------------------------------
// SkySpine - Moteur de jeu
// Boucle principale, physique, easter eggs, ghost, tir.
// -------------------------------------------------------

import { assets } from './assets.js';
import { isPressing, setFirstPressCallback, resetControls } from './controls.js';
import { getWeatherPhase, getWeatherLabel, updateWind, getWindStrength, getWindLabel, resetWind } from './weather.js';
import { spawnObstacle, spawnLightning } from './obstacles.js';
import { rectsCollide, checkGroundCollision, checkLightningHit } from './collision.js';
import {
    drawBackground, drawGroundLine, drawObstacles, drawLightnings, drawFlash,
    drawPlane, drawExplosion, drawMissile, drawGhost, drawBullets, drawHackerText,
    triggerScreenShake
} from './renderer.js';
import { saveScore, getRank, addCoins, getQuestProgressLocal, saveQuestProgressLocal } from './db.js';
import { saveGlobalScore, saveGlobalBestPath, getGlobalBestPath } from './firebase.js';
import { QUESTS, areAllGlitchQuestsDone } from './quests.js';
import { getPlane } from './planes.js';
import {
    playThrust, playExplosion as playSoundExplosion, playLightningStrike,
    playBirdHit, playMissile as playSoundMissile
} from './sound.js';

const CONFIG = {
    GRAVITY: 0.32,
    THRUST: -0.85,
    MAX_FALL_SPEED: 7,
    PLANE_WIDTH: 110,
    PLANE_HEIGHT: 70,
    PLANE_X: 90,
    SCROLL_SPEED_BASE: 3,
    SCROLL_SPEED_INCREMENT: 0.12,
    MAX_SCROLL_SPEED: 9,
    GROUND_LEVEL_PERCENT: 0.78,
    OBSTACLE_INTERVAL_CLEAR: 90,
    OBSTACLE_INTERVAL_CLOUDY: 65,
    OBSTACLE_INTERVAL_STORM: 50,
    LIGHTNING_INTERVAL: 80,
    SCORE_PER_FRAME: 0.5,
    HACKER_CEILING_FRAMES: 1200,
    BULLET_SPEED: 10,
    BULLET_COOLDOWN: 30,
    ENEMY_SHOOT_INTERVAL: 180
};

let canvas = null;
let ctx = null;
let gameRunning = false;
let gameStarted = false;
let gamePaused = false;
let animFrameId = null;
let selectedPlaneId = 'biplane';
let pilotName = 'Pilote';
let onGameOverCallback = null;
let glitchUsed = false;

const pathRecord = [];
let ghostData = null;

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
    bullets: [],
    obstacleTimer: 0,
    lightningTimer: 0,
    bulletCooldown: 0,
    enemyShootTimer: 0,
    bgFlashAlpha: 0,
    explosionActive: false,
    explosionX: 0,
    explosionY: 0,
    explosionProgress: 0,
    groundY: 0,
    ceilingFrames: 0,
    hackerMissile: null,
    hackerTextAlpha: 0,
    hackerTextContent: '',
    stormSurviveSeconds: 0,
    obstaclesPassedCount: 0,
    completedQuestThisRun: null,
    coinsEarned: 0
};

export function initGame(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

export function setSelectedPlane(id) { selectedPlaneId = id; }
export function setPilotName(name) { pilotName = name; }
export function setGameOverCallback(cb) { onGameOverCallback = cb; }
export function isGamePaused() { return gamePaused; }

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.groundY = Math.floor(canvas.height * CONFIG.GROUND_LEVEL_PERCENT);
}

export async function startGame() {
    glitchUsed = false;
    pathRecord.length = 0;

    state.planeY = canvas.height * 0.38;
    state.planeVelocity = 0;
    state.scrollOffset = 0;
    state.scrollSpeed = CONFIG.SCROLL_SPEED_BASE;
    state.score = 0;
    state.elapsedTime = 0;
    state.weather = 'clear';
    state.obstacles = [];
    state.lightnings = [];
    state.bullets = [];
    state.obstacleTimer = 0;
    state.lightningTimer = 0;
    state.bulletCooldown = 0;
    state.enemyShootTimer = 0;
    state.bgFlashAlpha = 0;
    state.explosionActive = false;
    state.explosionProgress = 0;
    state.groundY = Math.floor(canvas.height * CONFIG.GROUND_LEVEL_PERCENT);
    state.ceilingFrames = 0;
    state.hackerMissile = null;
    state.hackerTextAlpha = 0;
    state.stormSurviveSeconds = 0;
    state.obstaclesPassedCount = 0;
    state.completedQuestThisRun = null;
    state.coinsEarned = 0;

    resetControls();
    resetWind();

    ghostData = await getGlobalBestPath().catch(() => null);

    document.getElementById('hud-score').textContent = '0 m';
    document.getElementById('hud-weather').textContent = 'Clair';
    document.getElementById('hud-wind').textContent = '';
    document.getElementById('hud-coins').textContent = '+0 SC';
    document.getElementById('pause-hint').classList.remove('hidden');

    gameRunning = true;
    gameStarted = false;
    gamePaused = false;

    setFirstPressCallback(() => {
        gameStarted = true;
        document.getElementById('pause-hint').classList.add('hidden');
    });

    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
}

export function pauseGame() {
    gamePaused = true;
}

export function resumeGame() {
    gamePaused = false;
    if (!animFrameId) gameLoop();
}

export function stopGame() {
    gameRunning = false;
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

function gameLoop() {
    if (!gameRunning || gamePaused) {
        animFrameId = null;
        return;
    }
    animFrameId = requestAnimationFrame(gameLoop);

    if (!gameStarted) {
        render();
        return;
    }

    state.elapsedTime++;
    state.weather = getWeatherPhase(state.elapsedTime);
    document.getElementById('hud-weather').textContent = getWeatherLabel(state.weather);

    updateWind(state.elapsedTime);
    const windLabel = getWindLabel();
    document.getElementById('hud-wind').textContent = windLabel || '';

    if (state.scrollSpeed < CONFIG.MAX_SCROLL_SPEED) {
        state.scrollSpeed += CONFIG.SCROLL_SPEED_INCREMENT / 60;
    }

    const plane = getPlane(selectedPlaneId);
    const windStrength = getWindStrength();

    if (isPressing()) {
        state.planeVelocity += CONFIG.THRUST;
        playThrust();
    }
    state.planeVelocity += CONFIG.GRAVITY + windStrength;
    state.planeVelocity = Math.max(-CONFIG.MAX_FALL_SPEED, Math.min(CONFIG.MAX_FALL_SPEED, state.planeVelocity));
    state.planeY += state.planeVelocity;

    if (state.planeY < 0) {
        state.planeY = 0;
        state.planeVelocity = Math.max(0, state.planeVelocity);
        state.ceilingFrames++;
        triggerScreenShake(state.ceilingFrames > 300 ? 4 : 2);
    } else {
        state.ceilingFrames = 0;
    }

    if (state.ceilingFrames >= CONFIG.HACKER_CEILING_FRAMES && !state.hackerMissile) {
        launchHackerMissile();
    }

    if (state.hackerMissile) {
        updateHackerMissile();
    }

    if (state.hackerTextAlpha > 0) {
        state.hackerTextAlpha -= 0.008;
    }

    if (checkGroundCollision(state.planeY, CONFIG.PLANE_HEIGHT, state.groundY)) {
        triggerGameOver('Collision avec le sol');
        return;
    }

    state.scrollOffset += state.scrollSpeed;

    const scoreMultiplier = plane.scoreMultiplier || 1.0;
    state.score += CONFIG.SCORE_PER_FRAME;
    const coinsThisFrame = (CONFIG.SCORE_PER_FRAME * scoreMultiplier) / 100;
    state.coinsEarned += coinsThisFrame;

    document.getElementById('hud-score').textContent = Math.floor(state.score) + ' m';
    document.getElementById('hud-coins').textContent = '+' + Math.floor(state.coinsEarned) + ' SC';

    if (state.weather === 'storm') {
        state.stormSurviveSeconds = state.elapsedTime / 60 - 240;
    }

    state.obstacleTimer++;
    let interval = CONFIG.OBSTACLE_INTERVAL_CLEAR;
    if (state.weather === 'cloudy') interval = CONFIG.OBSTACLE_INTERVAL_CLOUDY;
    if (state.weather === 'storm') interval = CONFIG.OBSTACLE_INTERVAL_STORM;

    if (state.obstacleTimer >= interval) {
        const newObs = spawnObstacle(state.weather, canvas.width, canvas.height, state.groundY, state.scrollSpeed);
        state.obstacles.push(...newObs);
        state.obstacleTimer = 0;
    }

    if (state.weather === 'storm') {
        state.lightningTimer++;
        if (state.lightningTimer >= CONFIG.LIGHTNING_INTERVAL) {
            state.lightnings.push(spawnLightning(canvas.width, canvas.height));
            state.bgFlashAlpha = 0.35;
            state.lightningTimer = 0;
            playLightningStrike();
            triggerScreenShake(6);
        }

        state.enemyShootTimer++;
        if (state.enemyShootTimer >= CONFIG.ENEMY_SHOOT_INTERVAL) {
            spawnEnemyBullet();
            state.enemyShootTimer = 0;
        }
    }

    state.bulletCooldown--;
    if (isPressing() && state.bulletCooldown <= 0) {
        state.bullets.push({
            x: CONFIG.PLANE_X + CONFIG.PLANE_WIDTH,
            y: state.planeY + CONFIG.PLANE_HEIGHT / 2,
            dx: CONFIG.BULLET_SPEED,
            dy: 0,
            friendly: true
        });
        state.bulletCooldown = CONFIG.BULLET_COOLDOWN;
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        b.x += b.dx;
        b.y += b.dy;
        if (b.x > canvas.width + 20 || b.x < -20 || b.y < -20 || b.y > canvas.height + 20) {
            state.bullets.splice(i, 1);
            continue;
        }
        if (!b.friendly) {
            if (rectsCollide(CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT,
                b.x - 5, b.y - 5, 10, 10)) {
                triggerGameOver('Touche par un tir ennemi');
                return;
            }
        } else {
            let hit = false;
            for (let j = state.obstacles.length - 1; j >= 0; j--) {
                const obs = state.obstacles[j];
                if (obs.type === 'plane' && rectsCollide(b.x - 4, b.y - 4, 8, 8, obs.x, obs.y, obs.width, obs.height)) {
                    state.obstacles.splice(j, 1);
                    triggerScreenShake(4);
                    playBirdHit();
                    hit = true;
                    break;
                }
            }
            if (hit) { state.bullets.splice(i, 1); }
        }
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        obs.x -= obs.speed;
        if (obs.diving) obs.y += obs.divingSpeed;

        if (obs.x + obs.width < -50) {
            state.obstacles.splice(i, 1);
            state.obstaclesPassedCount++;
            continue;
        }

        if (rectsCollide(
            CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT,
            obs.x, obs.y, obs.width, obs.height
        )) {
            if (selectedPlaneId === 'the_glitch' && !glitchUsed) {
                glitchUsed = true;
                triggerScreenShake(8);
                continue;
            }
            triggerGameOver('Collision avec un obstacle');
            return;
        }
    }

    for (let i = state.lightnings.length - 1; i >= 0; i--) {
        state.lightnings[i].alpha -= state.lightnings[i].decay;
        if (state.lightnings[i].alpha <= 0) {
            state.lightnings.splice(i, 1);
        }
    }

    if (state.lightnings.length > 0 && checkLightningHit(
        state.lightnings, CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT
    )) {
        triggerGameOver('Foudroye par un eclair');
        return;
    }

    if (state.bgFlashAlpha > 0) {
        state.bgFlashAlpha -= 0.016;
        if (state.bgFlashAlpha < 0) state.bgFlashAlpha = 0;
    }

    if (state.elapsedTime % 3 === 0) {
        pathRecord.push({ x: CONFIG.PLANE_X, y: state.planeY });
    }

    render();
}

function spawnEnemyBullet() {
    const fromY = Math.random() * canvas.height * 0.7;
    const dx = -(2 + Math.random() * 2);
    const targetY = state.planeY + CONFIG.PLANE_HEIGHT / 2;
    const targetX = CONFIG.PLANE_X;
    const dist = Math.sqrt((targetX - canvas.width) ** 2 + (targetY - fromY) ** 2);
    const dy = (targetY - fromY) / dist * Math.abs(dx) * 0.8;
    state.bullets.push({
        x: canvas.width + 10,
        y: fromY,
        dx, dy,
        friendly: false
    });
}

function launchHackerMissile() {
    playSoundMissile();
    triggerScreenShake(8);
    state.hackerMissile = {
        x: canvas.width,
        y: Math.random() * canvas.height * 0.5,
        dx: -(5 + state.scrollSpeed),
        dy: 0
    };
}

function updateHackerMissile() {
    const m = state.hackerMissile;
    const targetX = CONFIG.PLANE_X + CONFIG.PLANE_WIDTH / 2;
    const targetY = state.planeY + CONFIG.PLANE_HEIGHT / 2;
    const dx = targetX - m.x;
    const dy = targetY - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
        const speed = Math.abs(m.dx);
        m.dx = (dx / dist) * speed;
        m.dy = (dy / dist) * speed;
    }
    m.x += m.dx;
    m.y += m.dy;

    if (rectsCollide(CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT,
        m.x - 15, m.y - 10, 30, 20)) {
        state.hackerMissile = null;
        triggerGameOver('HACKER');
    } else if (m.x < -50) {
        state.hackerMissile = null;
        state.ceilingFrames = 0;
    }
}

function render() {
    const w = canvas.width;
    const h = canvas.height;

    drawBackground(ctx, w, h, state.weather, state.scrollOffset);
    drawGroundLine(ctx, w, state.groundY);

    if (ghostData && ghostData.path.length > 0) {
        const ghostFrame = Math.min(Math.floor(state.elapsedTime / 3), ghostData.path.length - 1);
        const gp = ghostData.path[ghostFrame];
        if (gp) {
            drawGhost(ctx, gp.x, gp.y, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT, ghostData.name);
        }
    }

    drawObstacles(ctx, state.obstacles);
    drawLightnings(ctx, state.lightnings);
    drawBullets(ctx, state.bullets);
    drawFlash(ctx, w, h, state.bgFlashAlpha);

    const planeImg = assets[getPlane(selectedPlaneId).asset];
    drawPlane(ctx, planeImg, CONFIG.PLANE_X, state.planeY, CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT, state.planeVelocity);

    if (state.hackerMissile) {
        drawMissile(ctx, state.hackerMissile);
    }

    if (state.explosionActive) {
        drawExplosion(ctx, state.explosionX, state.explosionY, state.explosionProgress);
        state.explosionProgress = Math.min(1, state.explosionProgress + 0.04);
    }

    if (state.hackerTextAlpha > 0) {
        drawHackerText(ctx, w, h, state.hackerTextAlpha, state.hackerTextContent);
    }
}

async function triggerGameOver(cause) {
    gameRunning = false;
    gameStarted = false;

    state.explosionActive = true;
    state.explosionX = CONFIG.PLANE_X + CONFIG.PLANE_WIDTH / 2;
    state.explosionY = state.planeY + CONFIG.PLANE_HEIGHT / 2;
    state.explosionProgress = 0;
    playSoundExplosion();
    triggerScreenShake(14);
    render();

    if (cause === 'HACKER') {
        state.hackerTextContent = 'HACKER DETECTE\nVous avez ete banni pour 2 minutes';
        state.hackerTextAlpha = 1;
        render();
        await new Promise(r => setTimeout(r, 2200));
    } else {
        await new Promise(r => setTimeout(r, 700));
    }

    state.explosionActive = false;

    const distance = Math.floor(state.score);
    const coinsRaw = Math.floor(state.coinsEarned);
    await saveScore(pilotName, distance);
    const rank = await getRank(distance);
    const totalCoins = await addCoins(coinsRaw);

    await checkAndUpdateQuests(distance);

    saveGlobalScore(pilotName, distance);

    const plane = getPlane(selectedPlaneId);
    if (distance > 0 && plane.scoreMultiplier >= 1.5) {
        saveGlobalBestPath(pilotName, distance, pathRecord);
    }

    if (onGameOverCallback) {
        onGameOverCallback({
            distance,
            pilot: pilotName,
            rank,
            coinsEarned: coinsRaw,
            cause: cause === 'HACKER' ? 'Banni (plafond)' : cause,
            isHacker: cause === 'HACKER',
            questCompleted: state.completedQuestThisRun
        });
    }
}

async function checkAndUpdateQuests(distance) {
    const progress = await getQuestProgressLocal();

    for (const quest of QUESTS) {
        const existing = progress[quest.id] || { progress: 0, completed: false };
        if (existing.completed) continue;

        let newProgress = existing.progress;
        let justCompleted = false;

        if (quest.type === 'score_milestone' && distance >= quest.target) {
            newProgress = quest.target;
            justCompleted = true;
        } else if (quest.type === 'score_no_ceiling' && distance >= quest.target && state.ceilingFrames === 0) {
            newProgress = quest.target;
            justCompleted = true;
        } else if (quest.type === 'survive_time' && state.elapsedTime / 60 >= quest.target) {
            newProgress = quest.target;
            justCompleted = true;
        } else if (quest.type === 'obstacles_passed') {
            newProgress = Math.min(quest.target, existing.progress + state.obstaclesPassedCount);
            if (newProgress >= quest.target) justCompleted = true;
        } else if (quest.type === 'storm_survive' && state.stormSurviveSeconds >= quest.target) {
            newProgress = quest.target;
            justCompleted = true;
        } else if (quest.type === 'total_coins') {
            const coins = await import('./db.js').then(m => m.getCoins());
            if (coins >= quest.target) {
                newProgress = quest.target;
                justCompleted = true;
            }
        }

        if (justCompleted) {
            await saveQuestProgressLocal(quest.id, newProgress, true);
            await addCoins(quest.reward);
            if (!state.completedQuestThisRun) state.completedQuestThisRun = quest;
        } else if (newProgress > existing.progress) {
            await saveQuestProgressLocal(quest.id, newProgress, false);
        }
    }
}
