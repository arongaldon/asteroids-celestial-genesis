import { ASTEROID_CONFIG, BOUNDARY_CONFIG, PLANET_CONFIG, PLAYER_CONFIG, SCORE_REWARDS, SHIP_CONFIG, STATION_CONFIG, FPS, FRICTION, G_CONST, MAX_Z_DEPTH, MIN_DURATION_TAP_TO_MOVE, SCALE_IN_MOUSE_MODE, SCALE_IN_TOUCH_MODE, WORLD_BOUNDS, ZOOM_LEVELS, suffixes, syllables, DOM } from './config.js';
import { State } from './state.js';
import { AudioEngine } from './audio.js';
import { showInfoLEDText } from './render.js';
import { setupInputEvents } from './events.js';
import { initBackground, createLevel, loop, startGame } from './game_engine.js';

export function resize() {
    State.width = Math.max(window.innerWidth, 100);
    State.height = Math.max(window.innerHeight, 100);
    DOM.canvas.width = State.width;
    DOM.canvas.height = State.height;
    if (State.mouse.x === 0) { State.mouse.x = State.width / 2; State.mouse.y = 0; }
    initBackground();
}

window.addEventListener('resize', resize);

export const audioStarter = () => {
    AudioEngine.init();
    AudioEngine.startMusic();
    DOM.startScreen.removeEventListener('click', audioStarter);
}

export const audioStopper = () => {
    AudioEngine.stopMusic();
    DOM.startScreen.removeEventListener('click', audioStopper);
}

// Make audioStopper globally available for game_engine to call
window.audioStopper = audioStopper;

window.onload = function () {
    DOM.init();
    resize();
    setupInputEvents();
    AudioEngine.init();
    AudioEngine.setTrack('menu');

    // Initialize dummy State.playerShip for safety during early loops
    State.playerShip = { dead: true, tier: 0, score: 0, a: 0 };

    // Initialize background world immediately
    initBackground();
    createLevel();

    // Start loop immediately so we see the world behind the intro
    if (!State.loopStarted) {
        State.loopStarted = true;
        loop();
    }

    // Add listener to start audio on the first interaction
    DOM.startScreen.addEventListener('click', audioStarter);

    showInfoLEDText("The Classic, reimagined by Aron Galdon. Have a safe trip!")
}

// Global start function for HTML
window.startGame = startGame;
