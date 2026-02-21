const fs = require('fs');

const mainJs = fs.readFileSync('js_modules/main.js', 'utf8');

// 1. Extract Events
const eventsStart = mainJs.indexOf('// Function to handle zoom change');
const eventsEnd = mainJs.indexOf('function initBackground() {');

const eventsContent = mainJs.substring(eventsStart, eventsEnd);

const newEventsJs = `import { State } from './state.js';
import { changeRadarZoom, shootLaser } from './input.js';
import { MIN_DURATION_TAP_TO_MOVE } from './config.js';

export let isTouching = false;
export let touchStartTime = 0;

export function setupInputEvents() {
${eventsContent.replace(/let touchStartX = 0;/g, '    let touchStartX = 0;')
        .replace(/let touchStartY = 0;/g, '    let touchStartY = 0;')
        .replace(/let isTouching = false;/g, '')
        .replace(/let touchStartTime = 0;/g, '')
        .replace(/let initialPinchDistance = 0;/g, '    let initialPinchDistance = 0;')
        .replace(/let wasPinching = false;/g, '    let wasPinching = false;')}
}
`;
fs.writeFileSync('js_modules/events.js', newEventsJs);

// 2. Extract Physics
const physicsStart = mainJs.indexOf('const spatialGrid = new SpatialHash(2000);');
const physicsEnd = mainJs.indexOf('function loop() {');

const physicsContent = mainJs.substring(physicsStart, physicsEnd);

// What does physics use?
// State, SpatialHash, ASTEROID_MAX_SIZE, ASTEROID_MIN_SIZE, ASTEROID_SPEED_LIMIT, BOUNDARY_CORRECTION_FORCE, BOUNDARY_TOLERANCE_ROIDS, PLANETS_LIMIT, G_CONST, WORLD_BOUNDS, ASTEROID_SPLIT_OFFSET, ASTEROID_SPLIT_SPEED
// createAsteroid, initializePlanetAttributes, createExplosion, createExplosionDebris, createShockwave
// AudioEngine, addScreenMessage
// triggerHomePlanetLost (this is in main.js, so we need to import it or export it and import in physics)

// Note: triggerHomePlanetLost needs to be exported from main.js or game_engine.js

const newPhysicsJs = `import { State } from './state.js';
import { SpatialHash } from './utils.js';
import { ASTEROIDS, ASTEROID_MAX_SIZE, ASTEROID_MIN_SIZE, ASTEROID_SPEED_LIMIT, BOUNDARY_CORRECTION_FORCE, BOUNDARY_TOLERANCE_ROIDS, PLANETS_LIMIT, G_CONST, WORLD_BOUNDS, ASTEROID_SPLIT_OFFSET, ASTEROID_SPLIT_SPEED, MAX_Z_DEPTH } from './config.js';
import { createAsteroid, initializePlanetAttributes, createExplosion, createExplosionDebris, createShockwave } from './entities.js';
import { AudioEngine } from './audio.js';
import { addScreenMessage } from './render.js';
import { triggerHomePlanetLost } from './main.js';

${physicsContent.replace('const spatialGrid = new SpatialHash(2000);', 'export const spatialGrid = new SpatialHash(2000);')
        .replace('function updatePhysics()', 'export function updatePhysics()')
        .replace('function resolveInteraction(r1, r2)', 'export function resolveInteraction(r1, r2)')}
`;
fs.writeFileSync('js_modules/physics.js', newPhysicsJs);

// 3. Update main.js
let newMainJs = mainJs.substring(0, eventsStart)
    + `import { setupInputEvents, isTouching, touchStartTime } from './events.js';\n`
    + `import { spatialGrid, updatePhysics, resolveInteraction } from './physics.js';\n\n`
    + mainJs.substring(eventsEnd, physicsStart)
    + mainJs.substring(physicsEnd);

newMainJs = newMainJs.replace('function triggerHomePlanetLost(reason)', 'export function triggerHomePlanetLost(reason)');
newMainJs = newMainJs.replace('function winGame()', 'export function winGame()'); // In case something else needs it

// We need to fix the reference to isTouching inside loop()
newMainJs = newMainJs.replace(/isTouching/g, 'isTouching');

// Call setupInputEvents in window.onload
newMainJs = newMainJs.replace('resize();', 'resize();\n    setupInputEvents();');

fs.writeFileSync('js_modules/main.js', newMainJs);

// Delete the duplicate/abandoned files to clean up the directory
if (fs.existsSync('js_modules/game.js')) fs.unlinkSync('js_modules/game.js');
if (fs.existsSync('js_modules/core.js')) fs.unlinkSync('js_modules/core.js');

console.log("Successfully split files!");
