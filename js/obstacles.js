// -------------------------------------------------------
// SkySpine - Generateur d'obstacles
// Je cree les oiseaux, avions ennemis et nuages eclairs.
// -------------------------------------------------------

// Je cree un obstacle selon la phase meteo actuelle
export function spawnObstacle(weather, canvasW, canvasH, groundY, scrollSpeed) {
  const obstacles = [];

  if (weather === 'clear') {
    // Je genere des oiseaux normaux en phase claire
    const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
    obstacles.push({
      type: 'bird',
      asset: birdType,
      x: canvasW + 50,
      y: 40 + Math.random() * (groundY - 100),
      width: 55,
      height: 45,
      speed: scrollSpeed + 0.5 + Math.random() * 1.5,
      diving: false,
      divingSpeed: 0
    });

  } else if (weather === 'cloudy') {
    // Je melange differents types d'ennemis en phase nuageuse
    const roll = Math.random();

    if (roll < 0.4) {
      // Je genere un avion ennemi rouge
      obstacles.push({
        type: 'plane',
        asset: 'ennemi_avion',
        x: canvasW + 50,
        y: 30 + Math.random() * (groundY - 120),
        width: 70,
        height: 50,
        speed: scrollSpeed + 1.5 + Math.random()
      });
    } else if (roll < 0.7) {
      // Je genere une formation de 2-3 oiseaux
      const baseY = 60 + Math.random() * (groundY - 220);
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
        obstacles.push({
          type: 'bird',
          asset: birdType,
          x: canvasW + 50 + i * 50,
          y: baseY + i * 35,
          width: 50,
          height: 40,
          speed: scrollSpeed + 0.8 + Math.random(),
          diving: false,
          divingSpeed: 0
        });
      }
    } else {
      // Je genere un oiseau plongeur
      const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
      obstacles.push({
        type: 'bird',
        asset: birdType,
        x: canvasW + 50,
        y: 30 + Math.random() * (groundY * 0.3),
        width: 55,
        height: 45,
        speed: scrollSpeed + 1,
        diving: true,
        divingSpeed: 1 + Math.random() * 1.5
      });
    }

  } else {
    // En phase d'orage, je genere des nuages eclairs et des oiseaux rapides
    const roll = Math.random();

    if (roll < 0.5) {
      obstacles.push({
        type: 'cloud',
        asset: 'ennemi_nuage',
        x: canvasW + 80,
        y: 20 + Math.random() * (groundY * 0.4),
        width: 75,
        height: 60,
        speed: scrollSpeed + 0.5
      });
    } else {
      const birdType = Math.random() > 0.5 ? 'oiseau_1' : 'oiseau_2';
      obstacles.push({
        type: 'bird',
        asset: birdType,
        x: canvasW + 50,
        y: 40 + Math.random() * (groundY - 120),
        width: 55,
        height: 45,
        speed: scrollSpeed + 2 + Math.random() * 2,
        diving: Math.random() > 0.6,
        divingSpeed: 1.5 + Math.random() * 2
      });
    }
  }

  return obstacles;
}

// Je genere un eclair diagonal ou vertical pendant l'orage
export function spawnLightning(canvasW, canvasH) {
  const startX = canvasW * 0.3 + Math.random() * canvasW * 0.6;
  const diagonal = Math.random() > 0.4;

  // Je cree les segments de l'eclair pour un effet naturel
  const segments = [];
  let x = startX;
  let y = 0;
  const segCount = 5 + Math.floor(Math.random() * 4);

  for (let i = 0; i < segCount; i++) {
    const nextX = diagonal
      ? x + (Math.random() - 0.3) * 60
      : x + (Math.random() - 0.5) * 40;
    const nextY = y + (canvasH / segCount) + Math.random() * 20;
    segments.push({ x1: x, y1: y, x2: nextX, y2: nextY });
    x = nextX;
    y = nextY;
  }

  return {
    segments: segments,
    alpha: 1,
    decay: 0.02 + Math.random() * 0.02
  };
}
