// -------------------------------------------------------
// SkySpine - Base de donnees (IndexedDB)
// Persistance locale des scores, parametres, coins, quetes.
// -------------------------------------------------------

const DB_NAME = 'SkySpineDB';
const DB_VERSION = 2;
const STORE_SCORES = 'scores';
const STORE_SETTINGS = 'settings';
const STORE_QUEST_PROGRESS = 'quest_progress';

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
            if (!db.objectStoreNames.contains(STORE_QUEST_PROGRESS)) {
                db.createObjectStore(STORE_QUEST_PROGRESS, { keyPath: 'questId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveScore(name, distance) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCORES, 'readwrite');
        tx.objectStore(STORE_SCORES).add({ name, distance: Math.floor(distance), date: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getTopScores(limit = 10) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCORES, 'readonly');
        const request = tx.objectStore(STORE_SCORES).getAll();
        request.onsuccess = () => {
            const scores = request.result.sort((a, b) => b.distance - a.distance).slice(0, limit);
            resolve(scores);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getRank(distance) {
    const scores = await getTopScores(100);
    return scores.filter(s => s.distance > distance).length + 1;
}

export async function clearAllScores() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCORES, 'readwrite');
        tx.objectStore(STORE_SCORES).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function saveSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        tx.objectStore(STORE_SETTINGS).put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getSetting(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const request = tx.objectStore(STORE_SETTINGS).get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = () => reject(request.error);
    });
}

export async function getCoins() {
    const val = await getSetting('spinecoins');
    return val || 0;
}

export async function addCoins(amount) {
    const current = await getCoins();
    await saveSetting('spinecoins', current + amount);
    return current + amount;
}

export async function spendCoins(amount) {
    const current = await getCoins();
    if (current < amount) return false;
    await saveSetting('spinecoins', current - amount);
    return true;
}

export async function getUnlockedPlanes() {
    const val = await getSetting('unlockedPlanes');
    return val || ['biplane'];
}

export async function unlockPlane(planeId) {
    const unlocked = await getUnlockedPlanes();
    if (!unlocked.includes(planeId)) {
        unlocked.push(planeId);
        await saveSetting('unlockedPlanes', unlocked);
    }
}

export async function getQuestProgressLocal() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_QUEST_PROGRESS, 'readonly');
        const request = tx.objectStore(STORE_QUEST_PROGRESS).getAll();
        request.onsuccess = () => {
            const result = {};
            request.result.forEach(q => {
                result[q.questId] = { progress: q.progress, completed: q.completed };
            });
            resolve(result);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function saveQuestProgressLocal(questId, progress, completed) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_QUEST_PROGRESS, 'readwrite');
        tx.objectStore(STORE_QUEST_PROGRESS).put({ questId, progress, completed });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getBannedPilots() {
    const val = await getSetting('bannedPilots');
    return val || {};
}

export async function banPilot(name) {
    const banned = await getBannedPilots();
    banned[name.toLowerCase()] = Date.now() + 2 * 60 * 1000;
    await saveSetting('bannedPilots', banned);
    await saveSetting('wasBannedOnce', true);
}

export async function isPilotBanned(name) {
    const banned = await getBannedPilots();
    const key = name.toLowerCase();
    if (!banned[key]) return false;
    if (Date.now() > banned[key]) {
        delete banned[key];
        await saveSetting('bannedPilots', banned);
        return false;
    }
    return true;
}

export async function getBanRemainingMs(name) {
    const banned = await getBannedPilots();
    const key = name.toLowerCase();
    if (!banned[key]) return 0;
    return Math.max(0, banned[key] - Date.now());
}

export async function wasBannedOnce() {
    return !!(await getSetting('wasBannedOnce'));
}
