/* * AI DISCLAIMER: This code was developed with the assistance of a large language model. 
 * The author (Aron Galdon Gines) retains all copyrights.
 */

/* =========================================
   CONSTANTS & UTILS
   ========================================= */
const ASTEROID_SPAWN_TIMER = 5 * 60; // seconds at 60 FPS
const FPS = 60;
const FRICTION = 0.99;
const SHIP_SIZE = 30;
const SHIP_THRUST = 0.9;
const BASE_MAX_SHIELD = 100;
const TOUCH_ROTATION_SENSITIVITY = 0.008;
const INITIAL_LIVES = 3;
const MAX_SPEED = 50;
const WORLD_SCALE = 10;
const EVOLUTION_SCORE_STEP = 1000;

// Damage resistance
const SHIP_RESISTANCE = 2;
const STATION_RESISTANCE = 6;

const ZOOM_LEVELS = [2500, 5000, 12500, 25000, 50000];
const G_CONST = 0.5;
const PLANET_THRESHOLD = 350;
const MAX_Z_DEPTH = 5;
const PLANET_MAX_SIZE = 500;
const MAX_PLANETS = 10;
const FRIENDLY_BLUE_HUE = 210; // Unified Sky Blue

const WORLD_BOUNDS = 50000;
const BOUNDARY_DAMPENING = 0.5;
const BOUNDARY_TOLERANCE = 100;

const BULLET_GRAVITY_FACTOR = 90;
const BULLET_LIFETIME = 100;
const BULLET_FADE_FRAMES = 5;

const SIDE_BULLET_LIFETIME = 60; // Increased from 10 to 60 for visibility
const PRIMARY_BULLET_SIZE = 5;
const SECONDARY_BULLET_SIZE = 2;

const PLAYER_RELOAD_TIME_MAX = 8;
const MIN_DURATION_TAP_TO_MOVE = 200; // Touch mode only

const syllables = ["KRON", "XER", "ZAN", "TOR", "AER", "ION", "ULA", "PROX", "VEX", "NOV", "SOL", "LUNA", "TER", "MAR", "JUP"];
const suffixes = ["PRIME", "IV", "X", "ALPHA", "BETA", "MAJOR", "MINOR", "ZERO", "AEON"];

/* =========================================
  GLOBAL STATE (Shared)
  ========================================= */
let width, height;
let score = 0;
let lives = INITIAL_LIVES;
let ship;
let worldOffsetX = 0;
let worldOffsetY = 0;
let velocity = { x: 0, y: 0 };
let roids = [];
let enemies = [];
let bullets = [];
let enemyBullets = [];
let particles = [];
let shockwaves = [];
let ambientFogs = [];
let backgroundLayers = { nebulas: [], galaxies: [], starsNear: [], starsMid: [], starsFar: [] };
let playerReloadTime = 0;
let stationSpawnTimer = 0;
let stationsDestroyedCount = 0;
let level = 0;
let homePlanetId = null; // NEW: The player's home planet
let isLoneWolf = false; // NEW: Player betrayal status
let screenMessages = []; // NEW: Array for temporary on-screen notifications
let gameRunning = false;
let loopStarted = false;
let inputMode = 'mouse';
let keys = { ArrowUp: false, ArrowDown: false, Space: false, ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
let mouse = { x: 0, y: 0 };
let currentZoomIndex = 2;
let RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex];
let viewScale = 1.0; // Dynamic scale for smooth transitions

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
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.error("Error resuming AudioContext:", e));
            }
            return;
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.delay = this.ctx.createDelay(2.0);
        this.delay.delayTime.value = 0.8;
        this.delayGain = this.ctx.createGain();
        this.delayGain.gain.value = 0.4;
        this.delay.connect(this.delayGain);
        this.delayGain.connect(this.delay);
        this.delayGain.connect(this.masterGain);
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
        this.scheduler();
    },

    stopMusic: function () {
        this.isPlayingMusic = false;
    },

    createPianoNote: function (freq, volume, time, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.PIANO_FILTER_FREQ, time);
        filter.Q.setValueAtTime(this.PIANO_FILTER_Q, time);
        const attackTime = 0.005;
        const decayTime = 0.8;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + attackTime);
        gain.gain.exponentialRampToValueAtTime(volume * 0.5, time + attackTime + decayTime);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.delay);
        osc.start(time);
        osc.stop(time + duration + 0.1);
    },

    playKick: function (time) { },
    playSnare: function (time) { },

    isVisible: function (worldX, worldY, z = 0) {
        if (worldX === undefined || worldX === null) return true;
        let depthScale = 1;
        if (z > 0) depthScale = 1 / (1 + z);
        const vpX = (worldX - worldOffsetX) * depthScale + width / 2;
        const vpY = (worldY - worldOffsetY) * depthScale + height / 2;
        const padding = 100;
        return vpX >= -padding && vpX <= width + padding &&
            vpY >= -padding && vpY <= height + padding;
    },

    playLaser: function (worldX, worldY, tier = 0) {
        if (!this.isVisible(worldX, worldY)) return;
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Tiered Sounds
        if (tier >= 8) { // Ultimate
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1); // Sweeping up "Beam" sound
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        } else if (tier >= 4) { // Plasma
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.2); // Low to High Zap
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        } else { // Standard
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880 + (tier * 100), this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        }

        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.4);
    },

    playExplosion: function (size = 'small', worldX, worldY, z = 0) {
        if (!this.isVisible(worldX, worldY, z)) return;
        if (!this.enabled || !this.ctx) return;
        const duration = size === 'large' ? 1.0 : 0.3;
        const bufferSize = this.ctx.sampleRate * (duration + 0.2);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start();
    },

    playSoftThud: function (worldX, worldY, z = 0) {
        if (!this.isVisible(worldX, worldY, z)) return;
        if (!this.enabled || !this.ctx) return;
        const duration = 0.2;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start();
    },

    playPlanetExplosion: function (worldX, worldY, z = 0) {
        if (!this.isVisible(worldX, worldY, z)) return;
        if (!this.enabled || !this.ctx) return;
        const duration = 2.5; // Much longer
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(5, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start();
    },

    playThrust: function (worldX, worldY) {
        if (!this.isVisible(worldX, worldY)) return;
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
        if (this.currentTrack !== 'menu') {
            this.stopMusic();
            return;
        }
        const beatDuration = 0.5;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playMenuBeat(this.nextNoteTime);
            this.nextNoteTime += beatDuration;
        }
        requestAnimationFrame(() => this.scheduler());
    },

    playMenuBeat: function (time) {
        const A3 = 220; const C4 = 261.63; const E4 = 329.63; const F3 = 174.61; const G3 = 196;
        let chord = [];
        let bassFreq;
        const measure = Math.floor(this.beatCount / 4);
        if (measure % 4 === 0) { chord = [A3, C4, E4]; bassFreq = A3 / 2; }
        else if (measure % 4 === 1) { chord = [F3, A3, C4]; bassFreq = F3 / 2; }
        else if (measure % 4 === 2) { chord = [261.63, 329.63, 392.00]; bassFreq = 261.63 / 2; }
        else if (measure % 4 === 3) { chord = [G3, 246.94, 293.66]; bassFreq = G3 / 2; }
        const chordVolume = 0.05;
        const bassVolume = 0.06;
        const duration = 3.0;
        if (this.beatCount % 4 === 0) {
            chord.forEach(freq => {
                this.createPianoNote(freq, chordVolume, time, duration);
            });
            this.createPianoNote(bassFreq, bassVolume, time, duration * 2);
        }
        if (this.beatCount % 2 === 0 && Math.random() < 0.3) {
            const scale = [440, 523.25, 587.33, 659.25, 783.99];
            const freq = scale[Math.floor(Math.random() * scale.length)] * 2;
            this.createPianoNote(freq, 0.02, time, 1.5);
        }
        this.beatCount++;
    }
};

/* Moved to top */

function generatePlanetName() {
    const s1 = syllables[Math.floor(Math.random() * syllables.length)];
    const s2 = syllables[Math.floor(Math.random() * syllables.length)];
    const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${s1}${s2.toLowerCase()} ${suf}`;
}

function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getShipTier() { return Math.max(0, Math.floor(score / EVOLUTION_SCORE_STEP)); }
function getShapeName(tier) {
    if (tier >= 9) return "THE CELESTIAL";
    if (tier >= 8) return "THE SPHERE";
    const shapes = ["TRIANGLE", "SQUARE", "PENTAGON", "HEXAGON", "HEPTAGON", "OCTAGON", "NONAGON", "DECAGON"];
    return shapes[Math.min(tier, shapes.length - 1)];
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
            setTimeout(show, 50);
        }
    }
    show();
}

/* =========================================
   ENTITY FACTORIES
   ========================================= */
function newShip() {
    const currentTier = getShipTier();
    const startingHP = SHIP_RESISTANCE;
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
        structureHP: startingHP,
        effectiveR: SHIP_SIZE / 2
    };
}

let roidCounter = 0;
function createAsteroid(x, y, r, z = 0) {
    let isPlanet = r > PLANET_THRESHOLD;
    let roid = {
        id: ++roidCounter,
        x, y,
        xv: (0.5 + Math.random() * 25 / FPS) * (Math.random() < 0.5 ? 1 : -1) * (isPlanet ? 0.2 : 1),
        yv: (0.5 + Math.random() * 25 / FPS) * (Math.random() < 0.5 ? 1 : -1) * (isPlanet ? 0.2 : 1),
        r, a: Math.random() * Math.PI * 2,
        vert: Math.floor(Math.random() * 8 + 6), offs: [],
        mass: r * r * 0.05,
        isPlanet: isPlanet,
        z: z,
        zSpeed: 0,
        name: null,
        textureData: null,
        rings: null,
        blinkNum: 0,
        targetR: r
    };
    roid.stableXV = roid.xv;
    roid.stableYV = roid.yv;
    if (isPlanet) initializePlanetAttributes(roid);
    for (let i = 0; i < roid.vert; i++) roid.offs.push(Math.random() * 0.3 * 2 + 1 - 0.3);
    return roid;
}

function initializePlanetAttributes(roid, forcedHue = null) {
    if (roid.isPlanet && roid.textureData) return;
    const r = roid.r;
    const seed = Math.floor(Math.random() * 100000);
    const rng = mulberry32(seed);
    const hue = forcedHue !== null ? forcedHue : rng() * 360;
    roid.isPlanet = true;
    roid.name = generatePlanetName();

    // ORBITAL INITIALIZATION
    // Calculate distance from center to determine orbit radius
    roid.orbitRadius = Math.hypot(roid.x, roid.y);
    if (roid.orbitRadius < 1000) roid.orbitRadius = 1000; // Minimum orbit size

    // Initial angle based on position
    roid.orbitAngle = Math.atan2(roid.y, roid.x);

    // Orbital Speed (The farther, the slower, naturally, but we can tune this)
    // Using a base speed divided by radius for angular velocity
    // Random direction (CW or CCW)
    const baseOrbitSpeed = 10; // Reduced from 40 to 10
    roid.orbitSpeed = (baseOrbitSpeed / roid.orbitRadius) * (rng() < 0.5 ? 1 : -1);

    roid.zSpeed = (rng() * 0.001) + 0.0005;

    let textureData = {
        seed: seed,
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
    for (let i = 0; i < 5; i++) {
        const startAngle = rng() * Math.PI * 2;
        const radiusFactor = (0.5 + rng() * 0.4);
        const vertices = 10 + Math.floor(rng() * 10);
        const vertexOffsets = [];
        for (let j = 0; j < vertices; j++) vertexOffsets.push(0.8 + rng() * 0.4);
        textureData.landmasses.push({ startAngle, radiusFactor, vertices, vertexOffsets });
    }
    for (let i = 0; i < 10; i++) {
        textureData.craters.push({
            xFactor: (rng() - 0.5) * 1.5,
            yFactor: (rng() - 0.5) * 1.5,
            rFactor: (0.05 + rng() * 0.1)
        });
    }
    for (let i = 0; i < 8; i++) {
        textureData.clouds.push({
            angleRng: rng() * Math.PI * 2,
            distRng: rng() * 0.8,
            crRng: (0.1 + rng() * 0.2),
            rotationRng: rng() * Math.PI * 2,
            ageFactorRng: rng() * 0.5 + 0.5
        });
    }
    roid.zWait = 0;
    roid.textureData = textureData;
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

function createBullet(angleOffset, perpOffset, rOffset = 0, isPrimary = true, tier = 0) {
    const angle = ship.a + angleOffset;
    const offsetX = (Math.cos(ship.a + Math.PI / 2) * perpOffset);
    const offsetY = (Math.sin(ship.a + Math.PI / 2) * perpOffset);
    const radius = (ship.effectiveR || ship.r) + rOffset;
    const startWorldX = worldOffsetX + radius * Math.cos(ship.a) - offsetX;
    const startWorldY = worldOffsetY - radius * Math.sin(ship.a) + offsetY;
    const lifetime = isPrimary ? BULLET_LIFETIME : SIDE_BULLET_LIFETIME;

    // Scale size by tier: tiers 1-8 get gradual increase, tier 9+ gets extra boost
    let tierSizeBoost = 1 + (tier * 0.15);
    if (tier >= 9) tierSizeBoost = 2.5; // Tier 9 and 10 are extra powerful

    const size = isPrimary ? (PRIMARY_BULLET_SIZE * tierSizeBoost) : (SECONDARY_BULLET_SIZE * tierSizeBoost);
    return {
        x: startWorldX,
        y: startWorldY,
        xv: (1200 * Math.cos(angle) / FPS) + velocity.x,
        yv: (-1200 * Math.sin(angle) / FPS) + velocity.y,
        dist: 0,
        life: lifetime,
        size: size,
        tier: tier
    };
}

function createOmniBullet(absoluteAngle, isPrimary = false) {
    const radius = (ship.effectiveR || ship.r);
    const startWorldX = worldOffsetX + radius * Math.cos(absoluteAngle);
    const startWorldY = worldOffsetY - radius * Math.sin(absoluteAngle);
    const lifetime = isPrimary ? BULLET_LIFETIME : SIDE_BULLET_LIFETIME;
    const size = isPrimary ? PRIMARY_BULLET_SIZE : SECONDARY_BULLET_SIZE;
    return {
        x: startWorldX,
        y: startWorldY,
        xv: (700 * Math.cos(absoluteAngle) / FPS) + velocity.x,
        yv: (-700 * Math.sin(absoluteAngle) / FPS) + velocity.y,
        dist: 0,
        life: lifetime,
        size: size
    };
}

function createGalaxy() {
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
    const side = Math.floor(Math.random() * 4);
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
        hue: Math.random() < 0.5 ? 240 : 0,
        alpha: 0.05 + Math.random() * 0.1,
        life: 500
    };
}

function createExplosion(vpX, vpY, n, color = 'white', sizeBase = 1, type = 'spark') {
    for (let i = 0; i < n; i++) {
        const pWorldX = vpX - width / 2 + worldOffsetX;
        const pWorldY = vpY - height / 2 + worldOffsetY;
        let life = 30 + Math.random() * 20; let speed = 10;
        if (type === 'debris') { life = 60 + Math.random() * 40; speed = 3; }
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
    shockwaves.push({ x: worldX, y: worldY, r: 10, maxR: 1200, strength: 30, alpha: 1 });
}

/* =========================================
   DRAWING UTILS (Procedural)
   ========================================= */
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
    ctx.fillStyle = textureData.craterColor;
    textureData.craters.forEach(cr => {
        const cx = x + cr.xFactor * r;
        const cy = y + cr.yFactor * r;
        const crr = r * cr.rFactor;
        if (Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) + crr < r) {
            ctx.beginPath(); ctx.arc(cx, cy, crr, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`; ctx.lineWidth = 1; ctx.stroke();
        }
    });
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
    let atmGrad = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.1);
    atmGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
    atmGrad.addColorStop(0.5, textureData.atmosphereColor);
    atmGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = atmGrad; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = textureData.atmosphereColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

function drawRings(ctx, rings, planetRadius, depthScale) {
    ctx.save();
    ctx.rotate(rings.tilt);
    rings.bands.forEach(band => {
        const bandRadius = planetRadius * band.rRatio;
        const bandWidth = planetRadius * band.wRatio;
        const outerRadius = bandRadius * depthScale;
        ctx.lineWidth = bandWidth * depthScale;
        ctx.strokeStyle = band.color;
        ctx.globalAlpha = band.alpha * depthScale;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 0, outerRadius, outerRadius * 0.15, 0, 0, Math.PI, false);
        ctx.stroke();
    });
    ctx.restore();
}
