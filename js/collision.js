// -------------------------------------------------------
// SkySpine - Detection de collision
// Je verifie les impacts entre l'avion, les obstacles,
// les eclairs et le sol.
// -------------------------------------------------------

// Je reduis les boites de collision pour etre indulgent avec le joueur
const SHRINK = 0.2;

// Je verifie si deux rectangles se chevauchent
export function rectsCollide(ax, ay, aw, ah, bx, by, bw, bh) {
  const asx = ax + aw * SHRINK;
  const asy = ay + ah * SHRINK;
  const asw = aw * (1 - 2 * SHRINK);
  const ash = ah * (1 - 2 * SHRINK);

  const bsx = bx + bw * SHRINK;
  const bsy = by + bh * SHRINK;
  const bsw = bw * (1 - 2 * SHRINK);
  const bsh = bh * (1 - 2 * SHRINK);

  return asx < bsx + bsw && asx + asw > bsx && asy < bsy + bsh && asy + ash > bsy;
}

// Je verifie si l'avion touche le sol (sable, arbres)
export function checkGroundCollision(planeY, planeHeight, groundY) {
  // Je considere que toucher le sol c'est quand le bas de l'avion atteint la ligne de sol
  return (planeY + planeHeight) >= groundY;
}

// Je verifie si l'avion est touche par un eclair
export function checkLightningHit(lightnings, px, py, pw, ph) {
  for (const lightning of lightnings) {
    if (lightning.alpha <= 0.3) continue; // Je n'utilise que les eclairs encore visibles
    for (const seg of lightning.segments) {
      if (lineIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, px, py, pw, ph)) {
        return true;
      }
    }
  }
  return false;
}

// Je verifie si un segment de droite intersecte un rectangle
function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  // Je reduis la zone de collision de l'avion pour l'indulgence
  const s = 0.25;
  rx += rw * s;
  ry += rh * s;
  rw *= (1 - 2 * s);
  rh *= (1 - 2 * s);

  return (
    linesIntersect(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
    linesIntersect(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
    linesIntersect(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh) ||
    linesIntersect(x1, y1, x2, y2, rx, ry, rx, ry + rh)
  );
}

// Je calcule l'intersection de deux segments
function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.001) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
