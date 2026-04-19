// -------------------------------------------------------
// SkySpine - Catalogue d'avions
// Toutes les donnees des avions disponibles.
// -------------------------------------------------------

export const PLANES = [
    {
        id: 'biplane',
        name: 'Spine-01',
        asset: 'biplane',
        img: 'assets/biplane.png',
        description: 'L\'avion de depart. Equilibre et fiable.',
        unlocked: true,
        price: 0,
        unlockCondition: null,
        ability: 'Equilibre',
        scoreMultiplier: 1.0
    },
    {
        id: 'avion_bleu',
        name: 'Blue Falcon',
        asset: 'avion_bleu',
        img: 'assets/avion_bleu.png',
        description: 'Rapide et maniable. Score x1.2.',
        unlocked: false,
        price: 800,
        unlockCondition: { type: 'coins', amount: 800 },
        ability: 'Rapidite',
        scoreMultiplier: 1.2
    },
    {
        id: 'shadow_x',
        name: 'Shadow-X',
        asset: 'biplane',
        img: 'assets/biplane.png',
        description: 'Debloquez en etant banni une fois (easter egg). Invisible aux radars.',
        unlocked: false,
        price: 0,
        unlockCondition: { type: 'banned_once' },
        ability: 'Furtif',
        scoreMultiplier: 1.1
    },
    {
        id: 'gold_wing',
        name: 'Gold Wing',
        asset: 'avion_bleu',
        img: 'assets/avion_bleu.png',
        description: 'Le prestige. 5000 SpineCoins. Double les points.',
        unlocked: false,
        price: 5000,
        unlockCondition: { type: 'coins', amount: 5000 },
        ability: 'Double coins',
        scoreMultiplier: 2.0
    },
    {
        id: 'the_glitch',
        name: 'The Glitch',
        asset: 'biplane',
        img: 'assets/biplane.png',
        description: 'L\'avion ultime. Completez toutes les quetes de maitrise.',
        unlocked: false,
        price: 0,
        unlockCondition: { type: 'all_quests' },
        ability: 'Traverser 1 obstacle/partie',
        scoreMultiplier: 1.5
    }
];

export function getPlane(id) {
    return PLANES.find(p => p.id === id) || PLANES[0];
}
