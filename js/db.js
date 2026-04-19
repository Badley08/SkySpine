// -------------------------------------------------------
// SkySpine - Base de donnees (IndexedDB)
// Je gere la persistance des scores et des parametres.
// -------------------------------------------------------

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
export async function saveScore(name, distance) {
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
export async function getTopScores(limit = 10) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCORES, 'readonly');
    const request = tx.objectStore(STORE_SCORES).getAll();
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
export async function getRank(distance) {
  const scores = await getTopScores(100);
  return scores.filter((s) => s.distance > distance).length + 1;
}

// Je supprime tous les scores
export async function clearAllScores() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCORES, 'readwrite');
    tx.objectStore(STORE_SCORES).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Je sauvegarde un parametre
export async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Je recupere un parametre
export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const request = tx.objectStore(STORE_SETTINGS).get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}
