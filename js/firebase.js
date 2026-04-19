// -------------------------------------------------------
// SkySpine - Firebase
// Classement mondial et persistance des quetes.
// -------------------------------------------------------

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAr0C5DTL1zzdilQXScj9mmynX995MPeCs",
    authDomain: "skyspine-146ae.firebaseapp.com",
    projectId: "skyspine-146ae",
    storageBucket: "skyspine-146ae.firebasestorage.app",
    messagingSenderId: "888566895773",
    appId: "1:888566895773:web:d72a5d955cf2f55c8a3074",
    measurementId: "G-XTQWRHBEK3"
};

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

function firestoreValue(val) {
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return { integerValue: String(Math.floor(val)) };
    if (typeof val === 'boolean') return { booleanValue: val };
    return { nullValue: null };
}

function parseFirestoreDoc(doc) {
    if (!doc || !doc.fields) return null;
    const out = {};
    for (const [key, val] of Object.entries(doc.fields)) {
        if ('stringValue' in val) out[key] = val.stringValue;
        else if ('integerValue' in val) out[key] = parseInt(val.integerValue, 10);
        else if ('doubleValue' in val) out[key] = val.doubleValue;
        else if ('booleanValue' in val) out[key] = val.booleanValue;
        else out[key] = null;
    }
    if (doc.name) {
        out._id = doc.name.split('/').pop();
    }
    return out;
}

async function firestoreQuery(collection, orderField, limit = 20) {
    const body = {
        structuredQuery: {
            from: [{ collectionId: collection }],
            orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }],
            limit: limit
        }
    };
    const url = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Firestore query failed');
    const data = await res.json();
    return data.filter(d => d.document).map(d => parseFirestoreDoc(d.document));
}

async function firestoreAddDoc(collection, fields) {
    const firestoreFields = {};
    for (const [k, v] of Object.entries(fields)) {
        firestoreFields[k] = firestoreValue(v);
    }
    const url = `${FIRESTORE_BASE}/${collection}?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: firestoreFields })
    });
    if (!res.ok) throw new Error('Firestore add failed');
    return res.json();
}

async function firestoreSetDoc(collection, docId, fields) {
    const firestoreFields = {};
    for (const [k, v] of Object.entries(fields)) {
        firestoreFields[k] = firestoreValue(v);
    }
    const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: firestoreFields })
    });
    if (!res.ok) throw new Error('Firestore set failed');
    return res.json();
}

async function firestoreGetDoc(collection, docId) {
    const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Firestore get failed');
    return parseFirestoreDoc(await res.json());
}

export async function saveGlobalScore(name, distance) {
    try {
        await firestoreAddDoc('scores', {
            name,
            distance,
            timestamp: Date.now()
        });
    } catch (e) {
        console.warn('Impossible de sauvegarder le score en ligne:', e);
    }
}

export async function getGlobalTopScores(limit = 20) {
    try {
        return await firestoreQuery('scores', 'distance', limit);
    } catch (e) {
        console.warn('Impossible de recuperer les scores en ligne:', e);
        return [];
    }
}

export async function saveGlobalBestPath(name, distance, path) {
    try {
        const existing = await firestoreQuery('ghost', 'distance', 1);
        if (existing.length === 0 || distance > existing[0].distance) {
            const pathStr = JSON.stringify(path.slice(0, 2000));
            await firestoreAddDoc('ghost', { name, distance, path: pathStr, timestamp: Date.now() });
        }
    } catch (e) {
        console.warn('Ghost path non sauvegarde:', e);
    }
}

export async function getGlobalBestPath() {
    try {
        const docs = await firestoreQuery('ghost', 'distance', 1);
        if (docs.length === 0) return null;
        const doc = docs[0];
        return {
            name: doc.name,
            distance: doc.distance,
            path: JSON.parse(doc.path || '[]')
        };
    } catch (e) {
        console.warn('Ghost path non charge:', e);
        return null;
    }
}

export async function saveQuestProgress(pilotId, questId, progress, completed) {
    try {
        const docId = `${pilotId}_${questId}`;
        await firestoreSetDoc('quests', docId, { pilotId, questId, progress, completed });
    } catch (e) {
        console.warn('Quest progress non sauvegardee:', e);
    }
}

export async function getQuestProgress(pilotId) {
    try {
        const body = {
            structuredQuery: {
                from: [{ collectionId: 'quests' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'pilotId' },
                        op: 'EQUAL',
                        value: { stringValue: pilotId }
                    }
                }
            }
        };
        const url = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_CONFIG.apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) return {};
        const data = await res.json();
        const result = {};
        data.filter(d => d.document).forEach(d => {
            const doc = parseFirestoreDoc(d.document);
            result[doc.questId] = { progress: doc.progress, completed: doc.completed };
        });
        return result;
    } catch (e) {
        console.warn('Quest progress non chargee:', e);
        return {};
    }
}
