// -------------------------------------------------------
// SkySpine - Point d'entree
// Navigation, UI, garage, quetes, classement, banni.
// -------------------------------------------------------

import { loadAllAssets } from './assets.js';
import { setupControls } from './controls.js';
import {
    saveScore, getTopScores, getRank, clearAllScores, saveSetting, getSetting,
    getCoins, getUnlockedPlanes, unlockPlane, spendCoins,
    getQuestProgressLocal, isPilotBanned, banPilot, getBanRemainingMs, wasBannedOnce
} from './db.js';
import { initGame, startGame, setSelectedPlane, setPilotName, setGameOverCallback, pauseGame, resumeGame, stopGame } from './game.js';
import { getGlobalTopScores } from './firebase.js';
import { PLANES, getPlane } from './planes.js';
import { QUESTS, areAllGlitchQuestsDone } from './quests.js';
import { setSoundEnabled, playQuestComplete, playUnlock, playBanned } from './sound.js';

let currentScreen = 'screen-loading';
let activeLeaderboardTab = 'global';
let pilotName = 'Pilote';
let selectedPlaneId = 'biplane';
let banTimerInterval = null;

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    currentScreen = id;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function updateCoinsDisplay() {
    const coins = await getCoins();
    const els = ['menu-coins-display', 'garage-coins-display'];
    els.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = coins;
    });
    return coins;
}

async function renderLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<p class="leaderboard-empty">Chargement...</p>';

    let scores = [];
    if (activeLeaderboardTab === 'global') {
        scores = await getGlobalTopScores(20);
    } else {
        scores = await getTopScores(20);
    }

    if (scores.length === 0) {
        listEl.innerHTML = '<p class="leaderboard-empty">Aucun score enregistre</p>';
        return;
    }

    listEl.innerHTML = scores.map((s, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        const isMine = s.name && s.name.toLowerCase() === pilotName.toLowerCase() ? 'lb-mine' : '';
        return `<div class="lb-entry ${rankClass} ${isMine}">
            <div class="lb-rank">${i + 1}</div>
            <div class="lb-name">${escapeHTML(s.name || '---')}</div>
            <div class="lb-score">${s.distance} m</div>
        </div>`;
    }).join('');
}

async function renderGarage() {
    const grid = document.getElementById('garage-grid');
    const unlocked = await getUnlockedPlanes();
    const coins = await getCoins();
    const questProgress = await getQuestProgressLocal();
    const completedQuests = Object.entries(questProgress).filter(([, v]) => v.completed).map(([k]) => k);
    const allGlitchDone = areAllGlitchQuestsDone(completedQuests);

    grid.innerHTML = PLANES.map(plane => {
        const isUnlocked = unlocked.includes(plane.id);
        const isActive = plane.id === selectedPlaneId;
        const canAfford = coins >= plane.price;

        let lockContent = '';
        if (!isUnlocked) {
            if (plane.unlockCondition?.type === 'coins') {
                lockContent = `<div class="garage-lock-overlay">
                    <span class="garage-unlock-label">${plane.price} SpineCoins</span>
                    <button class="btn btn-gold garage-select-btn ${canAfford ? '' : 'disabled'}" data-buy="${plane.id}" ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? 'Acheter' : 'Insuffisant'}
                    </button>
                </div>`;
            } else if (plane.unlockCondition?.type === 'banned_once') {
                lockContent = `<div class="garage-lock-overlay">
                    <span class="garage-unlock-label">Etre banni une fois</span>
                </div>`;
            } else if (plane.unlockCondition?.type === 'all_quests') {
                lockContent = `<div class="garage-lock-overlay">
                    <span class="garage-unlock-label">${allGlitchDone ? 'Terminer les quetes' : 'Completer toutes les quetes de maitrise'}</span>
                    ${allGlitchDone ? `<button class="btn btn-primary garage-select-btn" data-buy="${plane.id}">Debloquer</button>` : ''}
                </div>`;
            }
        }

        return `<div class="garage-card ${isActive && isUnlocked ? 'active-plane' : ''} ${!isUnlocked ? 'locked' : ''}">
            <img src="${plane.img}" alt="${plane.name}">
            <div class="garage-card-name">${plane.name}</div>
            <div class="garage-card-status">${isActive && isUnlocked ? 'Actif' : isUnlocked ? plane.ability : 'Verrouille'}</div>
            ${isUnlocked && !isActive ? `<button class="btn btn-secondary garage-select-btn" data-select="${plane.id}">Selectionner</button>` : ''}
            ${lockContent}
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-select]').forEach(btn => {
        btn.addEventListener('click', async () => {
            selectedPlaneId = btn.dataset.select;
            await saveSetting('selectedPlane', selectedPlaneId);
            setSelectedPlane(selectedPlaneId);
            updateActivePlaneDisplay();
            renderGarage();
        });
    });

    grid.querySelectorAll('[data-buy]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const planeId = btn.dataset.buy;
            const plane = getPlane(planeId);
            if (plane.price > 0) {
                const success = await spendCoins(plane.price);
                if (!success) return;
            }
            await unlockPlane(planeId);
            playUnlock();
            selectedPlaneId = planeId;
            await saveSetting('selectedPlane', planeId);
            setSelectedPlane(planeId);
            updateActivePlaneDisplay();
            updateCoinsDisplay();
            renderGarage();
        });
    });
}

async function renderQuests() {
    const list = document.getElementById('quests-list');
    const progress = await getQuestProgressLocal();

    list.innerHTML = QUESTS.map(quest => {
        const qp = progress[quest.id] || { progress: 0, completed: false };
        const pct = Math.min(100, Math.round((qp.progress / quest.target) * 100));
        const completedClass = qp.completed ? 'completed' : '';

        return `<div class="quest-card ${completedClass}">
            <div class="quest-top">
                <div>
                    <div class="quest-title">${quest.title}</div>
                    <div class="quest-progress-label">${quest.desc}</div>
                </div>
                <div class="quest-reward">
                    <div class="coin-icon-small"></div>
                    +${quest.reward}
                </div>
            </div>
            <div class="quest-progress-bar">
                <div class="quest-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="quest-progress-label">${qp.completed ? 'Terminee' : `${qp.progress} / ${quest.target}`}</div>
        </div>`;
    }).join('');
}

function updateActivePlaneDisplay() {
    const plane = getPlane(selectedPlaneId);
    const imgEl = document.getElementById('active-plane-img');
    const nameEl = document.getElementById('active-plane-name');
    if (imgEl) imgEl.src = plane.img;
    if (nameEl) nameEl.textContent = plane.name;
}

function animateMenuCanvas() {
    const mc = document.getElementById('menu-canvas');
    if (!mc) return;
    const mCtx = mc.getContext('2d');
    mc.width = mc.offsetWidth;
    mc.height = mc.offsetHeight;
    const stars = Array.from({ length: 60 }, () => ({
        x: Math.random() * mc.width,
        y: Math.random() * mc.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.4 + 0.1,
        alpha: Math.random()
    }));
    function drawMenuBg() {
        if (currentScreen !== 'screen-menu') return;
        mCtx.clearRect(0, 0, mc.width, mc.height);
        mCtx.fillStyle = '#07090f';
        mCtx.fillRect(0, 0, mc.width, mc.height);
        for (const s of stars) {
            s.x -= s.speed;
            if (s.x < 0) { s.x = mc.width; s.y = Math.random() * mc.height; }
            s.alpha = 0.4 + Math.sin(Date.now() / 1000 + s.x) * 0.3;
            mCtx.globalAlpha = s.alpha;
            mCtx.fillStyle = '#7dd3fc';
            mCtx.beginPath();
            mCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            mCtx.fill();
        }
        mCtx.globalAlpha = 1;
        requestAnimationFrame(drawMenuBg);
    }
    drawMenuBg();
}

function showBannedScreen(name, remainingMs) {
    playBanned();
    document.getElementById('banned-pilot-name').textContent = escapeHTML(name);
    const timerEl = document.getElementById('banned-timer');
    const updateTimer = () => {
        const remaining = Math.max(0, remainingMs - (Date.now() - banStart));
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(banTimerInterval);
            timerEl.textContent = '0:00';
        }
    };
    const banStart = Date.now();
    clearInterval(banTimerInterval);
    updateTimer();
    banTimerInterval = setInterval(updateTimer, 500);
    showScreen('screen-banned');
}

async function init() {
    const canvas = document.getElementById('game-canvas');
    initGame(canvas);
    setupControls(canvas);

    setGameOverCallback(async (result) => {
        if (result.isHacker) {
            await banPilot(result.pilot);
            stopGame();
            showBannedScreen(result.pilot, 2 * 60 * 1000);

            const bannedOnce = await wasBannedOnce();
            if (bannedOnce) {
                await unlockPlane('shadow_x');
            }
            return;
        }

        document.getElementById('gameover-distance').textContent = result.distance + ' m';
        document.getElementById('gameover-pilot').textContent = result.pilot;
        document.getElementById('gameover-rank').textContent = '#' + result.rank;
        document.getElementById('gameover-coins').textContent = '+' + result.coinsEarned;
        document.getElementById('gameover-cause').textContent = result.cause || 'Collision';

        const questBlock = document.getElementById('gameover-quest-block');
        if (result.questCompleted) {
            questBlock.style.display = 'flex';
            document.getElementById('gameover-quest-name').textContent = result.questCompleted.title;
            playQuestComplete();
        } else {
            questBlock.style.display = 'none';
        }

        await updateCoinsDisplay();
        const glitchUnlocked = await checkGlitchUnlock();
        if (glitchUnlocked) {
            await unlockPlane('the_glitch');
        }

        showScreen('screen-gameover');
    });

    try {
        await loadAllAssets();
    } catch (err) {
        console.error('Erreur chargement assets:', err);
    }

    const savedPilot = await getSetting('pilotName');
    if (savedPilot) {
        pilotName = savedPilot;
        document.getElementById('pilot-name').value = savedPilot;
    }

    const savedPlane = await getSetting('selectedPlane');
    if (savedPlane) {
        const unlocked = await getUnlockedPlanes();
        if (unlocked.includes(savedPlane)) {
            selectedPlaneId = savedPlane;
            setSelectedPlane(savedPlane);
        }
    }

    const savedSound = await getSetting('soundEnabled');
    const soundOn = savedSound !== false;
    const soundToggle = document.getElementById('toggle-sound');
    if (soundToggle) {
        soundToggle.checked = soundOn;
        setSoundEnabled(soundOn);
        soundToggle.addEventListener('change', async () => {
            setSoundEnabled(soundToggle.checked);
            await saveSetting('soundEnabled', soundToggle.checked);
        });
    }

    updateActivePlaneDisplay();
    await updateCoinsDisplay();

    await new Promise(r => setTimeout(r, 600));
    showScreen('screen-menu');
    animateMenuCanvas();

    document.getElementById('btn-play').addEventListener('click', async () => {
        const nameInput = document.getElementById('pilot-name').value.trim();
        pilotName = nameInput || 'Pilote';
        setPilotName(pilotName);
        await saveSetting('pilotName', pilotName);

        const banned = await isPilotBanned(pilotName);
        if (banned) {
            const remainingMs = await getBanRemainingMs(pilotName);
            showBannedScreen(pilotName, remainingMs);
            return;
        }

        showScreen('screen-game');
        startGame();
    });

    document.getElementById('btn-leaderboard').addEventListener('click', async () => {
        activeLeaderboardTab = 'global';
        document.getElementById('tab-global').classList.add('active');
        document.getElementById('tab-local').classList.remove('active');
        await renderLeaderboard();
        showScreen('screen-leaderboard');
    });

    document.getElementById('btn-leaderboard-back').addEventListener('click', () => showScreen('screen-menu'));

    document.getElementById('tab-global').addEventListener('click', async () => {
        activeLeaderboardTab = 'global';
        document.getElementById('tab-global').classList.add('active');
        document.getElementById('tab-local').classList.remove('active');
        await renderLeaderboard();
    });

    document.getElementById('tab-local').addEventListener('click', async () => {
        activeLeaderboardTab = 'local';
        document.getElementById('tab-local').classList.add('active');
        document.getElementById('tab-global').classList.remove('active');
        await renderLeaderboard();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        updateActivePlaneDisplay();
        showScreen('screen-settings');
    });

    document.getElementById('btn-settings-back').addEventListener('click', () => showScreen('screen-menu'));

    document.getElementById('btn-garage').addEventListener('click', async () => {
        await updateCoinsDisplay();
        await renderGarage();
        showScreen('screen-garage');
    });

    document.getElementById('btn-garage-back').addEventListener('click', () => showScreen('screen-menu'));

    document.getElementById('btn-quests').addEventListener('click', async () => {
        await renderQuests();
        showScreen('screen-quests');
    });

    document.getElementById('btn-quests-back').addEventListener('click', () => showScreen('screen-menu'));

    document.getElementById('btn-clear-scores').addEventListener('click', async () => {
        await clearAllScores();
        const btn = document.getElementById('btn-clear-scores');
        btn.textContent = 'Effaces !';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = 'Effacer les scores locaux';
            btn.disabled = false;
        }, 1500);
    });

    document.getElementById('btn-retry').addEventListener('click', async () => {
        const banned = await isPilotBanned(pilotName);
        if (banned) {
            const remainingMs = await getBanRemainingMs(pilotName);
            showBannedScreen(pilotName, remainingMs);
            return;
        }
        showScreen('screen-game');
        startGame();
    });

    document.getElementById('btn-back-menu').addEventListener('click', async () => {
        await updateCoinsDisplay();
        showScreen('screen-menu');
    });

    document.getElementById('hud-pause-btn').addEventListener('click', () => {
        pauseGame();
        showScreen('screen-pause');
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
        showScreen('screen-game');
        resumeGame();
    });

    document.getElementById('btn-pause-menu').addEventListener('click', () => {
        stopGame();
        showScreen('screen-menu');
    });

    document.getElementById('btn-banned-play').addEventListener('click', async () => {
        const newName = document.getElementById('banned-new-name').value.trim();
        if (!newName) return;
        clearInterval(banTimerInterval);
        pilotName = newName;
        setPilotName(newName);
        await saveSetting('pilotName', newName);
        document.getElementById('pilot-name').value = newName;
        showScreen('screen-game');
        startGame();
    });
}

async function checkGlitchUnlock() {
    const progress = await getQuestProgressLocal();
    const completedIds = Object.entries(progress).filter(([, v]) => v.completed).map(([k]) => k);
    return areAllGlitchQuestsDone(completedIds);
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
