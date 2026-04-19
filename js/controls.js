// -------------------------------------------------------
// SkySpine - Controles
// Je gere les entrees clavier et tactiles du joueur.
// -------------------------------------------------------

let pressingState = false;
let onFirstPress = null;

export function isPressing() {
  return pressingState;
}

// Je permets aux autres modules de savoir quand le joueur appuie pour la premiere fois
export function setFirstPressCallback(cb) {
  onFirstPress = cb;
}

function handlePressStart(e) {
  if (e) e.preventDefault();

  // Je signale le premier appui pour demarrer le jeu
  if (onFirstPress) {
    onFirstPress();
    onFirstPress = null;
  }

  pressingState = true;
}

function handlePressEnd(e) {
  if (e) e.preventDefault();
  pressingState = false;
}

// Je branche tous les ecouteurs d'evenements sur le canvas
export function setupControls(canvasEl) {
  // J'ecoute les touches clavier
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      handlePressStart();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      handlePressEnd();
    }
  });

  // J'ecoute les evenements tactiles
  canvasEl.addEventListener('touchstart', handlePressStart, { passive: false });
  canvasEl.addEventListener('touchend', handlePressEnd, { passive: false });
  canvasEl.addEventListener('touchcancel', handlePressEnd, { passive: false });

  // J'ecoute les clics souris
  canvasEl.addEventListener('mousedown', handlePressStart);
  canvasEl.addEventListener('mouseup', handlePressEnd);
}

// Je reinitialise l'etat quand une nouvelle partie commence
export function resetControls() {
  pressingState = false;
}
