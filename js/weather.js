// -------------------------------------------------------
// SkySpine - Systeme meteo
// Je gere les transitions progressives entre les phases.
// -------------------------------------------------------

// Je definis les durees en secondes
const CLEAR_DURATION = 120;
const CLOUDY_DURATION = 120;

// Je determine la phase meteo en fonction du temps ecoule (en frames a 60fps)
export function getWeatherPhase(elapsedFrames) {
  const seconds = elapsedFrames / 60;

  if (seconds < CLEAR_DURATION) {
    return 'clear';
  } else if (seconds < CLEAR_DURATION + CLOUDY_DURATION) {
    return 'cloudy';
  } else {
    return 'storm';
  }
}

// Je retourne le label francais de la phase meteo
export function getWeatherLabel(phase) {
  const labels = {
    clear: 'Clair',
    cloudy: 'Nuageux',
    storm: 'Orage'
  };
  return labels[phase] || 'Clair';
}
