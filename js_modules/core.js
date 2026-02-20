import { ASTEROIDS, ASTEROIDS_INIT_INNER, ASTEROIDS_INIT_OUTER, ASTEROID_DESTROYED_REWARD, ASTEROID_MAX_SIZE, ASTEROID_MIN_SIZE, ASTEROID_SPEED_LIMIT, ASTEROID_SPLIT_OFFSET, ASTEROID_SPLIT_SPEED, BOUNDARY_CORRECTION_FORCE, BOUNDARY_DAMPENING, BOUNDARY_TOLERANCE, BOUNDARY_TOLERANCE_ROIDS, FPS, FRICTION, G_CONST, MAX_Z_DEPTH, MIN_DURATION_TAP_TO_MOVE, PLANETS_LIMIT, PLANET_MAX_SIZE, PLANET_THRESHOLD, PLAYER_INITIAL_LIVES, PLAYER_RELOAD_TIME_MAX, SCALE_IN_MOUSE_MODE, SCALE_IN_TOUCH_MODE, SHIPS_COMBAT_ORBIT_DISTANCE, SHIPS_LIMIT, SHIPS_SEPARATION_DISTANCE, SHIPS_SPAWN_TIME, SHIP_BASE_MAX_SHIELD, SHIP_BULLET1_LIFETIME, SHIP_BULLET2_LIFETIME, SHIP_BULLET_FADE_FRAMES, SHIP_BULLET_GRAVITY_FACTOR, SHIP_EVOLUTION_SCORE_STEP, SHIP_FRIENDLY_BLUE_HUE, SHIP_KILLED_REWARD, SHIP_MAX_SPEED, SHIP_RESISTANCE, SHIP_SIGHT_RANGE, SHIP_SIZE, SHIP_THRUST, STATIONS_PER_PLANET, STATIONS_SPAWN_TIMER, STATION_KILLED_REWARD, STATION_RESISTANCE, WORLD_BOUNDS, ZOOM_LEVELS, suffixes, syllables, DOM } from './config.js';
import { State } from './state.js';

/* * AI DISCLAIMER: This code was developed with the assistance of a large language model. 
 * The author (Aron Galdon Gines) retains all copyrights.
 */


class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    clear() {
        this.grid.clear();
    }

    insert(obj) {
        const key = this.getKey(obj.x, obj.y);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(obj);
    }

    query(obj) {
        const cx = Math.floor(obj.x / this.cellSize);
        const cy = Math.floor(obj.y / this.cellSize);
        let results = [];

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${cx + i},${cy + j}`;
                if (this.grid.has(key)) {
                    const cellObjects = this.grid.get(key);
                    for (let k = 0; k < cellObjects.length; k++) {
                        results.push(cellObjects[k]);
                    }
                }
            }
        }
        return results;
    }
}

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

    playVictoryMusic: function () {
        if (!this.enabled || !this.ctx) return;
        this.setTrack('victory');
        this.startMusic();
    },

    playGameOverMusic: function () {
        if (!this.enabled || !this.ctx) return;
        this.setTrack('gameover');
        this.startMusic();
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

    createAmbientPad: function (freq, volume, time, duration) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 1.002, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, time);
        filter.frequency.linearRampToValueAtTime(freq * 4, time + duration * 0.5);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + duration * 0.3);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        osc.connect(filter); osc2.connect(filter); filter.connect(gain);
        gain.connect(this.masterGain); gain.connect(this.delay);
        osc.start(time); osc.stop(time + duration + 0.1);
        osc2.start(time); osc2.stop(time + duration + 0.1);
    },

    playSolarWind: function (time, duration) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.exponentialRampToValueAtTime(800, time + duration * 0.5);
        filter.frequency.exponentialRampToValueAtTime(100, time + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start(time);
    },

    playSpark: function (time) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000 + Math.random() * 3000, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.03, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(gain); gain.connect(this.masterGain); gain.connect(this.delay);
        osc.start(time); osc.stop(time + 0.1);
    },

    playSolarWind: function (time, duration) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.exponentialRampToValueAtTime(800, time + duration * 0.5);
        filter.frequency.exponentialRampToValueAtTime(100, time + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start(time);
    },

    playSpark: function (time) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000 + Math.random() * 3000, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.03, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(gain); gain.connect(this.masterGain); gain.connect(this.delay);
        osc.start(time); osc.stop(time + 0.1);
    },

    scheduler: function () {
        if (!this.isPlayingMusic || !this.ctx) return;
        if (this.currentTrack !== 'menu' && this.currentTrack !== 'victory' && this.currentTrack !== 'gameover') {
            this.stopMusic();
            return;
        }
        const beatDuration = (this.currentTrack === 'menu') ? 0.5 : 0.3;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            if (this.currentTrack === 'victory') {
                this.playVictoryBeat(this.nextNoteTime);
            } else if (this.currentTrack === 'gameover') {
                this.playGameOverBeat(this.nextNoteTime);
            } else {
                this.playMenuBeat(this.nextNoteTime);
            }
            this.nextNoteTime += beatDuration;
        }
        requestAnimationFrame(() => this.scheduler());
    },

    playVictoryBeat: function (time) {
        // Cosmic Ambient Lofi: Relaxing, ethereal, cosmic
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00]; // Pentatonic C Major
        const beatInMeasure = this.beatCount % 16;

        // Ambient Pad (Slow, relaxing melody)
        if (beatInMeasure % 4 === 0) {
            const freq = notes[Math.floor(Math.random() * notes.length)];
            this.createAmbientPad(freq, 0.1, time, 4.0);
        }

        // Sub-Bass (Deep and grounding)
        if (beatInMeasure === 0) {
            this.createAmbientPad(notes[0] / 4, 0.15, time, 8.0);
        }

        // Stellar Sparks (Random high-pitched blips)
        if (Math.random() > 0.7) {
            this.playSpark(time + Math.random() * 0.2);
        }

        // Solar Winds (Occasional sweeps)
        if (beatInMeasure === 8 && Math.random() > 0.5) {
            this.playSolarWind(time, 4.0);
        }

        this.beatCount++;
    },

    playGameOverBeat: function (time) {
        // Sad Cosmic Ambient: Mournful, ethereal, mystical
        const notes = [261.63, 311.13, 392.00, 415.30, 466.16]; // C Minor (with Eb, G, Ab, Bb)
        const beatInMeasure = this.beatCount % 32; // Slower cycles for mystery

        // Mournful Pad (Very slow, sad melody)
        if (beatInMeasure % 8 === 0) {
            const freq = notes[Math.floor(Math.random() * notes.length)];
            this.createAmbientPad(freq, 0.08, time, 6.0); // Longer decay
        }

        // Mystic Bass (Deep and dark)
        if (beatInMeasure === 0) {
            this.createAmbientPad(notes[0] / 4, 0.12, time, 12.0); // Very deep bass
        }

        // Faint Solar Winds (Constant mournful breathing)
        if (beatInMeasure % 4 === 0) {
            this.playSolarWind(time, 5.0);
        }

        // Dissolving Sparks (Distant echoes)
        if (Math.random() > 0.8) {
            this.playSpark(time + Math.random() * 0.5);
        }

        this.beatCount++;
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
    },
    isVisible: function (worldX, worldY, z = 0) {
        if (worldX === undefined || worldX === null) return true;
        let depthScale = 1;
        if (z > 0) depthScale = 1 / (1 + z);
        const vpX = (worldX - State.worldOffsetX) * depthScale + State.width / 2;
        const vpY = (worldY - State.worldOffsetY) * depthScale + State.height / 2;
        const padding = 100;
        return vpX >= -padding && vpX <= State.width + padding &&
            vpY >= -padding && vpY <= State.height + padding;
    },

    playLaser: function (worldX, worldY, tier = 0) {
        if (!this.isVisible(worldX, worldY)) return;
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (tier >= 12) { // GODSHIP PULSE
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(40, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

            // Sub-harmonic for "massive" feel
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(20, this.ctx.currentTime);
            osc2.frequency.linearRampToValueAtTime(5, this.ctx.currentTime + 0.6);
            const gain2 = this.ctx.createGain();
            gain2.gain.setValueAtTime(0.4, this.ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
            osc2.connect(gain2); gain2.connect(this.masterGain);
            osc2.start(); osc2.stop(this.ctx.currentTime + 0.6);

        } else if (tier >= 8) { // Ultimate
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
        osc.start(); osc.stop(this.ctx.currentTime + 0.5);
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
    }
};

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

function increaseShipScore(ship, reward) {
    ship.score += reward;
    const newTier = getShipTier(ship);

    if (ship === State.playerShip) {
        // Only show message if tier <= 12 OR if we are devolving
        if (newTier !== ship.tier) {
            if (newTier > ship.tier) {
                if (newTier === 12 && ship.tier < 12) {
                    addScreenMessage("THE DIVINE METAMORPHOSIS BEGINS...", "#00ffff");
                    addScreenMessage("ANY SHOT FROM NOW ON COULD BE DANGEROUS.", "#ffaa00");
                    ship.transformationTimer = 600; // ~10 seconds at 60fps
                } else if (newTier < 12) {
                    addScreenMessage(`EVOLVED TO ${getShapeName(newTier)}`, "#00ff00");
                }
            }
            else if (ship.tier < 12) {
                addScreenMessage(`DEVOLVED TO ${getShapeName(newTier)}`, "#ff0000");
            } else {
                ship.transformationTimer = 0; // Cancel transformation if devolved
            }
        }
    }

    ship.tier = newTier;
}

function getShipTier(ship) {
    return Math.max(0, Math.floor(ship.score / SHIP_EVOLUTION_SCORE_STEP));
}

function getShapeName(tier) {
    if (tier >= 12) return "THE GODSHIP";
    if (tier === 11) return "THE HYPERION";
    if (tier === 10) return "THE TITAN";
    if (tier === 9) return "THE CELESTIAL";
    if (tier === 8) return "THE SPHERE";
    const shapes = ["TRIANGLE", "SQUARE", "PENTAGON", "HEXAGON", "HEPTAGON", "OCTAGON", "NONAGON", "DECAGON"];
    return shapes[Math.min(tier, shapes.length - 1)];
}

// Show and animate a text in the info LED.
function showInfoLEDText(text) {
    DOM.infoLED.innerHTML = '';
    const characters = text.split('');
    let i = 0;
    let line = '';
    function show() {
        if (i < characters.length) {
            const char = characters[i];
            line += char;
            DOM.infoLED.textContent = line;
            i++;
            setTimeout(show, 50);
        }
    }
    show();
}

/* =========================================
   ENTITY FACTORIES
   ========================================= */
function newPlayerShip() {
    const startingHP = SHIP_RESISTANCE;
    return {
        a: 90 / 180 * Math.PI,
        blinkNum: 30,
        blinkTime: 6,
        dead: false,
        effectiveR: SHIP_SIZE / 2,
        isFriendly: true,
        leaderRef: null,
        lives: PLAYER_INITIAL_LIVES,
        loneWolf: false,
        mass: 20,
        maxShield: SHIP_BASE_MAX_SHIELD,
        r: SHIP_SIZE / 2,
        role: null,
        score: 0,
        shield: SHIP_BASE_MAX_SHIELD,
        squadId: null,
        structureHP: startingHP,
        thrusting: false,
        tier: 0,
        // Weapon Properties (Default for Player)
        bulletSpeed: 25,
        bulletLife: 50,
        bulletSize: 6,
        type: 'ship',
        transformationTimer: 0
function createAsteroid(x, y, r, z = 0) {
        let isPlanet = r > PLANET_THRESHOLD;
        let roid = {
            id: ++State.roidCounter,
            x, y,
            xv: (0.1 + Math.random() * 5 / FPS) * (Math.random() < 0.5 ? 1 : -1) * (isPlanet ? 0.2 : 1),
            yv: (0.1 + Math.random() * 5 / FPS) * (Math.random() < 0.5 ? 1 : -1) * (isPlanet ? 0.2 : 1),
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
            targetR: r,
            color: `hsl(${Math.random() * 360}, ${5 + Math.random() * 5}%, ${5 + Math.random() * 10}%)` // Almost black, low saturation
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

        // ELLIPTICAL ORBITAL INITIALIZATION
        // Each planet has its own unique center of gravity (not all orbiting 0,0)
        // Generate a random offset for this planet's orbital center
        const maxCenterOffset = WORLD_BOUNDS * 0.3; // Centers can be up to 30% of world bounds from origin
        roid.orbitCenterX = (rng() - 0.5) * 2 * maxCenterOffset;
        roid.orbitCenterY = (rng() - 0.5) * 2 * maxCenterOffset;

        // Calculate distance from this planet's orbital center
        const dx = roid.x - roid.orbitCenterX;
        const dy = roid.y - roid.orbitCenterY;
        const distFromCenter = Math.hypot(dx, dy);

        // Semi-major axis (a) - the longest radius of the ellipse
        roid.semiMajorAxis = Math.max(1000, distFromCenter * (0.8 + rng() * 0.4));

        // Eccentricity determines how "elliptical" the orbit is (0 = circle, close to 1 = very elongated)
        // Range from 0.1 to 0.7 for variety
        roid.eccentricity = 0.1 + rng() * 0.6;

        // Semi-minor axis (b) calculated from eccentricity: b = a * sqrt(1 - e^2)
        roid.semiMinorAxis = roid.semiMajorAxis * Math.sqrt(1 - roid.eccentricity * roid.eccentricity);

        // Initial angle (eccentric anomaly) based on current position
        roid.orbitAngle = Math.atan2(dy, dx);

        // Random rotation of the ellipse itself (orientation in space)
        roid.ellipseRotation = rng() * Math.PI * 2;

        // Orbital Speed - angular State.velocity (radians per frame)
        // Slower for larger orbits (Kepler's third law approximation)
        const baseOrbitSpeed = 3;
        roid.orbitSpeed = (baseOrbitSpeed / roid.semiMajorAxis) * (rng() < 0.5 ? 1 : -1);

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

    function createGalaxy() {
        const arms = Math.floor(Math.random() * 2) + 2;
        const size = Math.random() * 150 + 100;
        const colorBase = Math.random() > 0.5 ? { r: 50, g: 100, b: 255 } : { r: 255, g: 50, b: 200 };
        let stars = [];
        for (let i = 0; i < 300; i++) {
            const dist = Math.random() * size; const angle = (dist / 15) + (Math.PI * 2 * (i % arms) / arms);
            stars.push({ r: dist, theta: angle + Math.random() * 0.5, size: Math.random() * 1.5, alpha: Math.random() });
        }
        return { x: Math.random() * State.width * 3 - State.width, y: Math.random() * State.height * 3 - State.height, size, stars, color: colorBase, angle: Math.random() * Math.PI };
    }

    function createAmbientFog() {
        const side = Math.floor(Math.random() * 4);
        let x, y, xv, yv;
        const padding = 500;
        const speed = 0.5;
        if (side === 0) { x = State.width * Math.random(); y = -padding; xv = (Math.random() - 0.5) * 0.1; yv = speed; }
        else if (side === 1) { x = State.width + padding; y = State.height * Math.random(); xv = -speed; yv = (Math.random() - 0.5) * 0.1; }
        else if (side === 2) { x = State.width * Math.random(); y = State.height + padding; xv = (Math.random() - 0.5) * 0.1; yv = -speed; }
        else { x = -padding; y = State.height * Math.random(); xv = speed; yv = (Math.random() - 0.5) * 0.1; }
        return {
            x, y, xv, yv,
            r: Math.max(State.width, State.height) * (0.8 + Math.random() * 0.5),
            hue: Math.random() < 0.5 ? 240 : 0,
            alpha: 0.05 + Math.random() * 0.1,
            life: 500
        };
    }

    function createExplosion(vpX, vpY, n, color = 'white', sizeBase = 1, type = 'spark') {
        for (let i = 0; i < n; i++) {
            const pWorldX = vpX - State.width / 2 + State.worldOffsetX;
            const pWorldY = vpY - State.height / 2 + State.worldOffsetY;
            let life = 30 + Math.random() * 20;
            let speed = 10;
            if (type === 'debris') { life = 60 + Math.random() * 40; speed = 3; }
            if (type === 'flame') { life = 40 + Math.random() * 40; speed = 5 + Math.random() * 10; }
            if (type === 'smoke') { life = 80 + Math.random() * 60; speed = 2 + Math.random() * 3; }

            State.particles.push({
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
        State.shockwaves.push({ x: worldX, y: worldY, r: 10, maxR: 1200, strength: 30, alpha: 1 });
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
