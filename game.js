/* * AI DISCLAIMER: This code was developed with the assistance of a large language model. 
 * The author (Aron Galdon Gines) retains all copyrights.
 */

/*

/* =========================================
  AUDIO ENGINE (MENU/GAME OVER ONLY)
  ========================================= */
const AudioEngine = {
    ctx: null,
    masterGain: null,
    delay: null,
    delayGain: null,
    enabled: true,
    nextNoteTime: 0,
    beatCount: 0,
    isPlayingMusic: false,
    currentTrack: 'menu',

    PIANO_FILTER_FREQ: 1500,
    PIANO_FILTER_Q: 10,

    kickGain: null,
    snareGain: null,

    init: function () {
        // Initialize Web Audio API context
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.error("Error resuming AudioContext:", e));
            }
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Master gain node for overall volume control
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);

        // Setup delay effect (Echo) for atmosphere
        this.delay = this.ctx.createDelay(2.0);
        this.delay.delayTime.value = 0.8; // 800ms delay time
        this.delayGain = this.ctx.createGain();
        this.delayGain.gain.value = 0.4; // Feedback volume

        this.delay.connect(this.delayGain);
        this.delayGain.connect(this.delay); // Feedback loop
        this.delayGain.connect(this.masterGain);

        // Initialize percussion gains (permanently silenced for this game mode)
        this.kickGain = this.ctx.createGain();
        this.kickGain.gain.value = 0;
        this.kickGain.connect(this.masterGain);

        this.snareGain = this.ctx.createGain();
        this.snareGain.gain.value = 0;
        this.snareGain.connect(this.masterGain);
    },



    setTrack: function (track) {
        this.currentTrack = track;
        this.beatCount = 0;
        if (this.isPlayingMusic) {
            this.nextNoteTime = this.ctx.currentTime;
        }
    },

    startMusic: function () {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.error("Resume failed:", e));
        }
        if (this.isPlayingMusic) return;

        this.isPlayingMusic = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler(); // Start the note scheduling loop
    },

    stopMusic: function () {
        this.isPlayingMusic = false;
    },

    createPianoNote: function (freq, volume, time, duration) {
        // Generates a piano-like decaying sawtooth wave (for the ambient melody)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        // Lowpass filter to soften the sawtooth wave
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.PIANO_FILTER_FREQ, time);
        filter.Q.setValueAtTime(this.PIANO_FILTER_Q, time);

        const attackTime = 0.005;
        const decayTime = 0.8;

        // ADSR Envelope Simulation
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + attackTime);
        gain.gain.exponentialRampToValueAtTime(volume * 0.5, time + attackTime + decayTime);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.delay); // Send signal to the echo effect

        osc.start(time);
        osc.stop(time + duration + 0.1);
    },

    playKick: function (time) { /* Silenced */ },
    playSnare: function (time) { /* Silenced */ },

    playLaser: function () {
        // SFX for laser shot (falling frequency)
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    },

    playExplosion: function (size = 'small') {
        // SFX for explosion (filtered white noise burst)
        if (!this.enabled || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * (size === 'large' ? 1.5 : 0.5);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        // Sweep filter frequency down for the "thud" effect
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + (size === 'large' ? 1.0 : 0.3));

        // Volume decay
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (size === 'large' ? 1.0 : 0.3));

        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start();
    },

    playThrust: function () {
        // SFX for ship thrust (short triangle wave burst)
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    },

    scheduler: function () {
        if (!this.isPlayingMusic || !this.ctx) return;

        // Music is only played in 'menu' mode
        if (this.currentTrack !== 'menu') {
            this.stopMusic();
            return;
        }

        const beatDuration = 0.5; // Menu/Game Over melody tempo

        // Schedule notes ahead of time (0.1s lookahead)
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playMenuBeat(this.nextNoteTime);
            this.nextNoteTime += beatDuration;
        }
        // Use requestAnimationFrame for recursive scheduling (less heavy than setInterval/setTimeout)
        requestAnimationFrame(() => this.scheduler());
    },

    // Main melody shared by menu and game over
    playMenuBeat: function (time) {
        const A3 = 220; const C4 = 261.63; const E4 = 329.63; const F3 = 174.61; const G3 = 196;

        let chord = [];
        let bassFreq;
        // Chord progression changes every 4 beats
        const measure = Math.floor(this.beatCount / 4);

        // Simple four-chord progression
        if (measure % 4 === 0) { chord = [A3, C4, E4]; bassFreq = A3 / 2; }
        else if (measure % 4 === 1) { chord = [F3, A3, C4]; bassFreq = F3 / 2; }
        else if (measure % 4 === 2) { chord = [261.63, 329.63, 392.00]; bassFreq = 261.63 / 2; }
        else if (measure % 4 === 3) { chord = [G3, 246.94, 293.66]; bassFreq = G3 / 2; }

        const chordVolume = 0.05;
        const bassVolume = 0.06;
        const duration = 3.0;

        // Play chords only on the first beat of the measure
        if (this.beatCount % 4 === 0) {
            chord.forEach(freq => {
                this.createPianoNote(freq, chordVolume, time, duration);
            });
            // Sustained bass line
            this.createPianoNote(bassFreq, bassVolume, time, duration * 2);
        }

        // Soft, random ambient ping
        if (this.beatCount % 2 === 0 && Math.random() < 0.3) {
            const scale = [440, 523.25, 587.33, 659.25, 783.99];
            const freq = scale[Math.floor(Math.random() * scale.length)] * 2;
            this.createPianoNote(freq, 0.02, time, 1.5);
        }

        this.beatCount++;
    }
};

function onStationDestroyed() {
    ship.shield = ship.maxShield; // Restore shield
    score += 500;
    stationsDestroyedCount++;
    if (stationsDestroyedCount > 0 && stationsDestroyedCount % 10 === 0) {
        lives++;
        drawLives();
    }
}

/* =========================================
   GAME CODE
   ========================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

// UI Elements references
const scoreEl = document.getElementById('scoreEl');

const livesDisplay = document.getElementById('lives-display');


const startScreen = document.getElementById('start-screen');
const audioPrompt = document.getElementById('audio-prompt');
const gestureHint = document.getElementById('gesture-hint');
const mobileControls = document.getElementById('mobile-controls');
const gravityAlert = document.getElementById('gravity-alert');

const startBtn = document.getElementById('start-btn');

const boundaryAlertEl = document.getElementById('boundary-alert');
const fadeOverlay = document.getElementById('fade-overlay'); // NEW REFERENCE


let width, height;
const FPS = 60;
const FRICTION = 0.99;
const SHIP_SIZE = 30;
const SHIP_THRUST = 0.9;
const BASE_MAX_SHIELD = 100;
const TOUCH_ROTATION_SENSITIVITY = 0.008;
const MAX_LIVES = 3;
const MAX_SPEED = 50;
const WORLD_SCALE = 10;
const EVOLUTION_SCORE_STEP = 1000;

// HP Constants for Durability Normalization
const STANDARD_SHIP_HP = 3; // Tiers 0-7 Player Ship & Normal Enemy Ships
const MAX_TIER_HP = 9;      // Tier 8+ Player Ship & Enemy Stations

// NEW RADAR VARIABLES
// NEW RADAR VARIABLES
const ZOOM_LEVELS = [2500, 5000, 12500, 25000, 75000]; // World units (Scaled 5x)
let currentZoomIndex = 2; // Index for 25000 (default)
let RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex]; // Current effective max range

const G_CONST = 0.5; // Gravity constant
const PLANET_THRESHOLD = 150; // REDUCIDO (Antes 200) para facilitar la creación de planetas
const MAX_Z_DEPTH = 3;

// WORLD BOUNDARY CONSTANTS
const WORLD_BOUNDS = 75000;
const BOUNDARY_DAMPENING = 0.5;
const BOUNDARY_TOLERANCE = 100;

// ATTRITION GRAVITATORIA DE BALAS
const BULLET_GRAVITY_FACTOR = 90;
const BULLET_LIFETIME = 100;
const BULLET_FADE_FRAMES = 5;

// Lifetime and size for smaller side bullets
const SIDE_BULLET_LIFETIME = 10;
const PRIMARY_BULLET_SIZE = 5;
const SECONDARY_BULLET_SIZE = 2;

// Player Reload/Fire Rate Control
let playerReloadTime = 0;
const PLAYER_RELOAD_TIME_MAX = 8;


// Clean global game state variables
let ship;
// roids, enemies, bullets, etc. now store ABSOLUTE WORLD COORDINATES
let roids = [];
let enemies = [];
let bullets = [];
let enemyBullets = [];
let particles = [];
let shockwaves = [];
// Ambient fog array
let ambientFogs = [];
let backgroundLayers = { nebulas: [], galaxies: [], starsNear: [], starsMid: [], starsFar: [] };

// Enemy spawn timer
let stationSpawnTimer = 0;
let stationsDestroyedCount = 0;

// Force initial velocity cleanup
let velocity = { x: 0, y: 0 }; // Velocity is in World Units/Frame

// Total accumulated world displacement (Player's absolute position in World Units)
let worldOffsetX = 0;
let worldOffsetY = 0;

const syllables = ["KRON", "XER", "ZAN", "TOR", "AER", "ION", "ULA", "PROX", "VEX", "NOV", "SOL", "LUNA", "TER", "MAR", "JUP"];
const suffixes = ["PRIME", "IV", "X", "ALPHA", "BETA", "MAJOR", "MINOR", "ZERO", "AEON"];

function generatePlanetName() {
    const s1 = syllables[Math.floor(Math.random() * syllables.length)];
    const s2 = syllables[Math.floor(Math.random() * syllables.length)];
    const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${s1}${s2.toLowerCase()} ${suf}`;
}

// Pseudo-random number generator used for procedural generation
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function drawPlanetTexture(ctx, x, y, r, textureData) {
    if (!textureData || isNaN(x) || isNaN(y) || isNaN(r)) return;

    let grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, textureData.innerGradColor);
    grad.addColorStop(0.1, textureData.waterColor);
    grad.addColorStop(1, textureData.waterColor);

    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = textureData.landColor;
    textureData.landmasses.forEach(lm => {
        ctx.beginPath();
        const radius = r * lm.radiusFactor;
        const centerX = x + Math.cos(lm.startAngle) * radius * 0.5;
        const centerY = y + Math.sin(lm.startAngle) * radius * 0.5;

        for (let j = 0; j < lm.vertices; j++) {
            const angle = (j / lm.vertices) * Math.PI * 2;
            const dist = radius * lm.vertexOffsets[j];
            const px = centerX + Math.cos(angle) * dist;
            const py = centerY + Math.sin(angle) * dist;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
    });

    // Craters/Shadows
    ctx.fillStyle = textureData.craterColor;
    textureData.craters.forEach(cr => {
        const cx = x + cr.xFactor * r;
        const cy = y + cr.yFactor * r;
        const crr = r * cr.rFactor;
        // Solo dibuja si el cráter está dentro del límite del planeta
        if (Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) + crr < r) {
            ctx.beginPath(); ctx.arc(cx, cy, crr, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`; ctx.lineWidth = 1; ctx.stroke();
        }
    });

    // Clouds
    textureData.age += 0.001;
    ctx.fillStyle = textureData.cloudColor;
    textureData.clouds.forEach(cl => {
        const angle = textureData.cloudOffset + cl.angleRng + textureData.age * cl.ageFactorRng;
        const dist = r * cl.distRng;
        const cx = x + Math.cos(angle) * dist;
        const cy = y + Math.sin(angle) * dist;
        const cr = r * cl.crRng;
        const rotation = cl.rotationRng;

        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
        ctx.beginPath(); ctx.ellipse(0, 0, cr * 1.5, cr * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });

    // Atmosphere
    let atmGrad = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.1);
    atmGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
    atmGrad.addColorStop(0.5, textureData.atmosphereColor);
    atmGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = atmGrad; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = textureData.atmosphereColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

let level = 0;
let score = 0;
let lives = MAX_LIVES;
let gameRunning = false;
let inputMode = 'mouse';
// KeyA and KeyD are added for strafing (side movement)
let keys = { ArrowUp: false, ArrowDown: false, Space: false, ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
let mouse = { x: 0, y: 0 };

function resize() {
    width = Math.max(window.innerWidth, 100);
    height = Math.max(window.innerHeight, 100);
    canvas.width = width;
    canvas.height = height;
    if (mouse.x === 0) { mouse.x = width / 2; mouse.y = 0; }
    initBackground();
}
window.addEventListener('resize', resize);

const audioStarter = () => {
    AudioEngine.init();
    AudioEngine.startMusic();
    audioPrompt.style.display = 'none';
    startScreen.removeEventListener('click', audioStarter);
}

window.onload = function () {
    resize();
    AudioEngine.init();
    AudioEngine.setTrack('menu');

    // Add listener to start audio on the first interaction
    startScreen.addEventListener('click', audioStarter);

    const instructionsText = `Asteroids Reimagined: The Classic, Upgraded by Aron Galdon`
    const ledElement = document.getElementById('led-instructions');
    animateLedText(instructionsText, ledElement);
}

function animateLedText(text, element) {
    if (!element) return;
    element.innerHTML = '';
    const characters = text.split('');
    let i = 0;
    let line = '';

    function show() {
        if (i < characters.length) {
            const char = characters[i];
            line += char;
            element.textContent = line;
            i++;
            setTimeout(show, 50); // Adjust speed here
        }
    }
    show();
}


// Function to handle zoom change (used by Z key and Mouse Wheel)
function changeRadarZoom(direction) {
    if (!gameRunning) return;

    let newIndex = currentZoomIndex + direction;

    // Clamp index between 0 and max index
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= ZOOM_LEVELS.length) newIndex = ZOOM_LEVELS.length - 1;

    if (newIndex !== currentZoomIndex) {
        currentZoomIndex = newIndex;
        RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex];
        // No longer updating radarRangeEl text element.
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') shootLaser();

    // NOTE: The logic for KeyE to create matter has been permanently removed as requested.

    // NEW: Radar Zoom Toggle (Key Z)
    if (e.code === 'KeyZ' && gameRunning) {
        changeRadarZoom(1); // Zoom Out (next level)
    }

    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.ArrowUp = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.ArrowDown = false; // KeyS is brake

    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;

    if (e.code === 'KeyA') keys.KeyA = true;
    if (e.code === 'KeyD') keys.KeyD = true;

    // Hide mobile controls if keyboard is used on desktop
    if (inputMode === 'mouse' && window.innerWidth > 768) { mobileControls.style.opacity = '0'; gestureHint.style.opacity = '0'; }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.ArrowUp = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.ArrowDown = false;

    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;

    if (e.code === 'KeyA') keys.KeyA = false;
    if (e.code === 'KeyD') keys.KeyD = false;
});
document.addEventListener('mousemove', (e) => {
    if (e.target.closest('.btn')) return; // Ignore if over a button
    inputMode = 'mouse'; mouse.x = e.clientX; mouse.y = e.clientY;
    if (gameRunning) { mobileControls.style.opacity = '0'; gestureHint.innerText = ""; }
});
document.addEventListener('mousedown', (e) => {
    if (!gameRunning || e.target.closest('button')) return;
    inputMode = 'mouse'; shootLaser();
});

// NEW: Mouse Wheel Event Listener for Zoom
document.addEventListener('wheel', (e) => {
    if (!gameRunning) return;
    e.preventDefault(); // Prevent page scrolling

    // DeltaY is positive when scrolling down (zoom out), negative when scrolling up (zoom in)
    const direction = e.deltaY > 0 ? 1 : -1;
    changeRadarZoom(direction);
}, { passive: false });

const setupBtn = (id, key) => {
    // Setup for mobile control buttons
    const btn = document.getElementById(id);
    const start = (e) => { e.preventDefault(); e.stopPropagation(); inputMode = 'touch'; keys[key] = true; if (key === 'Space') shootLaser(); };
    const end = (e) => { e.preventDefault(); e.stopPropagation(); keys[key] = false; };
    btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', end); btn.addEventListener('pointerleave', end);
};
setupBtn('btn-thrust', 'ArrowUp'); setupBtn('btn-brake', 'ArrowDown'); setupBtn('btn-fire', 'Space');

let touchStartX = 0; let isTouching = false;
document.addEventListener('touchstart', (e) => {
    // Touch input for rotation
    if (e.target.closest('.btn')) return;
    inputMode = 'touch'; isTouching = true; touchStartX = e.touches[0].clientX;
    mobileControls.style.opacity = '1'; gestureHint.style.opacity = '1'; gestureHint.innerText = "← DESLIZA PARA GIRAR →";
}, { passive: false });
document.addEventListener('touchmove', (e) => {
    if (!isTouching || !gameRunning || ship.dead) return;
    e.preventDefault();
    const currentX = e.touches[0].clientX; const deltaX = currentX - touchStartX;
    ship.a -= deltaX * TOUCH_ROTATION_SENSITIVITY; touchStartX = currentX; // Rotation proportional to horizontal swipe
}, { passive: false });
document.addEventListener('touchend', () => { isTouching = false; });

function createGalaxy() {
    // Procedural generation of a background galaxy object
    const arms = Math.floor(Math.random() * 2) + 2;
    const size = Math.random() * 150 + 100;
    const colorBase = Math.random() > 0.5 ? { r: 50, g: 100, b: 255 } : { r: 255, g: 50, b: 200 };
    let stars = [];
    for (let i = 0; i < 300; i++) {
        const dist = Math.random() * size; const angle = (dist / 15) + (Math.PI * 2 * (i % arms) / arms);
        stars.push({ r: dist, theta: angle + Math.random() * 0.5, size: Math.random() * 1.5, alpha: Math.random() });
    }
    return { x: Math.random() * width * 3 - width, y: Math.random() * height * 3 - height, size, stars, color: colorBase, angle: Math.random() * Math.PI };
}

function createAmbientFog() {
    // Spawns outside the visible screen and moves slowly inward
    const side = Math.floor(Math.random() * 4); // 0:top, 1:right, 2:bottom, 3:left
    let x, y, xv, yv;
    const padding = 500;
    const speed = 0.5;

    if (side === 0) { x = width * Math.random(); y = -padding; xv = (Math.random() - 0.5) * 0.1; yv = speed; }
    else if (side === 1) { x = width + padding; y = height * Math.random(); xv = -speed; yv = (Math.random() - 0.5) * 0.1; }
    else if (side === 2) { x = width * Math.random(); y = height + padding; xv = (Math.random() - 0.5) * 0.1; yv = -speed; }
    else { x = -padding; y = height * Math.random(); xv = speed; yv = (Math.random() - 0.5) * 0.1; }

    return {
        x, y, xv, yv,
        r: Math.max(width, height) * (0.8 + Math.random() * 0.5),
        hue: Math.random() < 0.5 ? 240 : 0, // Blue (240) or Red (0)
        alpha: 0.05 + Math.random() * 0.1,
        life: 500 // frames before despawn/respawn
    };
}

function initBackground() {
    // Resets and populates background layers for parallax
    backgroundLayers = { nebulas: [], galaxies: [], starsNear: [], starsMid: [], starsFar: [] };
    ambientFogs = []; // NEW: Reset ambient fog
    for (let i = 0; i < 6; i++) backgroundLayers.nebulas.push({ x: Math.random() * width, y: Math.random() * height, r: width * 0.6, hue: Math.random() * 60 + 200, alpha: 0.1 });
    for (let i = 0; i < 3; i++) backgroundLayers.galaxies.push(createGalaxy());
    for (let i = 0; i < 3; i++) ambientFogs.push(createAmbientFog()); // NEW: Initial ambient fogs
    const createStar = () => ({ x: Math.random() * width, y: Math.random() * height, size: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.5 + 0.3 });
    for (let i = 0; i < 50; i++) backgroundLayers.starsFar.push(createStar());
    for (let i = 0; i < 50; i++) backgroundLayers.starsMid.push(createStar());
    for (let i = 0; i < 40; i++) backgroundLayers.starsNear.push(createStar());
}

// REFRACTORIZADO: Añade structureHP para el sistema de 3 golpes.
function newShip() {
    // Fix: Initialize HP based on current Tier (score)
    const currentTier = getShipTier();
    const startingHP = currentTier >= 8 ? MAX_TIER_HP : STANDARD_SHIP_HP;

    return {
        a: 90 / 180 * Math.PI,
        r: SHIP_SIZE / 2,
        maxShield: BASE_MAX_SHIELD,
        shield: BASE_MAX_SHIELD,
        blinkNum: 30,
        blinkTime: 6,
        dead: false,
        thrusting: false,
        mass: 20,
        structureHP: startingHP // Set to correct tier HP (9 or 3)
    };
}
function getShipTier() { return Math.floor(score / EVOLUTION_SCORE_STEP); }
function getShapeName(tier) {
    if (tier >= 8) return "THE SPHERE";
    const shapes = ["TRIANGLE", "SQUARE", "PENTAGON", "HEXAGON", "HEPTAGON", "OCTAGON", "NONAGON", "DECAGON"];
    return shapes[Math.min(tier, shapes.length - 1)];
}

function spawnStation() {
    const nearbyPlanets = roids.filter(r => r.isPlanet);

    if (nearbyPlanets.length === 0) {
        console.log("No near planets available for station spawn. Retrying soon.");
        stationSpawnTimer = 300;
        return;
    }

    // Select a random planet to host the station
    const hostPlanet = nearbyPlanets[Math.floor(Math.random() * nearbyPlanets.length)];

    const SAFE_ORBIT_FACTOR = 1.6;
    const STATION_R = 70;
    // HostPlanet.r ya tiene la escala de profundidad, usamos el radio actual para el cálculo
    const orbitDistance = hostPlanet.r + (hostPlanet.r * SAFE_ORBIT_FACTOR) + STATION_R;

    const orbitAngle = Math.random() * Math.PI * 2;

    // Calculate initial ABSOLUTE WORLD position relative to the planet center
    const startX = hostPlanet.x + Math.cos(orbitAngle) * orbitDistance;
    const startY = hostPlanet.y + Math.sin(orbitAngle) * orbitDistance;

    enemies.push({
        type: 'station',
        x: startX, // World Coordinate X
        y: startY, // World Coordinate Y
        xv: hostPlanet.xv, // Inherit planet velocity
        yv: hostPlanet.yv,
        r: STATION_R, a: Math.random() * Math.PI * 2, rotSpeed: 0.005,
        structureHP: MAX_TIER_HP, // USANDO 9 HP para estaciones
        shieldHitTimer: 0,
        spawnTimer: 180, reloadTime: 120, mass: 500,
        hostPlanet: hostPlanet, // Reference to the planet object
        orbitDistance: orbitDistance, // Nueva distancia segura
        orbitAngle: orbitAngle,
        orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * 0.002, // Slow orbital rotation
        fleetHue: Math.floor(Math.random() * 360), // Unique color for the fleet
        blinkNum: 60,
        z: hostPlanet.z || 0 // Inherit Z-depth from planet
    });
    stationSpawnTimer = 600 + Math.random() * 300;
    console.log(`Station spawned at planet ${hostPlanet.name}`);
}

function spawnShipFromStation(station) {
    // Spawns a small enemy ship near the station
    const spawnDist = station.r * 1.5;
    const angle = Math.random() * Math.PI * 2;

    enemies.push({
        type: 'ship',
        x: station.x + Math.cos(angle) * spawnDist, // World Coordinate X
        y: station.y + Math.sin(angle) * spawnDist, // World Coordinate Y
        // Apply a slight outward velocity relative to the station
        xv: station.xv + Math.cos(angle) * 1.5,
        yv: station.yv + Math.sin(angle) * 1.5,
        r: 35, a: 0,
        structureHP: STANDARD_SHIP_HP, // USANDO 3 HP para naves enemigas estándar
        shieldHitTimer: 0,
        reloadTime: 100 + Math.random() * 100, mass: 30,
        fleetHue: station.fleetHue, // Inherit color from station
        blinkNum: 30
    });
    AudioEngine.playExplosion('small'); // SFX Spawn
}

// NEW: Function to initialize fixed planet attributes (texture, name, rings)
function initializePlanetAttributes(roid) {
    // CORRECCIÓN: Si ya tiene datos de textura (ya fue inicializado), NO hace nada.
    if (roid.isPlanet && roid.textureData) return;

    const r = roid.r;
    // Usamos una semilla fija para asegurar que el nombre, colores y patrones NO cambien.
    const seed = Math.floor(Math.random() * 100000);
    const rng = mulberry32(seed);
    const hue = rng() * 360;

    roid.isPlanet = true;
    roid.name = generatePlanetName();
    roid.zSpeed = (rng() * 0.001) + 0.0005; // Random, slow speed

    // --- TEXTURE DATA (FIXED) ---
    let textureData = {
        seed: seed, // Almacenamos el seed para confirmar la identidad
        waterColor: `hsl(${hue}, 60%, 30%)`,
        landColor: `hsl(${hue}, 40%, 40%)`,
        cloudColor: `rgba(255, 255, 255, 0.4)`,
        craterColor: `rgba(0, 0, 0, 0.2)`,
        atmosphereColor: `hsl(${hue}, 80%, 60%)`,
        cloudOffset: rng() * Math.PI * 2,
        age: 0,
        innerGradColor: `hsl(${hue}, 10%, 2%)`,
        landmasses: [],
        craters: [],
        clouds: []
    };

    // 2. Landmasses (Capture geometry)
    for (let i = 0; i < 5; i++) {
        const startAngle = rng() * Math.PI * 2;
        const radiusFactor = (0.5 + rng() * 0.4);
        const vertices = 10 + Math.floor(rng() * 10);
        const vertexOffsets = [];
        for (let j = 0; j < vertices; j++) {
            vertexOffsets.push(0.8 + rng() * 0.4);
        }
        textureData.landmasses.push({ startAngle, radiusFactor, vertices, vertexOffsets });
    }

    // 3. Craters (Capture positions/sizes)
    for (let i = 0; i < 10; i++) {
        textureData.craters.push({
            xFactor: (rng() - 0.5) * 1.5,
            yFactor: (rng() - 0.5) * 1.5,
            rFactor: (0.05 + rng() * 0.1)
        });
    }

    // 4. Clouds (Capture initial positions/sizes)
    for (let i = 8; i < 8; i++) {
        textureData.clouds.push({
            angleRng: rng() * Math.PI * 2,
            distRng: rng() * 0.8,
            crRng: (0.1 + rng() * 0.2),
            rotationRng: rng() * Math.PI * 2,
            ageFactorRng: rng() * 0.5 + 0.5
        });
    }

    roid.textureData = textureData;


    // Initialize Rings: Store RATIOS 
    if (Math.random() < 0.25 || r > PLANET_THRESHOLD + 100) {
        roid.rings = {
            tilt: (rng() * 0.4 - 0.2) + (Math.PI / 2),
            bands: [
                { rRatio: 1.2, wRatio: 0.1, alpha: 0.6, color: `hsl(${hue + 60}, 40%, 70%)` },
                { rRatio: 1.5, wRatio: 0.15, alpha: 0.5, color: `hsl(${hue - 60}, 50%, 50%)` }
            ]
        };
    } else {
        roid.rings = null;
    }
}


function createAsteroid(x, y, r, z = 0) {
    // Creates a standard asteroid or a planet if radius is large enough
    // x, y are ABSOLUTE WORLD COORDINATES
    let isPlanet = r > PLANET_THRESHOLD;
    let roid = {
        x, y,
        xv: (Math.random() * 30 / FPS) * (Math.random() < 0.5 ? 1 : -1) * (isPlanet ? 0.2 : 1), // Slower velocity for planets
        yv: (Math.random() * 30 / FPS) * (Math.random() < 0.5 ? 1 : -1) * (isPlanet ? 0.2 : 1),
        r, a: Math.random() * Math.PI * 2,
        vert: Math.floor(Math.random() * 8 + 6), offs: [], // Irregular polygon shape
        mass: r * r * 0.05,
        isPlanet: isPlanet,
        z: z, // Z-depth for parallax
        zSpeed: 0, // Will be set by initializePlanetAttributes
        name: null,
        textureData: null,
        rings: null,
        blinkNum: 0,
        targetR: r // NEW: Target radius for smooth scaling
    };

    // Initialize planet attributes here if it's forced to be a planet on creation
    if (isPlanet) {
        initializePlanetAttributes(roid);
    }

    for (let i = 0; i < roid.vert; i++) roid.offs.push(Math.random() * 0.3 * 2 + 1 - 0.3);
    return roid;
}

function createBullet(angleOffset, perpOffset, rOffset = 0, isPrimary = true) {
    // Creates a bullet relative to the ship's position and angle
    const angle = ship.a + angleOffset;
    const offsetX = (Math.cos(ship.a + Math.PI / 2) * perpOffset);
    const offsetY = (Math.sin(ship.a + Math.PI / 2) * perpOffset);
    const radius = (ship.effectiveR || ship.r) + rOffset;

    // Calculate the initial ABSOLUTE WORLD position of the bullet
    const startWorldX = worldOffsetX + radius * Math.cos(ship.a) - offsetX;
    const startWorldY = worldOffsetY - radius * Math.sin(ship.a) + offsetY;

    const lifetime = isPrimary ? BULLET_LIFETIME : SIDE_BULLET_LIFETIME;
    const size = isPrimary ? PRIMARY_BULLET_SIZE : SECONDARY_BULLET_SIZE;

    return {
        x: startWorldX, // World Coordinate X
        y: startWorldY, // World Coordinate Y
        // Bullet velocity is applied relative to the world
        xv: (700 * Math.cos(angle) / FPS) + velocity.x,
        yv: (-700 * Math.sin(angle) / FPS) + velocity.y,
        dist: 0,
        life: lifetime,
        size: size
    };
}

function createOmniBullet(absoluteAngle, isPrimary = false) {
    // Creates a bullet fired outward from the ship's center (for high-tier ships)
    const radius = (ship.effectiveR || ship.r);

    // Calculate the initial ABSOLUTE WORLD position of the bullet
    const startWorldX = worldOffsetX + radius * Math.cos(absoluteAngle);
    const startWorldY = worldOffsetY - radius * Math.sin(absoluteAngle);

    const lifetime = isPrimary ? BULLET_LIFETIME : SIDE_BULLET_LIFETIME;
    const size = isPrimary ? PRIMARY_BULLET_SIZE : SECONDARY_BULLET_SIZE;

    return {
        x: startWorldX, // World Coordinate X
        y: startWorldY, // World Coordinate Y
        xv: (700 * Math.cos(absoluteAngle) / FPS) + velocity.x,
        yv: (-700 * Math.sin(absoluteAngle) / FPS) + velocity.y,
        dist: 0,
        life: lifetime,
        size: size
    };
}

function shootLaser() {
    if (!gameRunning || ship.dead) return;

    // 1. Cooldown Check
    if (playerReloadTime > 0) {
        return;
    }
    playerReloadTime = PLAYER_RELOAD_TIME_MAX; // Set cooldown

    AudioEngine.playLaser(); // SFX SHOOT
    const tier = getShipTier();

    // Tiered shooting logic: from single shot to omni-directional
    if (tier >= 4) {
        let sides = (tier === 7 || tier >= 8) ? (tier >= 8 ? 16 : 10) : (3 + tier);

        // 1. RESTORED: Powerful frontal (primary) shot. (User request)
        bullets.push(createOmniBullet(ship.a, true));

        // 2. Secondary shots (Weaker, shorter life).
        // Calculate step for distributing all "sides" around the circle
        const angleStep = (Math.PI * 2) / sides;

        for (let i = 0; i < sides; i++) {
            let angle = ship.a + (i * angleStep);

            // Calculate relative angle to the forward direction (ship.a). Normalize to [0, 2*PI]
            let angleRel = angle - ship.a;
            angleRel = (angleRel % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

            // Define the forbidden backward cone: 150 degrees to 210 degrees (or +/- 30 degrees around 180).
            const BACK_CONE_ANGLE = Math.PI / 6; // 30 degrees
            const MIN_BACK_ANGLE = Math.PI - BACK_CONE_ANGLE; // 150 deg
            const MAX_BACK_ANGLE = Math.PI + BACK_CONE_ANGLE; // 210 deg

            // Check if the relative angle is inside the forbidden backward cone (150 to 210 degrees)
            const isBackwardShot = angleRel > MIN_BACK_ANGLE && angleRel < MAX_BACK_ANGLE;

            // Also skip the exact forward shot, which is handled as the primary shot above (0 or 2*PI)
            const isForwardShot = angleRel < 0.1 || angleRel > (Math.PI * 2) - 0.1;

            if (!isForwardShot && !isBackwardShot) {
                bullets.push(createOmniBullet(angle, false));
            }
        }
    }
    else if (tier === 3) {
        // Tier 3: Multiple fixed shots, make the central one primary
        bullets.push(createBullet(0, 0, 0, true)); // Primary
        bullets.push(createBullet(0.15, 0, 0, false));
        bullets.push(createBullet(-0.15, 0, 0, false));
        bullets.push(createBullet(0.4, 0, 0, false));
        bullets.push(createBullet(-0.4, 0, 0, false));
    }
    else if (tier === 2) {
        // Tier 2: 3 shots
        bullets.push(createBullet(0, 0, 0, true)); // Primary
        bullets.push(createBullet(0.1, 0, 0, false));
        bullets.push(createBullet(-0.1, 0, 0, false));
    }
    else if (tier === 1) {
        // Tier 1: Double shot (make both primary for simplicity)
        bullets.push(createBullet(0, 8, 0, true));
        bullets.push(createBullet(0, -8, 0, true));
    }
    else {
        // Tier 0: Single shot (Primary)
        bullets.push(createBullet(0, 0, 0, true));
    }

    // --- ASTEROID EXPULSION LOGIC REMOVED ---
}

function enemyShoot(e, tx, ty) {
    // e.x, e.y, tx, ty are ABSOLUTE WORLD COORDINATES

    if (tx === undefined) tx = worldOffsetX;
    if (ty === undefined) ty = worldOffsetY;

    let trajectoryAngle = Math.atan2(ty - e.y, tx - e.x); // Correct angle in world space

    // --- RESTRICCIÓN DE CONO DE FUEGO ENEMIGO (Nave Enemiga) ---
    let angleDiff = trajectoryAngle - e.a;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

    const FIRE_CONE = Math.PI / 12; // 15 grados en radianes

    if (Math.abs(angleDiff) > FIRE_CONE) {
        // El objetivo está fuera del cono frontal de fuego, NO DISPARAR.
        return;
    }
    // --- FIN RESTRICCIÓN DE CONO DE FUEGO ---


    // AI CHECK: Avoid friendly fire (Implemented in last version, kept here)
    let clearShot = true;

    for (let other of enemies) {
        if (other === e) continue;
        let distToOther = Math.hypot(other.x - e.x, other.y - e.y); // World distance
        let distToTarget = Math.hypot(tx - e.x, ty - e.y); // World distance

        // If the friend is closer than the target (potential block)
        if (distToOther < distToTarget) {
            let angleToOther = Math.atan2(other.y - e.y, other.x - e.x);
            let checkAngleDiff = Math.abs(trajectoryAngle - angleToOther);
            if (checkAngleDiff > Math.PI) checkAngleDiff = 2 * Math.PI - checkAngleDiff;

            // If friend is within a 20-degree cone (approx 0.35 rad) of the firing line
            if (checkAngleDiff < 0.35) {
                clearShot = false;
                break;
            }
        }
    }

    if (clearShot) {
        trajectoryAngle += (Math.random() - 0.5) * 0.2; // Natural slight imprecision

        // SOLICITADO POR EL USUARIO: El disparo debe originarse en el vértice delantero de la nave (e.a)
        const spawnX = e.x + e.r * Math.cos(e.a); // World Coordinate X (Nose of the ship)
        const spawnY = e.y + e.r * Math.sin(e.a); // World Coordinate Y (Nose of the ship)

        enemyBullets.push({
            x: spawnX,
            y: spawnY,
            xv: 400 * Math.cos(trajectoryAngle) / FPS, // Velocity uses trajectory angle
            yv: 400 * Math.sin(trajectoryAngle) / FPS,
            dist: 0,
            life: BULLET_LIFETIME,
            size: PRIMARY_BULLET_SIZE
        });
    }
}

function createExplosion(vpX, vpY, n, color = 'white', sizeBase = 1, type = 'spark') {
    // Particle system for explosions (uses VIEWPORT coordinates for display)
    for (let i = 0; i < n; i++) {
        // Particles must store their ABSOLUTE WORLD POSITION 
        const pWorldX = vpX - width / 2 + worldOffsetX;
        const pWorldY = vpY - height / 2 + worldOffsetY;

        let life = 30 + Math.random() * 20; let speed = 10;
        if (type === 'debris') { life = 60 + Math.random() * 40; speed = 3; }

        // Particle velocity (xv, yv) is relative to the world
        particles.push({
            x: pWorldX,
            y: pWorldY,
            xv: (Math.random() - 0.5) * speed,
            yv: (Math.random() - 0.5) * speed,
            life,
            color,
            size: Math.random() * 2 + sizeBase,
            type
        });
    }
}

function createShockwave(worldX, worldY) {
    // Creates a pulse that pushes nearby objects
    shockwaves.push({ x: worldX, y: worldY, r: 10, maxR: 1200, strength: 30, alpha: 1 });
}

function drawRadar() {
    // Renders the enemy/asteroid radar on the top right
    const rW = radarCanvas.width; const rH = radarCanvas.height;
    const cX = rW / 2; const cY = rH / 2;
    radarCtx.clearRect(0, 0, rW, rH);

    // Draw crosshair and boundary
    radarCtx.strokeStyle = 'rgba(0, 255, 255, 0.2)'; radarCtx.lineWidth = 1;
    radarCtx.beginPath(); radarCtx.moveTo(cX, 0); radarCtx.lineTo(cX, rH); radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.moveTo(0, cY); radarCtx.lineTo(rW, cY); radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.arc(cX, cY, rW / 2 - 1, 0, Math.PI * 2); radarCtx.stroke();
    radarCtx.fillStyle = '#0ff'; radarCtx.beginPath(); radarCtx.arc(cX, cY, 3, 0, Math.PI * 2); radarCtx.fill(); // Ship blip (center)

    const radarRadius = rW / 2;
    // La escala se basa en el rango visible (RADAR_RANGE)
    const scale = radarRadius / RADAR_RANGE;

    // Modificamos drawBlip para manejar diferentes tipos de objetos
    const drawBlip = (worldX, worldY, type, color, size) => {
        if (isNaN(worldX) || isNaN(worldY)) return;

        // 1. Calculate World Relative Position (in World Units)
        let dx = worldX - worldOffsetX; // Vector from Player to Object (in World Units)
        let dy = worldY - worldOffsetY;
        let dist = Math.sqrt(dx * dx + dy * dy); // World Distance

        // 2. Filter: Only draw if within RADAR_RANGE
        if (dist > RADAR_RANGE) return;

        // 3. Scale to Radar View
        let angle = Math.atan2(dy, dx);
        let radarDist = dist * scale;

        // CLAMPING: Ancla el blip al borde si está fuera del rango visible. 
        if (radarDist > radarRadius - size) {
            radarDist = radarRadius - size - 1;
        }

        let rx = cX + radarDist * Math.cos(angle);
        let ry = cY + radarDist * Math.sin(angle);

        // DIBUJO ESPECÍFICO POR TIPO
        radarCtx.fillStyle = color;
        radarCtx.strokeStyle = color;

        if (type === 'station') {
            // Estaciones espaciales como la letra 'O' roja
            radarCtx.font = "bold 12px Courier New";
            radarCtx.textAlign = 'center';
            radarCtx.textBaseline = 'middle';
            radarCtx.fillText('O', rx, ry);
        } else if (type === 'ship') {
            // Naves enemigas como puntos rojos (tamaño reducido para ser "puntos pequeños")
            radarCtx.beginPath();
            radarCtx.arc(rx, ry, 2, 0, Math.PI * 2); // Punto de 2px
            radarCtx.fill();
        } else if (type === 'planet') {
            // Planetas: Usa el color principal del planeta
            radarCtx.beginPath();
            radarCtx.arc(rx, ry, 4, 0, Math.PI * 2); // Punto más grande para planetas
            radarCtx.fill();
        } else {
            // Asteroides: Puntos grises
            radarCtx.beginPath();
            radarCtx.arc(rx, ry, 2, 0, Math.PI * 2);
            radarCtx.fill();
        }
    };

    // Dibuja enemigos (Amenazas)
    enemies.forEach(e => {
        if (e.type === 'station') {
            drawBlip(e.x, e.y, 'station', '#FF0000', 0);
        } else {
            drawBlip(e.x, e.y, 'ship', '#FF0000', 2);
        }
    });

    // Dibuja asteroides y planetas (Objetos)
    roids.forEach(r => {
        // MODIFICADO: Muestra todos los planetas, oculta solo los asteroides lejanos
        if (!r.isPlanet && r.z > 0.5) return;

        if (r.isPlanet) {
            // Planetas: Usa el color principal del planeta (waterColor)
            const color = r.textureData ? r.textureData.waterColor : 'rgba(0, 150, 255, 0.7)';
            drawBlip(r.x, r.y, 'planet', color, 4);
        } else {
            // Asteroides: Puntos grises
            drawBlip(r.x, r.y, 'asteroid', 'rgba(170, 170, 170, 0.7)', 2);
        }
    });
}

function drawLives() {
    livesDisplay.innerHTML = ''; // Limpiar iconos anteriores

    for (let i = 0; i < MAX_LIVES; i++) {
        const icon = document.createElement('div');
        icon.classList.add('ship-icon');
        if (i >= lives) {
            icon.classList.add('lost');
        }
        livesDisplay.appendChild(icon);
    }
}

function createAsteroidCluster(cx, cy, clusterRadius, count) {
    const clusterDriftVx = (Math.random() - 0.5) * 0.5;
    const clusterDriftVy = (Math.random() - 0.5) * 0.5;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * clusterRadius;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const r = 15 + Math.random() * 30; // smaller roids in clusters
        const roid = createAsteroid(x, y, r);

        // Add cluster drift
        roid.xv += clusterDriftVx;
        roid.yv += clusterDriftVy;

        roids.push(roid);
    }
}

function createAsteroidBelt(cx, cy, innerRadius, outerRadius, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const r = 20 + Math.random() * 40;
        const roid = createAsteroid(x, y, r);

        // Small tangential velocity to give a sense of belt movement
        const orbitalSpeed = 0.2 + Math.random() * 0.3;
        const tangentAngle = angle + Math.PI / 2;
        roid.xv += Math.cos(tangentAngle) * orbitalSpeed * (Math.random() < 0.5 ? 1 : -1);
        roid.yv += Math.sin(tangentAngle) * orbitalSpeed * (Math.random() < 0.5 ? 1 : -1);

        roids.push(roid);
    }
}

function createBinaryAsteroid(cx, cy, r1, r2, dist, speed) {
    const angle = Math.random() * Math.PI * 2;
    const ax = cx + Math.cos(angle) * dist / 2;
    const ay = cy + Math.sin(angle) * dist / 2;
    const bx = cx - Math.cos(angle) * dist / 2;
    const by = cy - Math.sin(angle) * dist / 2;

    const roid1 = createAsteroid(ax, ay, r1);
    const roid2 = createAsteroid(bx, by, r2);

    const tangentAngle = angle + Math.PI / 2;
    const vx = Math.cos(tangentAngle) * speed;
    const vy = Math.sin(tangentAngle) * speed;

    roid1.xv += vx;
    roid1.yv += vy;
    roid2.xv -= vx;
    roid2.yv -= vy;

    roids.push(roid1, roid2);
}

// Función reinsertada para inicializar el nivel y poblar el mundo del juego
function createLevel() {
    // Reset and populate the world with initial asteroids
    roids = []; enemies = []; enemyBullets = []; bullets = []; shockwaves = [];

    let planetSpawned = false;
    // Try to spawn a planet not at the dead center, to make it more interesting
    let planetX = (Math.random() - 0.5) * 5000;
    let planetY = (Math.random() - 0.5) * 5000;
    roids.push(createAsteroid(planetX, planetY, PLANET_THRESHOLD + Math.random() * 100));
    planetSpawned = true;
    console.log(`Planet spawned at: (${planetX.toFixed(0)}, ${planetY.toFixed(0)})`);

    // Create a large asteroid belt
    createAsteroidBelt(0, 0, 7500, 12500, 750);

    // Create some clusters
    for (let i = 0; i < 3; i++) {
        const clusterX = (Math.random() - 0.5) * WORLD_BOUNDS;
        const clusterY = (Math.random() - 0.5) * WORLD_BOUNDS;
        if (Math.hypot(clusterX, clusterY) < 15000) continue; // Avoid belt
        createAsteroidCluster(clusterX, clusterY, 3000 + Math.random() * 2000, 100 + Math.random() * 100);
    }

    // Create some binary asteroids
    for (let i = 0; i < 15; i++) {
        const binaryX = (Math.random() - 0.5) * WORLD_BOUNDS;
        const binaryY = (Math.random() - 0.5) * WORLD_BOUNDS;
        if (Math.hypot(binaryX, binaryY) < 15000) continue; // Avoid belt
        createBinaryAsteroid(binaryX, binaryY, 20 + Math.random() * 20, 20 + Math.random() * 20, 100 + Math.random() * 50, 0.5 + Math.random());
    }

    // Add some sparse random asteroids
    let roidCount = 250 + level * 10;
    for (let i = 0; i < roidCount; i++) {
        let x, y, d, r;
        // Ensure asteroids spawn away from the center
        do {
            x = (Math.random() - 0.5) * WORLD_BOUNDS * 1.8;
            y = (Math.random() - 0.5) * WORLD_BOUNDS * 1.8;
            d = Math.sqrt(x ** 2 + y ** 2);
        } while (d < 15000);

        r = 20 + Math.random() * 80;

        // One more planet further out
        if (!planetSpawned || (i === Math.floor(roidCount / 2) && Math.random() < 0.3)) {
            if (d > 25000) {
                r = PLANET_THRESHOLD + Math.random() * 50;
                planetSpawned = true;
                console.log(`Outer Planet spawned at: (${x.toFixed(0)}, ${y.toFixed(0)}) with radius ${r}`);
            }
        }

        roids.push(createAsteroid(x, y, r));
    }

    // Fallback: If no planet was created (very unlikely)
    if (roids.filter(r => r.isPlanet).length === 0) {
        let x = WORLD_BOUNDS / 2; let y = WORLD_BOUNDS / 2;
        roids.push(createAsteroid(x, y, PLANET_THRESHOLD + 30));
        console.log("Fallback planet spawned.");
    }
}

// REFRACTORIZADO: Función para manejar el daño al jugador (basado en structureHP)
function hitShip(damageAmount, sourceIsNearPlanet = false) {
    if (ship.blinkNum > 0 || ship.dead) return;

    // Reducir estructura (un golpe = una capa de defensa)
    ship.structureHP--;

    // Visual/Audio Feedback
    const vpX = width / 2; const vpY = height / 2;
    createExplosion(vpX, vpY, 10, '#0ff', 2);
    AudioEngine.playExplosion('small');

    // 3. Chequeo Estructural
    if (ship.structureHP <= 0) {
        ship.structureHP = 0;
        killShip();
    }
    else {
        ship.blinkNum = 15; // Activar invulnerabilidad temporal
        velocity.x *= -0.5; velocity.y *= -0.5; // Aplicar retroceso
    }
}


function killShip() {

    const vpX = width / 2; const vpY = height / 2;
    createExplosion(vpX, vpY, 60, '#0ff', 3);
    AudioEngine.playExplosion('large');
    ship.dead = true;

    lives--;
    drawLives();

    score -= 1000;
    scoreEl.innerText = score;

    if (lives > 0) setTimeout(() => {
        ship = newShip();
        velocity = { x: 0, y: 0 };
        drawLives(); // Actualizar vidas al respawn (por si el modo épico fue activado)
    }, 1500);
    else {
        // NEW: Apply Game Over background and start fade to black
        startScreen.style.display = 'flex';
        startScreen.classList.add('game-over-bg');

        // Game Over Text
        const instructions = document.querySelector('#start-screen .instructions');
        if (instructions) {
            instructions.innerHTML = '<div id="game-over-led"></div>';
            const gameOverEl = document.getElementById('game-over-led');
            const gameOverText = "Communication lost. Vital signs interrupted. Rest in eternity.";
            animateLedText(gameOverText, gameOverEl);
        }

        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.innerText = 'RESTART';
            startBtn.onclick = () => location.reload();
        }

        AudioEngine.setTrack('menu');
        AudioEngine.startMusic();

        // Reset opacity before fading out
        startScreen.classList.remove('fade-out');

        // We need a very short delay to make sure the browser applies the `game-over-bg` and `fade-out-removed` before adding `fade-out` back.
        setTimeout(() => {
            startScreen.classList.add('fade-out');
        }, 100);
    }
}

// REMOVED: No more wrapObject function to enforce hard boundaries

function updatePhysics() {
    let nearbyGravity = false;

    for (let i = 0; i < roids.length; i++) {
        let r1 = roids[i];
        if (isNaN(r1.x) || isNaN(r1.y)) { roids.splice(i, 1); i--; continue; }

        // 1. SMOOTH RADIUS GROWTH (NEW IMPLEMENTATION)
        if (r1.targetR && r1.r < r1.targetR) {
            // Interpolate towards the target radius (2% of the remaining difference per frame)
            r1.r += (r1.targetR - r1.r) * 0.02;
            // Update mass proportionally to R^2 for accurate physics:
            r1.mass = r1.r * r1.r * 0.05;

            // If close enough, snap to target and clear flag
            if (r1.targetR - r1.r < 1.0) {
                r1.r = r1.targetR;
                r1.targetR = null;
                r1.mass = r1.r * r1.r * 0.05; // Final mass snap
            }
        } else {
            // If no target (initial state), ensure mass is calculated from current R
            r1.mass = r1.r * r1.r * 0.05;
        }

        // Apply Z-depth movement (Parallax for planets)
        if (r1.isPlanet) {
            // Movimiento oscilatorio Z
            r1.z += r1.zSpeed;
            // REVERTIR MOVIMIENTO Z AL LLEGAR AL LÍMITE REDUCIDO
            if (r1.z > MAX_Z_DEPTH) r1.zSpeed *= -1;
            if (r1.z < 0) { r1.z = 0; r1.zSpeed = Math.abs(r1.zSpeed); }
        }

        // Decrease asteroid invulnerability frames
        if (r1.blinkNum > 0) r1.blinkNum--;

        // --- Gravity Check on Player (Feathering near center) ---
        if (r1.isPlanet && r1.z < 0.5) { // Solo si el planeta está en el plano cercano
            // dx, dy are the vector from the Planet to the Player (in World Units)
            let dx = worldOffsetX - r1.x;
            let dy = worldOffsetY - r1.y;
            let distSq = dx * dx + dy * dy;
            let dist = Math.sqrt(distSq);

            // Gravedad solo activa en la zona de influencia y fuera del radio de la nave (para evitar atascos)
            if (dist < r1.r * 8 && dist > ship.r) {
                nearbyGravity = true;

                // Inverse square law for gravity: F = G * M / D^2
                let clampedDistSq = Math.max(distSq, 100);

                // Feathering factor to smoothly drop force to zero at the ship's center
                let effectiveDist = Math.max(0, dist - ship.r);
                let feather = effectiveDist / (r1.r * 8);
                feather = Math.min(1, feather * 5);

                let force = (G_CONST * r1.mass) / clampedDistSq;

                // Apply force to player's velocity, scaled by the feathering factor
                // Note: Sign pulls the player (velocity) TOWARDS the planet (r1)
                velocity.x += (dx / dist) * force * 1.5 * feather;
                velocity.y += (dy / dist) * force * 1.5 * feather;
            }
        }
        // --- End Gravity Check ---

        // --- Asteroid/Planet Collision and Merge (All in World Coords) ---
        for (let j = i + 1; j < roids.length; j++) {
            let r2 = roids[j];
            if (isNaN(r2.x) || isNaN(r2.y)) { roids.splice(j, 1); j--; continue; }

            // Skip collision check if either asteroid is blinking (newly created by player)
            if (r1.blinkNum > 0 || r2.blinkNum > 0) continue;

            let dx = r2.x - r1.x; let dy = r2.y - r1.y; // World Distance Vector
            let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);

            if (dist < r1.r + r2.r) {
                const vpX = r1.x - worldOffsetX + width / 2;
                const vpY = r1.y - worldOffsetY + height / 2;

                // 1. Planet-Planet Collision
                if (r1.isPlanet && r2.isPlanet) {
                    if (Math.abs(r1.z - r2.z) < 0.1) { // Same Z-level check
                        createExplosion(vpX, vpY, 80, '#ffaa00', 5, 'spark');
                        createExplosion(vpX, vpY, 40, '#ff0000', 8, 'debris');
                        AudioEngine.playExplosion('large');
                        for (let k = 0; k < 50; k++) {
                            let ast = createAsteroid((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 15 + Math.random() * 60);
                            let ang = Math.random() * Math.PI * 2;
                            let spd = 0.5 + Math.random() * 2;
                            ast.xv = Math.cos(ang) * spd; ast.yv = Math.sin(ang) * spd;
                            roids.push(ast);
                        }
                        createShockwave((r1.x + r2.x) / 2, (r1.y + r2.y) / 2);

                        roids.splice(j, 1);
                        roids.splice(i, 1);
                        i--; break; // Exit j-loop
                    }
                }
                // 2. Planet-Asteroid and Asteroid-Asteroid collisions (only on near Z plane)
                else if (Math.abs(r1.z) < 0.5 && Math.abs(r2.z) < 0.5) {
                    // Planet-Asteroid Coalescence
                    if (r1.isPlanet !== r2.isPlanet) {
                        let planet, asteroid, asteroidIndex;
                        if (r1.isPlanet) { planet = r1; asteroid = r2; asteroidIndex = j; }
                        else { planet = r2; asteroid = r1; asteroidIndex = i; let temp = r1; r1 = r2; r2 = temp; asteroidIndex = j; }

                        let area1 = Math.PI * planet.r * planet.r;
                        let area2 = Math.PI * asteroid.r * asteroid.r;
                        let totalArea = area1 + area2;
                        let newR = Math.sqrt(totalArea / Math.PI);
                        let totalMass = planet.mass + asteroid.mass;
                        let newVX = (planet.xv * planet.mass + asteroid.xv * asteroid.mass) / totalMass;
                        let newVY = (planet.yv * planet.mass + asteroid.yv * asteroid.mass) / totalMass;
                        let newX = (planet.x * planet.mass + asteroid.x * asteroid.mass) / totalMass;
                        let newY = (planet.y * planet.mass + asteroid.y * asteroid.mass) / totalMass;

                        r1.x = newX; r1.y = newY;
                        r1.xv = newVX; r1.yv = newVY;
                        r1.targetR = newR; r1.r = newR;
                        r1.mass = totalMass * 0.05;

                        roids.splice(asteroidIndex, 1);
                        i--; // Compensate for removal

                        console.log(`Planeta ${r1.name} absorbió asteroide. Nuevo R=${newR.toFixed(1)}`);
                        createExplosion(vpX, vpY, 20, '#00ffff', 3);
                        AudioEngine.playExplosion('large');
                        break;
                    }
                    // Asteroid-Asteroid Merge
                    else {
                        let totalMass = r1.mass + r2.mass;
                        let newVX = (r1.xv * r1.mass + r2.xv * r2.mass) / totalMass;
                        let newVY = (r1.yv * r1.mass + r2.yv * r2.mass) / totalMass;
                        // BONUS CRECIMIENTO: 5% extra de radio al fusionar
                        let newR = Math.sqrt(r1.r * r1.r + r2.r * r2.r) * 1.05;

                        const DAMPENING_FACTOR = 0.5;
                        if (newR > PLANET_THRESHOLD) { newVX *= DAMPENING_FACTOR; newVY *= DAMPENING_FACTOR; }

                        let newX = (r1.x * r1.mass + r2.x * r2.mass) / totalMass;
                        let newY = (r1.y * r1.mass + r2.y * r2.mass) / totalMass;

                        r1.x = newX; r1.y = newY;
                        r1.xv = newVX; r1.yv = newVY;
                        r1.targetR = newR;

                        if (newR > PLANET_THRESHOLD && !r1.isPlanet) {
                            r1.r = newR;
                            initializePlanetAttributes(r1);
                            r1.targetR = newR;
                            console.log(`¡NUEVO PLANETA! Nombre: ${r1.name}, ID: ${r1.textureData.seed}.`);
                            createExplosion(vpX, vpY, 30, '#fff', 5);
                            AudioEngine.playExplosion('large');
                        } else if (r1.isPlanet) {
                            r1.r = newR;
                            r1.mass = totalMass * 0.05;
                            console.log(`Planeta ${r1.name} (ID: ${r1.textureData.seed}) CRECE a R=${newR.toFixed(1)}`);
                        }
                        roids.splice(j, 1); j--; continue;
                    }
                }
            }

            // --- Gravitational Attraction between Roids/Planets (World Coords) ---
            if (r1.blinkNum === 0 && r2.blinkNum === 0 && dist > 10) {
                let force = 0;
                let G = G_CONST;

                if (r1.isPlanet || r2.isPlanet) {
                    // Gravedad fuerte para objetos grandes
                    force = (G * r1.mass * r2.mass) / Math.max(distSq, 500);
                } else {
                    // Gravedad más fuerte y rango cercano más agresivo (USER REQUEST)
                    let G_ROIDS = 0.08;
                    force = (G_ROIDS * r1.mass * r2.mass) / Math.max(distSq, 400);
                }

                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                if (!isNaN(fx) && !isNaN(fy)) {
                    r1.xv += fx / r1.mass;
                    r1.yv += fy / r1.mass;
                    r2.xv -= fx / r2.mass;
                    r2.yv -= fy / r2.mass;
                }
            }
        }
    }
    // Display gravity warning if applicable
    if (nearbyGravity) gravityAlert.style.display = 'block'; else gravityAlert.style.display = 'none';
}

// NEW: Function to draw planetary rings (fixed attributes, dynamic scale)
function drawRings(ctx, rings, planetRadius, depthScale) {
    // Draw rings as a series of thin ellipses
    ctx.save();

    ctx.rotate(rings.tilt);

    // Draw each band
    rings.bands.forEach(band => {
        // Calculate actual radius and width based on current planet size (planetRadius)
        const bandRadius = planetRadius * band.rRatio;
        const bandWidth = planetRadius * band.wRatio;

        const outerRadius = bandRadius * depthScale;

        // Draw a thick line approach for simplicity and aesthetics
        ctx.lineWidth = bandWidth * depthScale;
        ctx.strokeStyle = band.color;
        ctx.globalAlpha = band.alpha * depthScale; // Use depthScale as alpha factor
        ctx.shadowBlur = 0; // Disable shadow for rings

        // Back half of the ellipse (hidden behind the planet) is drawn first
        ctx.beginPath();
        // The height of the ellipse is scaled by a factor (e.g., 0.15) to simulate perspective tilt
        ctx.ellipse(0, 0, outerRadius, outerRadius * 0.15, 0, 0, Math.PI, false);
        ctx.stroke();

    });

    ctx.restore();
}

function loop() {
    if (!gameRunning) return;

    // Decrement player reload timer
    if (playerReloadTime > 0) playerReloadTime--;

    // Safety check against NaN/Infinity in velocity calculation
    if (isNaN(velocity.x) || isNaN(velocity.y) || !isFinite(velocity.x) || !isFinite(velocity.y)) {
        velocity = { x: 0, y: 0 };
        console.log("Velocity stabilization system activated");
    }

    // Enemy station spawning: now tied to stationSpawnTimer and presence of ANY planet
    if (stationSpawnTimer > 0) stationSpawnTimer--;
    if (stationSpawnTimer <= 0 && enemies.length < 3) {
        spawnStation();
        // The timer is set inside spawnStation now (either 1200+ or 300 if no planets found)
    }

    // Función de seguridad para validar coordenadas
    const isSafe = (obj) => !isNaN(obj.x) && !isNaN(obj.y) && isFinite(obj.x) && isFinite(obj.y);

    // Limpia cualquier objeto con coordenadas inválidas (NaN o Infinity)
    roids = roids.filter(isSafe);
    enemies = enemies.filter(isSafe);
    bullets = bullets.filter(isSafe);
    enemyBullets = enemyBullets.filter(isSafe);

    // Clear canvas
    ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, width, height);

    // --- Ship Movement and World Boundary Check ---
    if (!ship.dead) {
        // ... (Ship Movement Physics remains the same) ...
        if (inputMode === 'mouse') { // Mouse/Pointer control: rotate towards cursor
            const dx = mouse.x - width / 2; const dy = -(mouse.y - height / 2);
            ship.a = Math.atan2(dy, dx);
        }
        else {
            // Keyboard/Touch swipe control: Arrow keys handle rotation
            if (keys.ArrowLeft) ship.a += 0.1; if (keys.ArrowRight) ship.a -= 0.1;
        }
        ship.thrusting = keys.ArrowUp;

        // 1. Calculate desired displacement vector
        let deltaX = 0;
        let deltaY = 0;
        const strafeMultiplier = 0.7; // 70% power for strafing

        // Propulsión frontal/trasera (W/S)
        if (ship.thrusting) {
            deltaX += SHIP_THRUST * Math.cos(ship.a);
            deltaY -= SHIP_THRUST * Math.sin(ship.a);
            if (Math.random() < 0.2) AudioEngine.playThrust();
        }

        // Desplazamiento lateral / Strafe (A/D)
        if (keys.KeyA) { // Strafe Izquierda (perpendicular a la izquierda: ship.a + PI/2)
            const strafeAngle = ship.a + Math.PI / 2;
            deltaX += SHIP_THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY -= SHIP_THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust();
        }
        if (keys.KeyD) { // Strafe Derecha (perpendicular a la derecha: ship.a - PI/2)
            const strafeAngle = ship.a - Math.PI / 2;
            deltaX += SHIP_THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY -= SHIP_THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust();
        }


        // 2. Update instantaneous velocity (in World Units/Frame)
        velocity.x += deltaX;
        velocity.y += deltaY;

        // Apply braking/friction
        if (keys.ArrowDown) { velocity.x *= 0.92; velocity.y *= 0.92; }
        else { velocity.x *= FRICTION; velocity.y *= FRICTION; }

        // Limit max speed
        const currentSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (currentSpeed > MAX_SPEED) { const ratio = MAX_SPEED / currentSpeed; velocity.x *= ratio; velocity.y *= ratio; }

        // 3. Update Player's World Position (worldOffsetX/Y)
        let nextWorldX = worldOffsetX + velocity.x;
        let nextWorldY = worldOffsetY + velocity.y;

        // NEW: Directional Shadow Calculation
        let shadow = [];
        const SHADOW_SIZE = 50; // Size of the inset shadow border

        // X Boundary Check (includes dampening near the edge)
        if (Math.abs(nextWorldX) > WORLD_BOUNDS) {
            velocity.x *= BOUNDARY_DAMPENING;
            if (Math.abs(worldOffsetX) >= WORLD_BOUNDS) {
                velocity.x = 0; // Stop movement at the edge
                worldOffsetX = nextWorldX > 0 ? WORLD_BOUNDS : -WORLD_BOUNDS; // Cap position
            } else {
                worldOffsetX = nextWorldX;
            }
        } else {
            worldOffsetX = nextWorldX;
        }

        // Y Boundary Check (includes dampening near the edge)
        if (Math.abs(nextWorldY) > WORLD_BOUNDS) {
            velocity.y *= BOUNDARY_DAMPENING;
            if (Math.abs(worldOffsetY) >= WORLD_BOUNDS) {
                velocity.y = 0; // Stop movement at the edge
                worldOffsetY = nextWorldY > 0 ? WORLD_BOUNDS : -WORLD_BOUNDS; // Cap position
            } else {
                worldOffsetY = nextWorldY;
            }
        } else {
            worldOffsetY = nextWorldY;
        }

        // 4. Visual Boundary Alert (Directional)
        const RED_GLOW = 'rgba(255, 0, 0, 0.7)';

        // Check Right Boundary (Positive X)
        if (worldOffsetX >= WORLD_BOUNDS - BOUNDARY_TOLERANCE) {
            shadow.push(`${-SHADOW_SIZE}px 0 0 0 ${RED_GLOW} inset`);
        }
        // Check Left Boundary (Negative X)
        if (worldOffsetX <= -WORLD_BOUNDS + BOUNDARY_TOLERANCE) {
            shadow.push(`${SHADOW_SIZE}px 0 0 0 ${RED_GLOW} inset`);
        }
        // Check Bottom Boundary (Positive Y)
        if (worldOffsetY >= WORLD_BOUNDS - BOUNDARY_TOLERANCE) {
            shadow.push(`0 ${-SHADOW_SIZE}px 0 0 ${RED_GLOW} inset`);
        }
        // Check Top Boundary (Negative Y)
        if (worldOffsetY <= -WORLD_BOUNDS + BOUNDARY_TOLERANCE) {
            shadow.push(`0 ${SHADOW_SIZE}px 0 0 ${RED_GLOW} inset`);
        }

        if (shadow.length > 0) {
            boundaryAlertEl.style.boxShadow = shadow.join(', ');
        } else {
            boundaryAlertEl.style.boxShadow = 'none';
        }

        // NEW: Adjust player ship HP if they transition to Tier 8
        const currentTier = getShipTier();
        if (currentTier < 8 && ship.structureHP === MAX_TIER_HP) {
            // If tier drops below 8 (by losing score), reset HP to standard max
            ship.structureHP = STANDARD_SHIP_HP;
            console.log("Player ship HP normalized to standard structure HP (3).");
        }

    }
    // --- End Ship Movement and World Boundary Check ---

    // Obtener el nivel de evolución de la nave para el dibujo (FIX para ReferenceError)
    const tier = getShipTier();

    // The music is permanently stopped in 'game' mode

    // --- Shockwave Update (All in World Coords) ---
    shockwaves.forEach((sw, index) => {
        sw.r += 15; sw.alpha -= 0.01;
        if (sw.alpha <= 0) { shockwaves.splice(index, 1); return; }

        // Calculate Viewport Position for drawing
        const vpX = sw.x - worldOffsetX + width / 2;
        const vpY = sw.y - worldOffsetY + height / 2;

        ctx.beginPath(); ctx.arc(vpX, vpY, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 200, 50, ${sw.alpha})`; ctx.lineWidth = 5; ctx.stroke();

        // Apply force to asteroids, enemies, and player (Force is World Units)
        const applyShockwaveForce = (obj) => {
            let dx = obj.x - sw.x; let dy = obj.y - sw.y; // World Distance Vector
            let dist = Math.sqrt(dx * dx + dy * dy);
            // Check if object is within the shockwave's radius band
            if (Math.abs(dist - sw.r) < 30) {
                let angle = Math.atan2(dy, dx);
                let force = sw.strength * (1 - dist / sw.maxR);
                if (force > 0) { obj.xv += Math.cos(angle) * force * 0.1; obj.yv += Math.sin(angle) * force * 0.1; }
            }
        }
        roids.forEach(applyShockwaveForce);
        enemies.forEach(applyShockwaveForce);

        // Player knockback from shockwave
        let dx = worldOffsetX - sw.x; let dy = worldOffsetY - sw.y; // World Distance Vector
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - sw.r) < 30) {
            let angle = Math.atan2(dy, dx);
            let force = sw.strength * (1 - dist / sw.maxR);
            if (force > 0) { velocity.x += Math.cos(angle) * force * 0.05; velocity.y += Math.sin(angle) * force * 0.05; }
        }
    });

    // --- Ambient Fog Drawing ---
    ctx.globalCompositeOperation = 'screen';
    for (let i = ambientFogs.length - 1; i >= 0; i--) {
        let f = ambientFogs[i];

        // Fog position is in Viewport Coordinates, so update as before
        f.x += f.xv; f.y += f.yv; // Absolute movement (slow drift)
        f.x -= velocity.x; // Parallax/Camera movement
        f.y -= velocity.y;

        f.life--;
        // Check if fog is off-screen or lifetime expired
        if (f.life <= 0 || f.x < -f.r * 0.5 || f.x > width + f.r * 0.5 || f.y > height + f.r * 0.5 || f.y < -f.r * 0.5) {
            ambientFogs.splice(i, 1);
            if (ambientFogs.length < 3) ambientFogs.push(createAmbientFog());
            continue;
        }

        let g = ctx.createRadialGradient(f.x, f.y, f.r * 0.1, f.x, f.y, f.r);
        g.addColorStop(0, `hsla(${f.hue}, 80%, 40%, ${f.alpha})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; // Reset blend mode

    // --- Background Parallax Drawing ---
    const moveLayer = (list, factor) => list.forEach(item => {
        // Background items use VIEWPORT coordinates for display, so update with velocity
        item.x -= velocity.x * factor; item.y -= velocity.y * factor;
    });

    ctx.globalCompositeOperation = 'screen';
    moveLayer(backgroundLayers.nebulas, 0.05);
    backgroundLayers.nebulas.forEach(n => {
        let g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 80%, 40%, ${n.alpha})`); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    // Draw distant galaxies
    backgroundLayers.galaxies.forEach(g => {
        g.x -= velocity.x * 0.1; g.y -= velocity.y * 0.1;
        g.angle += 0.001;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle);
        ctx.shadowBlur = 30; ctx.shadowColor = `rgb(${g.color.r},${g.color.g},${g.color.b})`;
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        g.stars.forEach(s => { ctx.fillStyle = `rgba(${g.color.r},${g.color.g},${g.color.b}, ${s.alpha})`; ctx.beginPath(); ctx.arc(s.r * Math.cos(s.theta), s.r * Math.sin(s.theta), s.size, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore(); ctx.shadowBlur = 0;
    });
    // Draw starfield parallax layers
    moveLayer(backgroundLayers.starsFar, 0.1); moveLayer(backgroundLayers.starsMid, 0.4); moveLayer(backgroundLayers.starsNear, 0.8);
    const drawStars = (list, c) => { ctx.fillStyle = c; list.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size)); };
    drawStars(backgroundLayers.starsFar, '#555'); drawStars(backgroundLayers.starsMid, '#888'); drawStars(backgroundLayers.starsNear, '#fff');

    updatePhysics(); // Run asteroid merging and gravity simulation (uses World Coords)

    ctx.shadowBlur = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // --- Enemy Update and MOVEMENT/AI (Separated from Drawing for Z-order) ---
    let enemiesToDraw = [];
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];

        const cullRange = WORLD_BOUNDS * 1.5;
        if (Math.hypot(e.x - worldOffsetX, e.y - worldOffsetY) > cullRange) {
            enemies.splice(i, 1);
            continue;
        }

        if (e.blinkNum > 0) e.blinkNum--;

        // 1. MOVIMIENTO ORBITAL (All in World Coords)
        let isOrbiting = false;
        if (e.type === 'station' && e.hostPlanet) {
            const host = roids.find(r => r === e.hostPlanet);
            if (!host) {
                e.hostPlanet = null;
                e.xv = (Math.random() - 0.5) * 0.5; e.yv = (Math.random() - 0.5) * 0.5;
            } else {
                // Actualizar la posición orbital
                e.orbitAngle += e.orbitSpeed;
                const dx_orbit = Math.cos(e.orbitAngle) * e.orbitDistance;
                const dy_orbit = Math.sin(e.orbitAngle) * e.orbitDistance;

                // Forzar la posición de la estación a ser la del host + el offset orbital.
                e.x = host.x + dx_orbit;
                e.y = host.y + dy_orbit;
                e.z = host.z; // Sync Z-depth (since planets oscillate)

                e.xv = host.xv;
                e.yv = host.yv;

                isOrbiting = true;

                // USER REQUEST: Recover shield and make station effectively "gone" if far away
                if (e.z >= 0.5) {
                    if (e.structureHP < MAX_TIER_HP) {
                        e.structureHP = MAX_TIER_HP;
                        console.log("Station shield recovered in hyperspace (far Z).");
                    }
                }
            }
        }

        if (!isOrbiting) {
            e.x += e.xv;
            e.y += e.yv;
        }

        // Calculate Viewport Position for drawing (WITH PARALLAX)
        let depthScale = 1;
        if (e.z > 0) {
            depthScale = 1 / (1 + e.z);
        }

        const vpX = (e.x - worldOffsetX) * depthScale + width / 2;
        const vpY = (e.y - worldOffsetY) * depthScale + height / 2;

        // 2. Collision Check with Asteroids
        for (let k = 0; k < roids.length; k++) {
            let r = roids[k];
            if (r.z > 0.5) continue;

            if ((e.type === 'station' && e.hostPlanet && r === e.hostPlanet) || e.blinkNum > 0) {
                continue; // Skip collision check for the orbital anchor or if blinking
            }

            let dx = e.x - r.x; let dy = e.y - r.y; // World Distance Vector
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = e.r + r.r;

            if (dist < minDist) {
                // COLLISION CHECK Z-FILTER: Ignore if station/enemy is far away
                if (e.z > 0.5) continue;

                let angle = Math.atan2(dy, dx);
                let overlap = minDist - dist;

                e.x += Math.cos(angle) * overlap;
                e.y += Math.sin(angle) * overlap;

                e.xv += Math.cos(angle) * 2;
                e.yv += Math.sin(angle) * 2;

                // Collision Effects
                if (r.isPlanet) {
                    createExplosion(vpX, vpY, 10, '#ff0000', 2, 'spark');
                } else {
                    e.structureHP--;
                    e.shieldHitTimer = 10;
                    const rVpX = r.x - worldOffsetX + width / 2;
                    const rVpY = r.y - worldOffsetY + height / 2;
                    createExplosion(rVpX, rVpY, 5, '#aa00ff', 1, 'debris');
                    if (e.structureHP <= 0) {
                        createExplosion(vpX, vpY, 30, '#ffaa00', 3, 'spark');
                        enemies.splice(i, 1);
                        i--;
                        break;
                    }
                }
            }
        }
        if (i < 0) continue;

        // 3. Enemy AI/Movement/Rotation (IA agresiva)
        let threat = null; let minThreatDist = Infinity;
        if (!ship.dead) {
            // Player is ALWAYS a threat regardless of distance
            threat = { x: worldOffsetX, y: worldOffsetY };
            minThreatDist = Math.hypot(e.x - worldOffsetX, e.y - worldOffsetY);
        }

        // Check for closer asteroid threats (avoidance), but prioritize player if somewhat close?
        // NO, player is global target, BUT avoid asteroids if IMMINENT collision.
        for (let r of roids) {
            if (r.z > 0.5) continue;
            let d = Math.hypot(e.x - r.x, r.y - r.y);
            // Only switch threat to asteroid if it is REALLY close (imminent danger)
            if (d < 300 && d < minThreatDist && d > e.r + r.r) {
                threat = r;
                minThreatDist = d;
            }
        }

        if (e.type === 'station') {
            e.a += e.rotSpeed; e.spawnTimer--;
            if (e.spawnTimer <= 0) { enemyShoot(e, worldOffsetX, worldOffsetY); spawnShipFromStation(e); e.spawnTimer = 200 + Math.random() * 200; }
        } else {
            if (threat) {
                let targetAngle = Math.atan2(threat.y - e.y, threat.x - e.x);
                let angleDiff = targetAngle - e.a;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

                const ROT_SPEED_FAST = 0.1;
                const ROT_SPEED_PRECISE = 0.05;
                // Dynamic rotation speed: Fast if far off angle, precise if close
                const currentRotSpeed = Math.abs(angleDiff) > 0.5 ? ROT_SPEED_FAST : ROT_SPEED_PRECISE;

                if (Math.abs(angleDiff) > currentRotSpeed) {
                    e.a += Math.sign(angleDiff) * currentRotSpeed;
                } else {
                    e.a = targetAngle;
                }

                // CHASE LOGIC: Accelerate towards player if it's the player
                // We assume threat is player if minThreatDist > 500 (since asteroids are only picked up if < 500)
                // Or simply check if threat matches player coords.
                const isPlayer = (threat.x === worldOffsetX && threat.y === worldOffsetY);

                if (isPlayer) {
                    // Check if enemy is on screen (Visible)
                    const vpX = e.x - worldOffsetX + width / 2;
                    const vpY = e.y - worldOffsetY + height / 2;
                    const onScreen = vpX > -e.r && vpX < width + e.r && vpY > -e.r && vpY < height + e.r;

                    if (onScreen) {
                        // BRAKING LOGIC: If on screen, slow down to avoid collision
                        e.xv *= 0.95;
                        e.yv *= 0.95;
                    } else if (Math.abs(angleDiff) < 0.5) {
                        // CHASE LOGIC: If off screen, accelerate towards player
                        const THRUST_POWER = 25 / FPS; // FASTER PURSUIT (USER REQUEST)
                        e.xv += Math.cos(e.a) * THRUST_POWER;
                        e.yv += Math.sin(e.a) * THRUST_POWER;

                        // Clamp Speed
                        const currentSpeed = Math.hypot(e.xv, e.yv);
                        const ENEMY_MAX_SPEED = 18; // FASTER MAX SPEED (USER REQUEST)
                        if (currentSpeed > ENEMY_MAX_SPEED) {
                            e.xv = (e.xv / currentSpeed) * ENEMY_MAX_SPEED;
                            e.yv = (e.yv / currentSpeed) * ENEMY_MAX_SPEED;
                        }
                    }
                }

                if (e.reloadTime <= 0 && Math.abs(angleDiff) < 0.2) {
                    enemyShoot(e, threat.x, threat.y); e.reloadTime = 100 + Math.random() * 60;
                }
            } else {
                e.a = Math.atan2(e.yv, e.xv); // Si no hay amenaza, sigue mirando su dirección
            }
            e.reloadTime--;
        }

        // 4. Collision Check with Player (World Coords) (only logic, not drawing)
        if (!ship.dead && (!e.z || e.z < 0.5)) { // Z-CHECK: Only collide if near
            let distToPlayer = Math.hypot(worldOffsetX - e.x, worldOffsetY - e.y);
            if (distToPlayer < (ship.effectiveR || ship.r) + e.r + 10) {

                if (e.structureHP > 0) {
                    e.structureHP--;
                    e.shieldHitTimer = 10;
                    createExplosion(vpX, vpY, 20, '#ff0055', 2, 'spark');

                    hitShip(1);

                    let ang = Math.atan2(e.y - worldOffsetY, e.x - worldOffsetX);
                    e.x += Math.cos(ang) * 60; e.y += Math.sin(ang) * 60;

                } else {
                    enemies.splice(i, 1); i--;
                    scoreEl.innerText = score;
                    AudioEngine.playExplosion('large');
                }

                if (e.structureHP <= 0) {
                    let debrisColor = e.type === 'station' ? `hsl(${e.fleetHue}, 100%, 50%)` : `hsl(${e.fleetHue}, 100%, 40%)`;
                    createExplosion(vpX, vpY, 40, '#ffaa00', 3, 'spark'); createExplosion(vpX, vpY, 20, debrisColor, 4, 'debris');
                    if (e.type === 'station') { onStationDestroyed(); } else { score += 200; }
                    enemies.splice(i, 1); scoreEl.innerText = score; AudioEngine.playExplosion('large');
                }
            }
        }

        enemiesToDraw.push(e); // Add to drawing list

    }
    // --- End Enemy Update/AI ---

    ctx.shadowColor = '#ffffff'; ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5;

    // Ordenar los asteroides de Cercano a Lejano (Z baja a Z alta)
    roids.sort((a, b) => a.z - b.z);

    // --- Asteroid/Planet DRAWING (Order 1: Behind Enemies) ---
    for (let i = roids.length - 1; i >= 0; i--) {
        let r = roids[i];

        if (r.isPlanet) {
            const PLANET_BOUNDARY_MARGIN = 2000;
            const TURN_STRENGTH = 0.0002; // A small force to gradually steer the planet

            // Steer away from horizontal boundaries
            if (r.x > WORLD_BOUNDS - PLANET_BOUNDARY_MARGIN && r.xv > 0) {
                r.xv -= TURN_STRENGTH * (r.x - (WORLD_BOUNDS - PLANET_BOUNDARY_MARGIN));
            }
            if (r.x < -WORLD_BOUNDS + PLANET_BOUNDARY_MARGIN && r.xv < 0) {
                r.xv -= TURN_STRENGTH * (r.x - (-WORLD_BOUNDS + PLANET_BOUNDARY_MARGIN));
            }

            // Steer away from vertical boundaries
            if (r.y > WORLD_BOUNDS - PLANET_BOUNDARY_MARGIN && r.yv > 0) {
                r.yv -= TURN_STRENGTH * (r.y - (WORLD_BOUNDS - PLANET_BOUNDARY_MARGIN));
            }
            if (r.y < -WORLD_BOUNDS + PLANET_BOUNDARY_MARGIN && r.yv < 0) {
                r.yv -= TURN_STRENGTH * (r.y - (-WORLD_BOUNDS + PLANET_BOUNDARY_MARGIN));
            }

            // Cap planet speed to make them move slowly
            const MAX_PLANET_SPEED = 0.5;
            const speed = Math.hypot(r.xv, r.yv);
            if (speed > MAX_PLANET_SPEED) {
                r.xv = (r.xv / speed) * MAX_PLANET_SPEED;
                r.yv = (r.yv / speed) * MAX_PLANET_SPEED;
            }
        }

        let depthScale = 1; let depthAlpha = 1;

        // 1. Update Absolute World Position (World Coords)
        r.x += r.xv; r.y += r.yv;

        // 2. Calculate Parallax and Viewport Position
        let vpX, vpY;
        if (r.isPlanet) {
            // Parallax is applied to the viewport position calculation only
            depthScale = 1 / (1 + r.z);
            depthAlpha = Math.max(0.1, 1 - (r.z / MAX_Z_DEPTH));

            vpX = (r.x - worldOffsetX) * depthScale + width / 2;
            vpY = (r.y - worldOffsetY) * depthScale + height / 2;
        } else {
            // Standard asteroid: 1:1 scale
            vpX = r.x - worldOffsetX + width / 2;
            vpY = r.y - worldOffsetY + height / 2;
        }

        // CULLING LOGIC: Remove object if far from player
        const cullRange = Math.max(width, height) * WORLD_SCALE / 2 + r.r;
        if (!r.isPlanet) {
            if (Math.hypot(r.x - worldOffsetX, r.y - worldOffsetY) > cullRange) {
                // Solo eliminar asteroides si están fuera de los límites del mundo
                if (Math.abs(r.x) > WORLD_BOUNDS * 1.2 || Math.abs(r.y) > WORLD_BOUNDS * 1.2) {
                    roids.splice(i, 1);
                    continue;
                }
            }
        }

        // Apply transformations for depth
        ctx.save();
        ctx.translate(vpX, vpY); // Translate to Viewport Position
        ctx.scale(depthScale, depthScale);

        // Apply calculated depth alpha
        ctx.globalAlpha = depthAlpha;

        // Draw asteroid blinking if newly created
        if (r.blinkNum % 2 !== 0) { ctx.globalAlpha *= 0.3; }


        if (r.isPlanet) {

            // === DRAW PLANET RINGS (BACK HALF) ===
            if (r.rings) {
                drawRings(ctx, r.rings, r.r, depthScale);
            }

            // Draw planet texture and name
            ctx.shadowBlur = 30; ctx.shadowColor = r.textureData.atmosphereColor;
            drawPlanetTexture(ctx, 0, 0, r.r, r.textureData); // Draw relative to translated origin

            // === DRAW PLANET RINGS (FRONT HALF) ===
            if (r.rings) {
                ctx.save();
                ctx.rotate(r.rings.tilt);
                r.rings.bands.forEach(band => {
                    const bandRadius = r.r * band.rRatio;
                    const bandWidth = r.r * band.wRatio;
                    const outerRadius = bandRadius * depthScale;

                    ctx.lineWidth = bandWidth * depthScale;
                    ctx.strokeStyle = band.color;
                    ctx.globalAlpha = band.alpha * depthAlpha;
                    ctx.shadowBlur = 0;

                    ctx.beginPath();
                    ctx.ellipse(0, 0, outerRadius, outerRadius * 0.15, 0, Math.PI, Math.PI * 2, false);
                    ctx.stroke();
                });
                ctx.restore();
            }

            // Draw Name
            ctx.globalAlpha = depthAlpha;
            ctx.fillStyle = 'white';
            ctx.font = `${14 / depthScale}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillText(r.name, 0, r.r + (30 / depthScale));

        } else {
            // Draw standard asteroid shape
            ctx.shadowBlur = 10; ctx.shadowColor = 'white'; ctx.strokeStyle = 'white';
            ctx.beginPath(); for (let j = 0; j < r.vert; j++) ctx.lineTo(r.r * r.offs[j] * Math.cos(r.a + j * Math.PI * 2 / r.vert), r.r * r.offs[j] * Math.sin(r.a + j * Math.PI * 2 / r.vert)); ctx.closePath(); ctx.stroke();
        }
        ctx.restore(); // Restore context

        // Check collision with player (World Coords)
        if (r.z < 0.5 && !ship.dead) {
            let distToPlayer = Math.hypot(r.x - worldOffsetX, r.y - worldOffsetY);
            if (distToPlayer < (ship.effectiveR || ship.r) + r.r * depthScale) {

                const isNearPlanetCollision = r.isPlanet && r.z < 0.5;

                // --- PLANET COLLISION LOGIC: PASS-THROUGH ---
                if (r.isPlanet) {
                    continue;
                }
                // --- END PLANET COLLISION LOGIC ---

                // ASTEROID COLLISION: Player takes 1 hit, asteroid is destroyed.
                if (r.blinkNum === 0) {
                    hitShip(1, isNearPlanetCollision);

                    // Destruir asteroide
                    createExplosion(vpX, vpY, 15, '#0ff', 2, 'spark');
                    createExplosion(vpX, vpY, 8, '#fff', 1, 'debris');
                    roids.splice(i, 1);

                    let ang = Math.atan2(r.y - worldOffsetY, r.x - worldOffsetX); // World Angle
                    r.x += Math.cos(ang) * 50; r.y += Math.sin(ang) * 50; // Knockback in World Coords (though it's removed next frame)
                }
            }
        }
    }
    // --- End Asteroid Drawing ---

    // --- Enemy DRAWING (Order 2: In Front of Planets) ---
    enemiesToDraw.forEach(e => {
        let depthScale = 1; let depthAlpha = 1;
        if (e.z > 0) {
            depthScale = 1 / (1 + e.z);
            depthAlpha = Math.max(0.1, 1 - (e.z / MAX_Z_DEPTH));
        }

        const vpX = (e.x - worldOffsetX) * depthScale + width / 2;
        const vpY = (e.y - worldOffsetY) * depthScale + height / 2;

        // Drawing enemy
        ctx.shadowBlur = 15;

        // If blinking, reduce opacity (for invulnerability feedback)
        if (e.blinkNum % 2 !== 0) { ctx.globalAlpha = 0.5; }
        else { ctx.globalAlpha = depthAlpha; } // Apply depth alpha

        ctx.save();
        ctx.translate(vpX, vpY); // Translate to Viewport Position
        ctx.scale(depthScale, depthScale); // Apply depth scaling
        ctx.rotate(e.a);

        if (e.type === 'ship') {
            const color = `hsl(${e.fleetHue}, 100%, 70%)`;
            const darkColor = `hsl(${e.fleetHue}, 60%, 30%)`;
            const detailColor = `hsl(${(e.fleetHue + 180) % 360}, 80%, 60%)`;

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(e.r, 0);
            ctx.lineTo(-e.r / 2, e.r / 2);
            ctx.lineTo(-e.r / 2, -e.r / 2);
            ctx.closePath();
            ctx.fillStyle = darkColor;
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = `hsl(${e.fleetHue + 40}, 100%, 50%)`;
            ctx.fillRect(-e.r / 2 - 5, -e.r / 4, 5, e.r / 4);
            ctx.fillRect(-e.r / 2 - 5, 0, 5, e.r / 4);
            ctx.fillStyle = detailColor;
            ctx.beginPath();
            ctx.arc(e.r / 2, 0, 3, 0, Math.PI * 2);
            ctx.fillRect(0, e.r / 3 - 5, 5, 5);
            ctx.fillRect(0, -e.r / 3, 5, 5);
            ctx.fill();

        }
        else {
            const haloColor = `hsl(${e.fleetHue}, 100%, 70%)`;
            const bodyColor = `hsl(${e.fleetHue}, 80%, 50%)`;
            const coreColor = `hsl(${(e.fleetHue + 120) % 360}, 100%, 60%)`;

            ctx.shadowColor = haloColor;
            ctx.lineWidth = 3;

            // Outer Ring (Halo)
            ctx.strokeStyle = haloColor;
            ctx.beginPath();
            ctx.arc(0, 0, e.r * 1.1, 0, Math.PI * 2);
            ctx.stroke();

            // Inner Ring (Torus Body)
            ctx.lineWidth = 5;
            ctx.strokeStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(0, 0, e.r * 0.8, 0, Math.PI * 2);
            ctx.stroke();

            // Center Core/Hub
            ctx.fillStyle = coreColor;
            ctx.beginPath();
            ctx.arc(0, 0, e.r * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Connecting Spokes
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#00ffff';
            for (let k = 0; k < 4; k++) {
                const angle = k * (Math.PI / 2) + e.a;
                const rInner = e.r * 0.35;
                const rOuter = e.r * 0.75;
                ctx.beginPath();
                ctx.moveTo(rInner * Math.cos(angle), rInner * Math.sin(angle));
                ctx.lineTo(rOuter * Math.cos(angle), rOuter * Math.sin(angle));
                ctx.stroke();
            }
        }

        ctx.restore(); // Restore context back to (0,0) before drawing shield bar

        ctx.globalAlpha = 1; // Reset opacity before drawing shield/health bar

        // --- Draw shield/health bar around enemy (uses Viewport Position) ---
        let currentHP = e.structureHP;
        let maxHP = e.type === 'station' ? MAX_TIER_HP : STANDARD_SHIP_HP;
        let shieldOpacity = 0;
        let r, g, b;

        if (currentHP > 0) {
            if (maxHP === STANDARD_SHIP_HP) {
                if (currentHP === 3) {
                    r = 0; g = 255; b = 255; // Cian
                    shieldOpacity = 0.8;
                } else {
                    shieldOpacity = 0;
                }
            } else {

                // USER REQUEST: Shield is invisible when at far Z
                if (e.type === 'station' && e.z >= 0.5) {
                    return;
                }
                if (currentHP >= 7) { // Phase 1: HP 9-7 (Green/Blue - High Shield)
                    r = 0; g = 255; b = 255; // Cian
                    shieldOpacity = 1.0;
                } else if (currentHP >= 4) { // Phase 2: HP 6-4 (Yellow/Orange - Mid Shield/Warning)
                    r = 255; g = 165; b = 0;
                    shieldOpacity = 0.7;
                } else { // Phase 3: HP 3-1 (Red - Critical Structure)
                    r = 255; g = 0; b = 0;
                    shieldOpacity = 0.5;
                }
            }

            ctx.lineWidth = 2;
            if (shieldOpacity > 0) { // Solo dibujar el arco si el escudo visual está activo
                if (e.shieldHitTimer > 0) {
                    ctx.shadowColor = '#fff';
                    ctx.strokeStyle = `rgba(255,255,255,${shieldOpacity})`;
                    e.shieldHitTimer--;
                }
                else {
                    ctx.shadowColor = `rgb(${r},${g},${b})`;
                    ctx.strokeStyle = `rgba(${r},${g},${b},${shieldOpacity})`;
                }
                ctx.beginPath(); ctx.arc(vpX, vpY, e.r + 10, 0, Math.PI * 2); ctx.stroke();
            }
        }

    });

    ctx.shadowBlur = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1;

    if (!ship.dead) {
        // Regeneration is now solely for visual/Tesla effect, as structureHP manages hits
        if (ship.shield < ship.maxShield) ship.shield += 0.05;

        let isTesla = ship.maxShield > BASE_MAX_SHIELD;

        const tier = getShipTier();

        const BASE_SHIP_RADIUS = SHIP_SIZE / 2;
        const MAX_TIER_RADIUS = BASE_SHIP_RADIUS + (7 * 2); // Tier 7 size
        if (tier >= 8) ship.effectiveR = MAX_TIER_RADIUS;
        else ship.effectiveR = BASE_SHIP_RADIUS + (tier * 2);

        const centerX = width / 2; const centerY = height / 2;
        const r = ship.effectiveR;

        const shipMaxHP = tier >= 8 ? MAX_TIER_HP : STANDARD_SHIP_HP;

        if (ship.blinkNum % 2 === 0) { // Invulnerability blink effect

            let shieldAlpha = 0;
            let strokeWidth = 1;
            let shieldRadius = ship.effectiveR + 10;

            const EPIC_SHIELD_FACTOR = 1.7;

            if (tier >= 8) {
                shieldRadius = ship.effectiveR * EPIC_SHIELD_FACTOR;

                if (ship.structureHP >= 7) { // HP 9-7 (Fase 1 - Alto)
                    shieldAlpha = isTesla ? (0.7 + Math.random() * 0.3) : 0.6;
                    strokeWidth = isTesla ? 2.5 : 2;
                } else if (ship.structureHP >= 4) { // HP 6-4 (Fase 2 - Medio)
                    shieldAlpha = isTesla ? (0.3 + Math.random() * 0.2) : 0.4;
                    strokeWidth = isTesla ? 2 : 1.5;
                }
            } else {
                if (ship.structureHP === 3) {
                    shieldAlpha = isTesla ? (0.5 + Math.random() * 0.2) : 0.5;
                    strokeWidth = isTesla ? 1.5 : 1;
                }
            }

            if (shieldAlpha > 0) {

                ctx.lineWidth = strokeWidth;

                let baseColor, shadowColor;

                if (ship.structureHP <= 3 && tier < 8) {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                } else if (ship.structureHP >= 7) {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                } else if (ship.structureHP >= 4) {
                    baseColor = '#ffaa00'; shadowColor = 'rgba(255, 170, 0, 0.7)';
                } else {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                }

                ctx.shadowColor = shadowColor;
                ctx.strokeStyle = `rgba(0, 255, 255, ${shieldAlpha})`;

                ctx.beginPath();
                ctx.arc(centerX, centerY, shieldRadius, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(-ship.a);

            ctx.globalAlpha = 1;

            // --- Drawing logic for Ship Tiers (unchanged) ---
            if (tier >= 8) {
                const HULL_COLOR = '#1A1A1A'; const HULL_BORDER = '#333333';
                const DETAIL_GRAY = '#666666'; const ACCENT_RED = '#FF4444';
                const THRUST_COLOR = '#0088FF';
                ctx.shadowBlur = 20; ctx.shadowColor = THRUST_COLOR;
                ctx.beginPath();
                ctx.moveTo(r * 1.6, 0);
                ctx.lineTo(r * 0.5, r * 1.5); ctx.lineTo(-r * 1.2, r * 0.8);
                ctx.lineTo(-r * 1.8, r * 0.4); ctx.lineTo(-r * 1.8, -r * 0.4);
                ctx.lineTo(-r * 1.2, -r * 0.8); ctx.lineTo(r * 0.5, -r * 1.5);
                ctx.closePath();
                ctx.fillStyle = HULL_COLOR; ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = HULL_BORDER; ctx.stroke();
                ctx.shadowBlur = 0; ctx.fillStyle = DETAIL_GRAY;
                ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 1.4, r * 0.1); ctx.lineTo(r * 1.4, -r * 0.1); ctx.closePath(); ctx.fill();
                ctx.fillStyle = DETAIL_GRAY;
                ctx.fillRect(r * 0.2, r * 0.5, r * 0.3, r * 0.2); ctx.fillRect(r * 0.2, -r * 0.7, r * 0.3, r * 0.2);
                ctx.fillStyle = ACCENT_RED; ctx.beginPath(); ctx.arc(-r * 0.5, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 30; ctx.shadowColor = THRUST_COLOR;
                const EXHAUST_H = r * 0.7; const EXHAUST_X = -r * 1.8;
                ctx.fillStyle = HULL_BORDER; ctx.fillRect(EXHAUST_X, -EXHAUST_H / 2, 5, EXHAUST_H);
                if (ship.thrusting) {
                    ctx.fillStyle = `rgba(0, 136, 255, ${0.5 + Math.random() * 0.5})`;
                    ctx.beginPath(); ctx.moveTo(EXHAUST_X + 5, -EXHAUST_H / 2); ctx.lineTo(EXHAUST_X + 5, EXHAUST_H / 2);
                    ctx.lineTo(EXHAUST_X - 25 * (0.8 + Math.random() * 0.4), 0); ctx.closePath(); ctx.fill();
                }
                ctx.shadowBlur = 0;
            } else {
                let sides = 3 + tier;
                ctx.beginPath();
                for (let i = 0; i <= sides; i++) {
                    let ang = i * (2 * Math.PI / sides);
                    let rad = r;
                    if (i === 0) ctx.moveTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                    else ctx.lineTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                }
                ctx.closePath();
                let chassisGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                chassisGrad.addColorStop(0, '#0055aa');
                chassisGrad.addColorStop(1, '#002244');
                ctx.fillStyle = chassisGrad; ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = '#0088ff'; ctx.stroke();
                ctx.fillStyle = '#003366';
                ctx.fillRect(-r * 0.5, -r * 0.2, r * 0.3, r * 0.4);
                ctx.strokeStyle = '#004488'; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-r * 0.6, -r * 0.3); ctx.bezierCurveTo(-r * 0.2, 0, 0, r * 0.2, r * 0.4, r * 0.3); ctx.stroke();
                ctx.beginPath();
                ctx.arc(-r * 0.2, r * 0.3, r * 0.1, 0, Math.PI * 2);
                ctx.fillStyle = '#002233'; ctx.fill(); ctx.strokeStyle = '#005577'; ctx.stroke();
                let cockpitGrad = ctx.createRadialGradient(r * 0.4, 0, 2, r * 0.4, 0, r * 0.25);
                cockpitGrad.addColorStop(0, '#aaffff'); cockpitGrad.addColorStop(1, '#00ffff');
                ctx.fillStyle = cockpitGrad;
                ctx.beginPath(); ctx.ellipse(r * 0.4, 0, r * 0.2, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
                if (ship.thrusting) {
                    ctx.shadowColor = '#ffaa00'; ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2;
                    ctx.beginPath();
                    const rX = -r; const rY = 0;
                    ctx.moveTo(rX, rY);
                    ctx.lineTo(rX - 20 * Math.cos((Math.random() - 0.5) * 0.5), rY + 20 * Math.sin((Math.random() - 0.5) * 0.5));
                    ctx.stroke();
                    ctx.fillStyle = '#ff5500';
                    ctx.beginPath(); ctx.arc(rX - 5, 0, 5, 0, Math.PI * 2); ctx.fill();
                }
            }
            ctx.restore();
        }
        if (ship.blinkNum > 0) ship.blinkNum--;
    }

    ctx.shadowColor = '#ff0000'; ctx.fillStyle = '#ff0000';
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];

        // APLICAR GRAVEDAD (World Coords)
        for (let r of roids) {
            if (r.isPlanet && r.z < 0.5) { // Solo si el planeta es cercano
                let dx = r.x - eb.x; let dy = r.y - eb.y; // World Distance Vector
                let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);
                let force = (G_CONST * r.mass) / Math.max(distSq, 1000);
                if (dist < r.r * 8 && dist > 1) {
                    eb.xv += (dx / dist) * force * BULLET_GRAVITY_FACTOR;
                    eb.yv += (dy / dist) * force * BULLET_GRAVITY_FACTOR;
                }
            }
        }

        // Update ABSOLUTE WORLD POSITION
        eb.x += eb.xv; eb.y += eb.yv;
        eb.life--;

        // Check boundary OR lifetime (World Distance)
        if (eb.life <= 0 || Math.hypot(worldOffsetX - eb.x, worldOffsetY - eb.y) > WORLD_BOUNDS * 1.5) {
            enemyBullets.splice(i, 1); continue;
        }

        // Calculate Viewport Position for drawing
        const vpX = eb.x - worldOffsetX + width / 2;
        const vpY = eb.y - worldOffsetY + height / 2;

        // NEW: Bullet Fade Effect
        let alpha = 1.0;
        if (eb.life < BULLET_FADE_FRAMES) {
            alpha = eb.life / BULLET_FADE_FRAMES;
        }
        ctx.globalAlpha = alpha;

        ctx.beginPath(); ctx.arc(vpX, vpY, eb.size + 1, 0, Math.PI * 2); ctx.fill(); // Aumentar tamaño para visibilidad de enemigo
        ctx.globalAlpha = 1; // Reset alpha

        let hit = false;
        // Collision with player (World Coords)
        if (!ship.dead && Math.hypot(worldOffsetX - eb.x, worldOffsetY - eb.y) < (ship.effectiveR || ship.r) + 5) {
            hitShip(1); // Aplicar 1 golpe al jugador
            enemyBullets.splice(i, 1);
            hit = true;
        }
        if (hit) continue;

        // Collision with asteroids (World Coords)
        for (let j = roids.length - 1; j >= 0; j--) {
            let r = roids[j];
            if (r.z > 0.5) continue;
            if (Math.hypot(eb.x - r.x, eb.y - r.y) < r.r) {
                const rVpX = r.x - worldOffsetX + width / 2;
                const rVpY = r.y - worldOffsetY + height / 2;

                if (r.isPlanet) {
                    createExplosion(vpX, vpY, 3, '#fff', 1); // Bullet destroyed by planet shield
                }
                else {
                    createExplosion(rVpX, rVpY, 10, '#aa00ff', 1, 'debris');
                    if (r.r > 30) { roids.push(createAsteroid(r.x, r.y, r.r / 2)); roids.push(createAsteroid(r.x, r.y, r.r / 2)); } // New asteroids get world coords
                    roids.splice(j, 1);
                }
                enemyBullets.splice(i, 1); hit = true; break;
            }
        }
    }

    // --- Player Bullet Logic (All in World Coords) ---
    ctx.shadowColor = '#ff0055'; ctx.fillStyle = '#ff0055';
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];

        for (let r of roids) {
            if (r.isPlanet && r.z < 0.5) { // Solo si el planeta es cercano
                let dx = r.x - b.x; let dy = r.y - b.y; // World Distance Vector
                let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);
                let force = (G_CONST * r.mass) / Math.max(distSq, 1000);
                if (dist < r.r * 8 && dist > 1) {
                    b.xv += (dx / dist) * force * BULLET_GRAVITY_FACTOR;
                    b.yv += (dy / dist) * force * BULLET_GRAVITY_FACTOR;
                }
            }
        }

        // Update ABSOLUTE WORLD POSITION
        b.x += b.xv; b.y += b.yv;
        b.life--;

        // Check boundary OR lifetime (World Distance)
        if (b.life <= 0 || Math.hypot(worldOffsetX - b.x, worldOffsetY - b.y) > WORLD_BOUNDS * 1.5) {
            bullets.splice(i, 1); continue;
        }

        // Calculate Viewport Position for drawing
        const vpX = b.x - worldOffsetX + width / 2;
        const vpY = b.y - worldOffsetY + height / 2;

        // NEW: Bullet Fade Effect
        let alpha = 1.0;
        if (b.life < BULLET_FADE_FRAMES) {
            alpha = b.life / BULLET_FADE_FRAMES;
        }
        ctx.globalAlpha = alpha;

        ctx.beginPath(); ctx.arc(vpX, vpY, b.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; // Reset alpha
        let hit = false;

        // Collision with asteroids/planets (World Coords)
        for (let j = roids.length - 1; j >= 0; j--) {
            let r = roids[j];
            if (r.z > 0.5) continue;

            if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
                const rVpX = r.x - worldOffsetX + width / 2;
                const rVpY = r.y - worldOffsetY + height / 2;

                if (r.isPlanet) {
                    if (r.blinkNum === 0) {
                        let planet = r;
                        let asteroidMass = b.size * 10;
                        let asteroidR = b.size * 2;

                        let area1 = Math.PI * planet.r * planet.r;
                        let area2 = Math.PI * asteroidR * asteroidR;
                        let totalArea = area1 + area2;
                        let newR = Math.sqrt(totalArea / Math.PI);

                        let totalMass = planet.mass + asteroidMass;

                        planet.targetR = newR;
                        planet.mass = totalMass * 0.05;

                        console.log(`Planeta ${planet.name} absorbió bala/materia. Nuevo R=${newR.toFixed(1)}`);
                        createExplosion(vpX, vpY, 10, '#00ffff', 2);
                    }

                    bullets.splice(i, 1); hit = true; break;
                } else {
                    if (r.blinkNum > 0) {
                        bullets.splice(i, 1); hit = true; break;
                    }
                    createExplosion(rVpX, rVpY, 15, '#ff0055', 1, 'spark'); createExplosion(rVpX, rVpY, 5, '#888', 2, 'debris');
                    if (r.r > 30) { roids.push(createAsteroid(r.x, r.y, r.r / 2)); roids.push(createAsteroid(r.x, r.y, r.r / 2)); }
                    roids.splice(j, 1);
                    AudioEngine.playExplosion('small');
                }
                if (!r.isPlanet) {
                    score += 50; scoreEl.innerText = score;
                }
                bullets.splice(i, 1); hit = true; break;
            }
        }
        if (hit) continue;

        // Collision with enemies (World Coords)
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (e.blinkNum === 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 15) {
                e.structureHP--;
                e.shieldHitTimer = 5;
                bullets.splice(i, 1);
                hit = true;

                const eVpX = e.x - worldOffsetX + width / 2;
                const eVpY = e.y - worldOffsetY + height / 2;

                if (e.structureHP <= 0) {
                    let debrisColor = e.type === 'station' ? `hsl(${e.fleetHue}, 100%, 50%)` : `hsl(${e.fleetHue}, 100%, 40%)`;
                    createExplosion(eVpX, eVpY, 40, '#ffaa00', 3, 'spark'); createExplosion(eVpX, eVpY, 20, debrisColor, 4, 'debris');
                    if (e.type === 'station') { onStationDestroyed(); } else { score += 200; }
                    enemies.splice(j, 1); scoreEl.innerText = score;
                    AudioEngine.playExplosion('large');
                } else {
                    AudioEngine.playExplosion('small');
                }
                break;
            } else if (e.blinkNum > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 15) {
                bullets.splice(i, 1); hit = true; break;
            }
        }
    }
    // --- End Player Bullet Logic ---

    // Particle update (movement and decay)
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        // Particle position is World Coords + Velocity, but drawing uses Viewport Coords
        p.x += p.xv; p.y += p.yv;

        const vpX = p.x - worldOffsetX + width / 2;
        const vpY = p.y - worldOffsetY + height / 2;

        ctx.shadowColor = p.color; ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 60;
        ctx.beginPath();
        if (p.type === 'debris') ctx.fillRect(vpX, vpY, p.size, p.size); else ctx.arc(vpX, vpY, p.size, 0, Math.PI * 2);
        ctx.fill(); ctx.globalAlpha = 1;

        p.life--; if (p.life <= 0) particles.splice(i, 1);
    }

    // Auto-spawn asteroid if count is too low
    if (roids.length < 5 + level) {
        let x, y, d;
        // Spawning logic (off-screen in World Coords)
        const spawnRadius = WORLD_BOUNDS * 0.9;
        do { x = (Math.random() - 0.5) * spawnRadius * 2; y = (Math.random() - 0.5) * spawnRadius * 2; d = Math.sqrt(x ** 2 + y ** 2); } while (d < 300);
        roids.push(createAsteroid(x, y, 60));
    }

    drawRadar();
    ctx.shadowBlur = 0;
    requestAnimationFrame(loop);
}

function startGame() {
    // Stop menu music
    AudioEngine.stopMusic();
    AudioEngine.setTrack('game');

    startScreen.style.display = 'none'; level = 0; score = 0;

    // NEW: Reset game over background and fade overlay
    startScreen.classList.remove('game-over-bg');
    fadeOverlay.style.background = 'rgba(0, 0, 0, 0)';

    lives = 3;
    velocity = { x: 0, y: 0 };
    worldOffsetX = 0; // NEW: Reset world position on start
    worldOffsetY = 0;
    // REDUCED TIMER FOR MORE FREQUENT STATIONS
    stationSpawnTimer = 300;
    stationsDestroyedCount = 0;
    playerReloadTime = 0; // Reset reload timer
    scoreEl.innerText = score;

    ship = newShip();

    drawLives(); // NEW: Initial draw

    initBackground(); createLevel(); gameRunning = true;

    // Reset radar zoom to default (2500)
    currentZoomIndex = 2;
    RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex];
    // radarRangeEl.innerText = RADAR_RANGE; // REMOVED

    // Determine initial input mode based on device
    if (window.matchMedia("(pointer: coarse)").matches) { inputMode = 'touch'; mobileControls.style.opacity = '1'; }
    else { inputMode = 'mouse'; mobileControls.style.opacity = '0'; gestureHint.innerText = ""; }
    loop();
}

resize();
