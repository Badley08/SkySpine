// -------------------------------------------------------
// SkySpine - Systeme de quetes
// Definitions et verification des quetes.
// -------------------------------------------------------

export const QUESTS = [
    {
        id: 'q_score_500',
        title: 'Premier vol',
        desc: 'Atteindre 500 metres',
        type: 'score_milestone',
        target: 500,
        reward: 150,
        unlocksPlane: null
    },
    {
        id: 'q_score_2000',
        title: 'Grand voyageur',
        desc: 'Atteindre 2000 metres',
        type: 'score_milestone',
        target: 2000,
        reward: 300,
        unlocksPlane: null
    },
    {
        id: 'q_score_5000',
        title: 'L\'Incorruptible',
        desc: 'Atteindre 5000 metres sans toucher le plafond',
        type: 'score_no_ceiling',
        target: 5000,
        reward: 750,
        unlocksPlane: 'the_glitch'
    },
    {
        id: 'q_survive_5min',
        title: 'Le Survivant',
        desc: 'Faire une partie de plus de 5 minutes',
        type: 'survive_time',
        target: 300,
        reward: 500,
        unlocksPlane: 'the_glitch'
    },
    {
        id: 'q_obstacles_50',
        title: 'Le Fantome',
        desc: 'Passer a travers 50 obstacles sans mourir (cumul)',
        type: 'obstacles_passed',
        target: 50,
        reward: 400,
        unlocksPlane: 'the_glitch'
    },
    {
        id: 'q_coins_5000',
        title: 'L\'Investisseur',
        desc: 'Accumuler 5000 SpineCoins au total',
        type: 'total_coins',
        target: 5000,
        reward: 0,
        unlocksPlane: 'the_glitch'
    },
    {
        id: 'q_storm_survive',
        title: 'Chasseur d\'orages',
        desc: 'Survivre 60 secondes en phase d\'orage',
        type: 'storm_survive',
        target: 60,
        reward: 350,
        unlocksPlane: null
    }
];

export function getQuest(id) {
    return QUESTS.find(q => q.id === id);
}

export function areAllGlitchQuestsDone(completedIds) {
    const glitchQuests = QUESTS.filter(q => q.unlocksPlane === 'the_glitch');
    return glitchQuests.every(q => completedIds.includes(q.id));
}
