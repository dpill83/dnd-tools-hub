// Demo game: Wagers & Fortunes: Waterdeep (2 tiers, 3 boxes each)
(function (global) {
    'use strict';

    function seedGame() {
        var gameId = 'wf-waterdeep';
        var tier10Id = 'wf-tier-10';
        var tier50Id = 'wf-tier-50';
        return {
            id: gameId,
            name: 'Wagers & Fortunes: Waterdeep',
            locationTag: 'Waterdeep',
            description: 'A street vendor\'s mystery boxes in the City of Splendors. Pay your wager, pick a box—fair outcomes, no surprises for the DM.',
            numberOfBoxes: 3,
            shuffleBoxesEachRun: false,
            limiter: null,
            hintCheck: null,
            tiers: [
                {
                    id: tier10Id,
                    gameId: gameId,
                    wagerGp: 10,
                    boxes: [
                        {
                            id: 'wf-b10-1',
                            tierId: tier10Id,
                            label: 'Box 1',
                            outcomeType: 'break-even',
                            contents: 'A whispered rumor: the Zhentarim are moving cargo through the Dock Ward tonight.',
                            estimatedValueGp: 10,
                            notes: 'Use to tie into faction quests.',
                            revealText: 'You receive a useful rumor—worth about what you paid.'
                        },
                        {
                            id: 'wf-b10-2',
                            tierId: tier10Id,
                            label: 'Box 2',
                            outcomeType: 'win',
                            contents: 'A minor trinket: a polished stone that glows faintly in moonlight (non-magical).',
                            estimatedValueGp: 18,
                            notes: '',
                            revealText: 'Inside is a small trinket—a pleasant surprise.'
                        },
                        {
                            id: 'wf-b10-3',
                            tierId: tier10Id,
                            label: 'Box 3',
                            outcomeType: 'loss',
                            contents: 'A small cursed bauble: -1 to one roll before next long rest (DM discretion).',
                            estimatedValueGp: 0,
                            notes: 'Flavor as a "lucky" charm that backfires.',
                            revealText: 'The box holds a dubious charm. Perhaps not so lucky.'
                        }
                    ]
                },
                {
                    id: tier50Id,
                    gameId: gameId,
                    wagerGp: 50,
                    boxes: [
                        {
                            id: 'wf-b50-1',
                            tierId: tier50Id,
                            label: 'Box 1',
                            outcomeType: 'break-even',
                            contents: 'Faction favor: a token from the Harpers (or another faction) good for one small request.',
                            estimatedValueGp: 50,
                            notes: 'Redeem for information or safe passage.',
                            revealText: 'A token of favor—you break even with a useful contact.'
                        },
                        {
                            id: 'wf-b50-2',
                            tierId: tier50Id,
                            label: 'Box 2',
                            outcomeType: 'win',
                            contents: 'A potion of healing and a minor gem (50 gp value).',
                            estimatedValueGp: 85,
                            notes: '',
                            revealText: 'A fine haul: a potion and a gem. A clear win.'
                        },
                        {
                            id: 'wf-b50-3',
                            tierId: tier50Id,
                            label: 'Box 3',
                            outcomeType: 'loss',
                            contents: 'Empty save for a taunting note: "Better luck next time, friend."',
                            estimatedValueGp: 0,
                            notes: 'Optional: note is from a rival or comic relief NPC.',
                            revealText: 'The box is empty. Only a scrap of paper mocks you.'
                        }
                    ]
                }
            ]
        };
    }

    global.WagersFortunesSeed = { seedGame: seedGame };
})(typeof window !== 'undefined' ? window : this);
