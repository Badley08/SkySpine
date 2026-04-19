// -------------------------------------------------------
// SkySpine - Point d'entree
// Je connecte tous les modules ensemble et je gere
// la navigation entre les ecrans.
// -------------------------------------------------------

import { loadAllAssets } from './assets.js';
import { setupControls } from './controls.js';
import { saveScore, getTopScores, getRank, clearAllScores, saveSetting, getSetting } from './db.js';
import { initGame, startGame, setSelectedPlane, setPilotName, setGameOverCallback } from './game.js';

// -- Navigation entre ecrans --
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// -- Classement --
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

// -- Initialisation principale --
async function init() {
  const canvas = document.getElementById('game-canvas');

  // Je configure le moteur de jeu
  initGame(canvas);
  setupControls(canvas);

  // Je configure le callback de game over
  setGameOverCallback((distance, pilot, rank) => {
    document.getElementById('gameover-distance').textContent = distance + ' m';
    document.getElementById('gameover-pilot').textContent = pilot;
    document.getElementById('gameover-rank').textContent = '#' + rank;
    showScreen('screen-gameover');
  });

  // Je charge tous les assets
  try {
    await loadAllAssets();
  } catch (err) {
    console.error('Erreur lors du chargement des assets:', err);
  }

  // Je recupere les parametres sauvegardes
  const savedPilot = await getSetting('pilotName');
  if (savedPilot) {
    document.getElementById('pilot-name').value = savedPilot;
  }

  const savedPlane = await getSetting('selectedPlane');
  if (savedPlane) {
    setSelectedPlane(savedPlane);
    document.querySelectorAll('.plane-option').forEach((el) => {
      el.classList.toggle('selected', el.dataset.plane === savedPlane);
    });
  }

  // J'attends un court delai pour l'ecran de chargement
  await new Promise((r) => setTimeout(r, 500));

  // Je passe au menu
  showScreen('screen-menu');

  // --- Bouton Jouer ---
  document.getElementById('btn-play').addEventListener('click', () => {
    const nameInput = document.getElementById('pilot-name').value.trim();
    const name = nameInput || 'Pilote';
    setPilotName(name);
    saveSetting('pilotName', name);
    showScreen('screen-game');
    startGame();
  });

  // --- Bouton Classement ---
  document.getElementById('btn-leaderboard').addEventListener('click', async () => {
    await renderLeaderboard();
    showScreen('screen-leaderboard');
  });

  // --- Retour du classement ---
  document.getElementById('btn-leaderboard-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  // --- Bouton Parametres ---
  document.getElementById('btn-settings').addEventListener('click', () => {
    showScreen('screen-settings');
  });

  // --- Retour des parametres ---
  document.getElementById('btn-settings-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  // --- Selection de l'avion ---
  document.querySelectorAll('.plane-option').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.plane-option').forEach((e) => e.classList.remove('selected'));
      el.classList.add('selected');
      const plane = el.dataset.plane;
      setSelectedPlane(plane);
      saveSetting('selectedPlane', plane);
    });
  });

  // --- Effacer les scores ---
  document.getElementById('btn-clear-scores').addEventListener('click', async () => {
    await clearAllScores();
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
    showScreen('screen-game');
    startGame();
  });

  // --- Bouton Menu ---
  document.getElementById('btn-back-menu').addEventListener('click', () => {
    showScreen('screen-menu');
  });
}

// -- Service Worker --
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('Service Worker non enregistre:', err);
  });
}

// -- Lancement --
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
