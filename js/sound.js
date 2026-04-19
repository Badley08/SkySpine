// -------------------------------------------------------
// SkySpine - Systeme audio
// Sons generes proceduralement (Web Audio API).
// Aucune dependance externe.
// -------------------------------------------------------

let ctx = null;
let soundEnabled = true;

function getCtx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    return ctx;
}

export function setSoundEnabled(val) {
    soundEnabled = val;
}

function playTone(options) {
    if (!soundEnabled) return;
    try {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);

        osc.type = options.type || 'sine';
        osc.frequency.setValueAtTime(options.freq || 440, ac.currentTime);
        if (options.freqEnd) {
            osc.frequency.linearRampToValueAtTime(options.freqEnd, ac.currentTime + (options.duration || 0.1));
        }

        gain.gain.setValueAtTime(options.volume || 0.3, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (options.duration || 0.1));

        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + (options.duration || 0.1) + 0.02);
    } catch (e) {
        // Silencieux si audio non disponible
    }
}

function playNoise(options) {
    if (!soundEnabled) return;
    try {
        const ac = getCtx();
        const bufferSize = ac.sampleRate * (options.duration || 0.1);
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ac.createBufferSource();
        source.buffer = buffer;

        const gain = ac.createGain();
        const filter = ac.createBiquadFilter();
        filter.type = options.filterType || 'bandpass';
        filter.frequency.value = options.filterFreq || 200;
        filter.Q.value = options.filterQ || 1;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);

        gain.gain.setValueAtTime(options.volume || 0.2, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (options.duration || 0.1));

        source.start();
    } catch (e) {
        // Silencieux
    }
}

export function playThrust() {
    playNoise({
        duration: 0.06,
        filterType: 'bandpass',
        filterFreq: 600,
        filterQ: 0.5,
        volume: 0.07
    });
}

export function playExplosion() {
    playNoise({
        duration: 0.5,
        filterType: 'lowpass',
        filterFreq: 150,
        filterQ: 0.8,
        volume: 0.5
    });
    playTone({
        type: 'sawtooth',
        freq: 80,
        freqEnd: 20,
        duration: 0.4,
        volume: 0.3
    });
}

export function playLightningStrike() {
    playNoise({
        duration: 0.2,
        filterType: 'highpass',
        filterFreq: 2000,
        volume: 0.4
    });
    playTone({
        type: 'square',
        freq: 220,
        freqEnd: 40,
        duration: 0.15,
        volume: 0.2
    });
}

export function playBirdHit() {
    playTone({
        type: 'sine',
        freq: 300,
        freqEnd: 100,
        duration: 0.12,
        volume: 0.25
    });
}

export function playMissile() {
    playTone({
        type: 'sawtooth',
        freq: 500,
        freqEnd: 200,
        duration: 0.3,
        volume: 0.35
    });
    playNoise({ duration: 0.3, filterFreq: 400, volume: 0.15 });
}

export function playCoinEarned() {
    playTone({ type: 'sine', freq: 880, duration: 0.06, volume: 0.2 });
    setTimeout(() => playTone({ type: 'sine', freq: 1100, duration: 0.06, volume: 0.2 }), 60);
}

export function playQuestComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone({ type: 'sine', freq, duration: 0.12, volume: 0.25 }), i * 100);
    });
}

export function playUnlock() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone({ type: 'triangle', freq, duration: 0.15, volume: 0.22 }), i * 80);
    });
}

export function playBanned() {
    playTone({ type: 'sawtooth', freq: 200, freqEnd: 80, duration: 0.6, volume: 0.4 });
    playNoise({ duration: 0.3, filterFreq: 300, volume: 0.3 });
}
