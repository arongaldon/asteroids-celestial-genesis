import { State } from './state.js';

export const AudioEngine = {
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
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

            // Sub-harmonic for "massive" feel
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(20, this.ctx.currentTime);
            osc2.frequency.linearRampToValueAtTime(5, this.ctx.currentTime + 0.6);
            const gain2 = this.ctx.createGain();
            gain2.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
            osc2.connect(gain2); gain2.connect(this.masterGain);
            osc2.start(); osc2.stop(this.ctx.currentTime + 0.6);

        } else if (tier >= 8) { // Ultimate
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1); // Sweeping up "Beam" sound
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
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
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
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
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
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

