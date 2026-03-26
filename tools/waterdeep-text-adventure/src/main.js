import { createOutput } from './output.js';
import { createGame } from './game.js';

const outputEl = document.getElementById('output');
const inputEl = document.getElementById('cmd-input');

const output = createOutput({ outputEl });
const game = createGame({ output, inputEl });

game.boot();

// Keep focus friendly on initial load.
setTimeout(() => inputEl.focus(), 250);

