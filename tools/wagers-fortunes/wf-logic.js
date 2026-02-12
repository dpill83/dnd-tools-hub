// Wagers & Fortunes – pure logic: validation, limiter, shuffle, ids, log
(function (global) {
    'use strict';

    var LIMITER_PER_DAY = 'per-day';
    var LIMITER_PER_SESSION = 'per-session';
    var LIMITER_COOLDOWN = 'cooldown-minutes';

    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function validateGame(game) {
        var errors = [];
        if (!game.name || (game.name || '').trim() === '') errors.push('Game name is required.');
        var n = parseInt(game.numberOfBoxes, 10);
        if (isNaN(n) || n < 1) errors.push('Number of boxes must be at least 1.');
        if (!game.tiers || !Array.isArray(game.tiers)) {
            errors.push('Game must have at least one tier.');
            return { valid: false, errors: errors };
        }
        var expectedBoxes = isNaN(n) ? 3 : n;
        for (var t = 0; t < game.tiers.length; t++) {
            var tier = game.tiers[t];
            var wager = parseFloat(tier.wagerGp);
            if (isNaN(wager) || wager <= 0) errors.push('Tier ' + (t + 1) + ': wager must be a number greater than 0.');
            if (!tier.boxes || tier.boxes.length !== expectedBoxes) {
                errors.push('Tier ' + (t + 1) + ': must have exactly ' + expectedBoxes + ' boxes.');
            } else {
                for (var b = 0; b < tier.boxes.length; b++) {
                    var box = tier.boxes[b];
                    var val = parseFloat(box.estimatedValueGp);
                    if (box.estimatedValueGp !== '' && isNaN(val)) errors.push('Tier ' + (t + 1) + ', Box ' + (b + 1) + ': estimated value must be a number.');
                }
            }
        }
        if (game.limiter && game.limiter.type === LIMITER_COOLDOWN) {
            var v = parseInt(game.limiter.value, 10);
            if (isNaN(v) || v < 1) errors.push('Cooldown minutes must be at least 1.');
        }
        return { valid: errors.length === 0, errors: errors };
    }

    function checkLimiter(limiter, playerKey, lastPlaysByPlayer, sessionId, now) {
        if (!limiter || !playerKey) return { allowed: true };
        now = now || Date.now();
        var last = lastPlaysByPlayer[playerKey];
        if (!last) return { allowed: true };

        if (limiter.type === LIMITER_PER_DAY) {
            var lastDate = new Date(last.timestamp).toDateString();
            var today = new Date(now).toDateString();
            return { allowed: lastDate !== today, message: 'One play per day per character. Already played today.' };
        }
        if (limiter.type === LIMITER_PER_SESSION) {
            var sameSession = last.sessionId === sessionId;
            return { allowed: !sameSession, message: 'One play per session per character.' };
        }
        if (limiter.type === LIMITER_COOLDOWN) {
            var mins = parseInt(limiter.value, 10) || 60;
            var elapsed = (now - last.timestamp) / (60 * 1000);
            return {
                allowed: elapsed >= mins,
                message: 'Cooldown: ' + mins + ' minutes. Try again in ' + Math.ceil(mins - elapsed) + ' minutes.'
            };
        }
        return { allowed: true };
    }

    function getSessionId() {
        try {
            var key = 'dnd-wf-session-id';
            var id = sessionStorage.getItem(key);
            if (!id) {
                id = genId();
                sessionStorage.setItem(key, id);
            }
            return id;
        } catch (e) {
            return 'session-' + Date.now();
        }
    }

    function shuffleBoxOrder(boxes) {
        var copy = boxes.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function buildLogEntry(gameId, tierId, playerName, wagerGp, chosenBoxId, resultSummary, sessionId) {
        return {
            timestamp: Date.now(),
            gameId: gameId,
            tierId: tierId,
            playerName: playerName || '',
            wagerGp: wagerGp,
            chosenBoxId: chosenBoxId,
            resultSummary: resultSummary || '',
            sessionId: sessionId || getSessionId(),
            dmOverride: false
        };
    }

    global.WagersFortunesLogic = {
        genId: genId,
        validateGame: validateGame,
        checkLimiter: checkLimiter,
        getSessionId: getSessionId,
        shuffleBoxOrder: shuffleBoxOrder,
        buildLogEntry: buildLogEntry,
        LIMITER_PER_DAY: LIMITER_PER_DAY,
        LIMITER_PER_SESSION: LIMITER_PER_SESSION,
        LIMITER_COOLDOWN: LIMITER_COOLDOWN
    };
})(typeof window !== 'undefined' ? window : this);
