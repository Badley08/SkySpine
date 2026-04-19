// -------------------------------------------------------
// SkySpine - Gestionnaire d'assets
// Je pre-charge toutes les images PNG du jeu.
// -------------------------------------------------------

const ASSET_LIST = {
  biplane: 'assets/biplane.png',
  avion_bleu: 'assets/avion_bleu.png',
  explosion: 'assets/explosion_2d.png',
  bg_plage: 'assets/backgrounds/background_plage.png',
  bg_village: 'assets/backgrounds/village.png',
  ennemi_avion: 'assets/ennemis/avion_rouge.png',
  ennemi_nuage: 'assets/ennemis/nuage_eclair.png',
  oiseau_1: 'assets/ennemis/oiseau_1_gauche.png',
  oiseau_2: 'assets/ennemis/oiseau_2_gauche.png'
};

export const assets = {};

// Je charge une seule image et je la retourne
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de charger: ' + src));
    img.src = src;
  });
}

// Je charge tous les assets et je mets a jour la barre de progression
export async function loadAllAssets() {
  const keys = Object.keys(ASSET_LIST);
  const total = keys.length;
  let loaded = 0;

  const barEl = document.getElementById('loading-bar');
  const percentEl = document.getElementById('loading-percent');

  for (const key of keys) {
    assets[key] = await loadImage(ASSET_LIST[key]);
    loaded++;
    const pct = Math.round((loaded / total) * 100);
    if (barEl) barEl.style.width = pct + '%';
    if (percentEl) percentEl.textContent = pct + '%';
  }
}
