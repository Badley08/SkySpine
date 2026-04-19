// -------------------------------------------------------
// SkySpine - Renderer
// Rendu graphique complet : fond, obstacles, eclairs, avion.
// -------------------------------------------------------

import { assets } from './assets.js';

let shakeX = 0;
let shakeY = 0;
let shakeMag = 0;

export function triggerScreenShake(magnitude) {
    shakeMag = magnitude;
}

function updateShake() {
    if (shakeMag > 0) {
        shakeX = (Math.random() - 0.5) * shakeMag * 2;
        shakeY = (Math.random() - 0.5) * shakeMag * 2;
        shakeMag *= 0.85;
        if (shakeMag < 0.3) {
            shakeMag = 0;
            shakeX = 0;
            shakeY = 0;
        }
    }
}

export function drawBackground(ctx, w, h, weather, scrollOffset) {
    let bgImg = weather === 'clear' ? assets.bg_plage : assets.bg_village;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (!bgImg) {
        ctx.fillStyle = weather === 'storm' ? '#0d1020' : '#6ab0d8';
        ctx.fillRect(-shakeX, -shakeY, w, h);
        ctx.restore();
        return;
    }

    const bgW = (bgImg.width / bgImg.height) * h;
    const offset = scrollOffset % bgW;

    ctx.drawImage(bgImg, -offset, 0, bgW, h);
    ctx.drawImage(bgImg, -offset + bgW, 0, bgW, h);
    if (offset > 0) {
        ctx.drawImage(bgImg, -offset + bgW * 2, 0, bgW, h);
    }

    if (weather === 'storm') {
        ctx.fillStyle = 'rgba(5, 8, 25, 0.55)';
        ctx.fillRect(0, 0, w, h);
    } else if (weather === 'cloudy') {
        ctx.fillStyle = 'rgba(20, 25, 50, 0.25)';
        ctx.fillRect(0, 0, w, h);
    }

    updateShake();
    ctx.restore();
}

export function drawGroundLine(ctx, w, groundY) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

export function drawObstacles(ctx, obstacles) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    for (const obs of obstacles) {
        const img = assets[obs.asset];
        if (img) {
            ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        }
    }
    ctx.restore();
}

export function drawBullets(ctx, bullets) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    for (const b of bullets) {
        ctx.fillStyle = b.friendly ? '#fde047' : '#f87171';
        ctx.shadowColor = b.friendly ? '#fde047' : '#f87171';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

export function drawGhost(ctx, ghostX, ghostY, ghostW, ghostH, ghostName) {
    const img = assets.biplane;
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.translate(shakeX, shakeY);
    ctx.drawImage(img, ghostX, ghostY, ghostW, ghostH);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#38bdf8';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(ghostName || 'Fantome', ghostX + ghostW / 2, ghostY - 6);
    ctx.restore();
}

export function drawLightnings(ctx, lightnings) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    for (const lightning of lightnings) {
        ctx.globalAlpha = lightning.alpha;

        ctx.strokeStyle = '#ffe566';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fff8c0';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        for (const seg of lightning.segments) {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (const seg of lightning.segments) {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
}

export function drawFlash(ctx, w, h, alpha) {
    if (alpha > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}

export function drawPlane(ctx, planeImg, x, y, width, height, velocity) {
    if (!planeImg) return;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    const tilt = Math.max(-25, Math.min(25, velocity * 2.8));
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.drawImage(planeImg, -width / 2, -height / 2, width, height);
    ctx.restore();
}

export function drawExplosion(ctx, x, y, progress) {
    const img = assets.explosion;
    if (!img) return;
    const size = 80 + progress * 60;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    ctx.restore();
}

export function drawMissile(ctx, missile) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.save();
    ctx.translate(missile.x, missile.y);
    const angle = Math.atan2(missile.dy, missile.dx);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, 6);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,100,50,0.5)';
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-10 - i * 6, (Math.random() - 0.5) * 4, 4 - i * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.restore();
}

export function drawHackerText(ctx, w, h, alpha, text) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00ff41';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 20;
    const lines = text.split('\n');
    const lineH = 28;
    const totalH = lines.length * lineH;
    const startY = (h - totalH) / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, startY + i * lineH + lineH);
    });
    ctx.restore();
}
