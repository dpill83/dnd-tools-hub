// Shared travel speed methods for Interactive Map ruler. Load before admin.js and script.js.
(function (global) {
    'use strict';

    var TRAVEL_METHODS = [
        { id: 'walk-normal', label: 'Walk (Normal)', ftPerSec: 4 },
        { id: 'walk-fast', label: 'Walk (Fast)', ftPerSec: 6 },
        { id: 'walk-slow', label: 'Walk (Slow)', ftPerSec: 2.5 },
        { id: 'jog-hustle', label: 'Jog / Hustle', ftPerSec: 8 },
        { id: 'sprint', label: 'Sprint', ftPerSec: 12 },
        { id: 'mount-horse', label: 'Ride a Mount (Horse)', ftPerSec: 10 },
        { id: 'wagon', label: 'Wagon / Cart', ftPerSec: 6 },
        { id: 'rowboat', label: 'Rowboat / Canoe', ftPerSec: 3 },
        { id: 'keelboat', label: 'Keelboat / Sailing Vessel', ftPerSec: 2 },
        { id: 'fly', label: 'Fly', ftPerSec: 10 }
    ];

    var DEFAULT_TRAVEL_METHOD_ID = 'walk-normal';

    function getMethodById(id) {
        if (!id) return null;
        for (var i = 0; i < TRAVEL_METHODS.length; i++) {
            if (TRAVEL_METHODS[i].id === id) return TRAVEL_METHODS[i];
        }
        return null;
    }

    global.TRAVEL_METHODS = TRAVEL_METHODS;
    global.DEFAULT_TRAVEL_METHOD_ID = DEFAULT_TRAVEL_METHOD_ID;
    global.getTravelMethodById = getMethodById;
})(typeof window !== 'undefined' ? window : this);
