// -------------------------------------------------------
// SkySpine - Renderer (rendu graphique)
// Je dessine tout sur le canvas : fond, obstacles,
// eclairs, avion et explosion.
// -------------------------------------------------------

import { assets } from './assets.js';

// Je dessine le fond du jeu avec parallax et assombrissement meteo
export function drawBackground(ctx, w, h, weather, scrollOffset) {
  let bgImg;

  if (weather === 'clear') {
    bgImg = assets.bg_plage;
  } else {
    bgImg = assets.bg_village;
  }

  if (!bgImg) {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // Je calcule le defilement parallax du fond
  const bgW = (bgImg.width / bgImg.height) * h;
  const offset = scrollOffset % bgW;

  // Je dessine les copies du fond pour un defilement continu
  ctx.drawImage(bgImg, -offset, 0, bgW, h);
  ctx.drawImage(bgImg, -offset + bgW, 0, bgW, h);
  if (offset > 0) {
    ctx.drawImage(bgImg, -offset + bgW * 2, 0, bgW, h);
  }

  // J'assombris le ciel selon la meteo
  if (weather === 'storm') {
    ctx.fillStyle = 'rgba(10, 10, 30, 0.5)';
    ctx.fillRect(0, 0, w, h);
  } else if (weather === 'cloudy') {
    ctx.fillStyle = 'rgba(30, 30, 50, 0.2)';
    ctx.fillRect(0, 0, w, h);
  }
}

// Je dessine la ligne de sol pour indiquer la zone mortelle
export function drawGroundLine(ctx, w, groundY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// Je dessine les obstacles (oiseaux, avions, nuages)
export function drawObstacles(ctx, obstacles) {
  for (const obs of obstacles) {
    const img = assets[obs.asset];
    if (img) {
      ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
    }
  }
}

// Je dessine les eclairs avec un double trait (coeur blanc, contour jaune)
export function drawLightnings(ctx, lightnings) {
  for (const lightning of lightnings) {
    ctx.save();
    ctx.globalAlpha = lightning.alpha;

    // Je dessine le contour jaune de l'eclair
    ctx.strokeStyle = '#ffe566';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    for (const seg of lightning.segments) {
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();

    // Je dessine le coeur blanc fin
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (const seg of lightning.segments) {
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Je dessine le flash blanc de l'orage
export function drawFlash(ctx, w, h, alpha) {
  if (alpha > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
    ctx.fillRect(0, 0, w, h);
  }
}

// Je dessine l'avion avec une inclinaison selon sa vitesse verticale
export function drawPlane(ctx, planeImg, x, y, width, height, velocity) {
  if (!planeImg) return;

  ctx.save();
  const tilt = velocity * 2.5;
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.drawImage(planeImg, -width / 2, -height / 2, width, height);
  ctx.restore();
}

// Je dessine l'explosion quand le joueur meurt
export function drawExplosion(ctx, x, y) {
  const img = assets.explosion;
  if (!img) return;
  const size = 100;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}
