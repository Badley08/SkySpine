// -------------------------------------------------------
// SkySpine - Systeme meteo
// Transitions progressives + vent + mode nuit.
// -------------------------------------------------------

const CLEAR_DURATION = 120;
const CLOUDY_DURATION = 120;

export function getWeatherPhase(elapsedFrames) {
    const seconds = elapsedFrames / 60;
    if (seconds < CLEAR_DURATION) return 'clear';
    if (seconds < CLEAR_DURATION + CLOUDY_DURATION) return 'cloudy';
    return 'storm';
}

export function getWeatherLabel(phase) {
    const labels = { clear: 'Clair', cloudy: 'Nuageux', storm: 'Orage' };
    return labels[phase] || 'Clair';
}

const WIND_EVENTS = [
    { duration: 300, strength: 0.15, label: 'Vent de face' },
    { duration: 240, strength: -0.12, label: 'Vent arriere' },
    { duration: 0, strength: 0, label: '' }
];

let currentWind = { strength: 0, label: '', timer: 0, nextAt: 600 };

export function updateWind(elapsedFrames) {
    if (elapsedFrames < currentWind.nextAt) {
        if (currentWind.timer > 0) {
            currentWind.timer--;
            if (currentWind.timer === 0) {
                currentWind.strength = 0;
                currentWind.label = '';
                currentWind.nextAt = elapsedFrames + 180 + Math.random() * 300;
            }
        }
        return;
    }
    const event = WIND_EVENTS[Math.floor(Math.random() * (WIND_EVENTS.length - 1))];
    currentWind.strength = event.strength;
    currentWind.label = event.label;
    currentWind.timer = event.duration;
    currentWind.nextAt = elapsedFrames + event.duration + 240 + Math.random() * 300;
}

export function getWindStrength() {
    return currentWind.strength;
}

export function getWindLabel() {
    return currentWind.label;
}

export function resetWind() {
    currentWind = { strength: 0, label: '', timer: 0, nextAt: 600 };
}
