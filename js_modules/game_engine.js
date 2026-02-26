import { ASTEROID_CONFIG, BOUNDARY_CONFIG, PLANET_CONFIG, PLAYER_CONFIG, SCORE_REWARDS, SHIP_CONFIG, STATION_CONFIG, FPS, FRICTION, G_CONST, MAX_Z_DEPTH, MIN_DURATION_TAP_TO_MOVE, SCALE_IN_MOUSE_MODE, SCALE_IN_TOUCH_MODE, WORLD_BOUNDS, ZOOM_LEVELS, suffixes, syllables, DOM } from './config.js';
import { State } from './state.js';
import { SpatialHash, mulberry32, getShapeName } from './utils.js';
import { AudioEngine } from './audio.js';
import { newPlayerShip, createAsteroid, initializePlanetAttributes, createGalaxy, createAmbientFog, createExplosion, createShockwave, createAsteroidBelt, spawnStation, spawnShipsSquad, getShipTier, generatePlanetName, increaseShipScore, onShipDestroyed, onStationDestroyed, createExplosionDebris } from './entities.js';
import { drawPlanetTexture, drawRadar, drawHeart, drawLives, updateHUD, updateAsteroidCounter, showInfoLEDText, addScreenMessage, drawRings } from './render.js';
import { changeRadarZoom, shootLaser, fireEntityWeapon, fireGodWeapon, enemyShoot, isTrajectoryClear, proactiveCombatScanner } from './input.js';
import { t } from './i18n.js';

import { setupInputEvents, isTouching, touchStartTime } from './events.js';
import { spatialGrid, updatePhysics, resolveInteraction } from './physics.js';

/* * AI DISCLAIMER: This code was developed with the assistance of a large language model. 
 * The author (Aron Galdon Gines) retains all copyrights.
 */

let stationsDestroyedCount = 0;
let originalPlanetLimit = null;

export function initBackground() {
    // Resets and populates background layers for parallax
    State.backgroundLayers = { nebulas: [], galaxies: [], starsNear: [], starsMid: [], starsFar: [] };
    State.ambientFogs = []; // NEW: Reset ambient fog
    for (let i = 0; i < 6; i++) State.backgroundLayers.nebulas.push({ x: Math.random() * State.width, y: Math.random() * State.height, r: State.width * 0.6, hue: Math.random() * 60 + 200, alpha: 0.1 });
    for (let i = 0; i < 3; i++) State.backgroundLayers.galaxies.push(createGalaxy());
    for (let i = 0; i < 3; i++) State.ambientFogs.push(createAmbientFog()); // NEW: Initial ambient fogs
    const createStar = () => ({ x: Math.random() * State.width, y: Math.random() * State.height, size: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.5 + 0.3 });
    for (let i = 0; i < 50; i++) State.backgroundLayers.starsFar.push(createStar());
    for (let i = 0; i < 50; i++) State.backgroundLayers.starsMid.push(createStar());
    for (let i = 0; i < 40; i++) State.backgroundLayers.starsNear.push(createStar());
}


export function createLevel() {
    State.roids = []; State.enemyShipBullets = []; State.playerShipBullets = []; State.shockwaves = [];
    // State.ships = []; // REMOVED: Don't clear State.ships here, clear it in startGame instead

    if (PLANET_CONFIG.LIMIT === 0) {
        State.homePlanetId = null;
    }
    else {
        let planetSpawned = false;
        let planetX = (Math.random() - 0.5) * 5000;
        let planetY = (Math.random() - 0.5) * 5000;
        let firstPlanet = createAsteroid(planetX, planetY, ASTEROID_CONFIG.MAX_SIZE + 1, 0, t("game.home_planet_name"));
        State.roids.push(firstPlanet);
        State.homePlanetId = firstPlanet.id;
        firstPlanet.zSpeed = 0;

        if (firstPlanet.textureData) {
            firstPlanet.textureData.waterColor = `hsl(${SHIP_CONFIG.FRIENDLY_BLUE_HUE}, 60%, 30%)`;
            firstPlanet.textureData.atmosphereColor = `hsl(${SHIP_CONFIG.FRIENDLY_BLUE_HUE}, 80%, 60%)`;
            firstPlanet.textureData.innerGradColor = `hsl(${SHIP_CONFIG.FRIENDLY_BLUE_HUE}, 10%, 2%)`;
        }

        planetSpawned = true;
    }

    createAsteroidBelt(0, 0, ASTEROID_CONFIG.INIT_INNER, WORLD_BOUNDS * 0.9, ASTEROID_CONFIG.COUNT);

    State.roids.filter(r => r.isPlanet).forEach(planet => {
        const stationCount = Math.floor(Math.random() * STATION_CONFIG.PER_PLANET) + 1;
        for (let i = 0; i < stationCount; i++) {
            spawnStation(planet);
        }
    });

    updateAsteroidCounter();
}

export function hitPlayerShip(damageAmount, sourceIsNearPlanet = false) {
    if (State.playerShip.blinkNum > 0 || State.playerShip.dead || State.victoryState) return;

    State.playerShip.structureHP--;

    const vpX = State.width / 2; const vpY = State.height / 2;
    createExplosion(vpX, vpY, 10, '#0ff', 2);

    if (State.playerShip.structureHP <= 0) {
        State.playerShip.structureHP = 0;
        killPlayerShip();
    }
    else {
        State.playerShip.blinkNum = 15;
        State.velocity.x *= -0.5; State.velocity.y *= -0.5;
    }
}

export function killPlayerShip(reason = 'normal') {
    const vpX = State.width / 2; const vpY = State.height / 2;
    createExplosion(vpX, vpY, 60, '#0ff', 3);
    AudioEngine.playExplosion('large', State.worldOffsetX, State.worldOffsetY);

    State.playerShip.dead = true;
    State.playerShip.leaderRef = null;
    State.playerShip.lives--;
    drawLives(); // Ensure HUD reflects 0 immediately
    State.playerShip.squadId = null;

    State.velocity = { x: 0, y: 0 };

    increaseShipScore(State.playerShip, -1000);

    if (State.playerShip.lives > 0) setTimeout(() => {
        State.playerShip.dead = false;
        State.playerShip.structureHP = SHIP_CONFIG.RESISTANCE;

        drawLives();
    }, 3000);
    else {
        // MOVE PLANETS TO Z (Far background)
        State.roids.forEach(r => {
            if (r.isPlanet && r.id !== State.homePlanetId) {
                r.z = MAX_Z_DEPTH;
            }
        });

        // HIDE HUD DURING GAME OVER
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'none';

        setTimeout(() => {
            DOM.fadeOverlay.style.background = 'rgba(0, 0, 0, 0.4)'; // Trigger semi-transparent fade
            DOM.startScreen.classList.remove('fade-out'); // Reset before fade
            DOM.startScreen.classList.add('game-over');
            DOM.startScreen.style.display = 'flex';

            State.gameRunning = false;

            // Audio: Game Over Sequence
            AudioEngine.playGameOverMusic();
            DOM.startScreen.addEventListener('click', window.audioStopper);

            // Philosophical Game Over Messages
            if (reason === 'player') {
                showInfoLEDText(t("game.gameover_player"));
            } else if (reason === 'enemy') {
                showInfoLEDText(t("game.gameover_enemy"));
            } else if (reason === 'collision') {
                showInfoLEDText(t("game.gameover_collision"));
            } else {
                showInfoLEDText(t("game.gameover_normal"));
            }

            // Bring up the button and initiate the slow fade of the BG image
            setTimeout(() => {
                DOM.startBtn.style.display = 'block';
                DOM.startBtn.innerText = t("ui.restart");
                DOM.startScreen.classList.add('fade-out');
            }, 3000);
        }, 5000);
    }
}

export function triggerHomePlanetLost(reason) {
    State.playerShip.lives = 0; // Force game over
    killPlayerShip(reason);

    if (reason === 'player') {
        State.screenMessages = [];
        addScreenMessage(t("game.home_lost_player"), "#ff0000");
    } else if (reason === 'enemy') {
        State.screenMessages = [];
        addScreenMessage(t("game.home_lost_enemy"), "#ff0000");
    } else {
        addScreenMessage(t("game.home_lost_collision"), "#ff0000");
    }
}

function handleTouchVictoryInteraction(e) {
    if (!State.victoryState) return;
    const duration = Date.now() - touchStartTime;
    // Only trigger Congratulations if it was a short tap
    if (duration < MIN_DURATION_TAP_TO_MOVE && e.changedTouches && e.changedTouches.length === 1) {
        handleVictoryInteraction();
    }
}

function handleVictoryInteraction() {
    if (!State.victoryState) return;

    // Show Congratulations
    showInfoLEDText(t("game.victory_msg"));
    addScreenMessage(t("game.mission_accomplished"), "#00ff00");

    DOM.startScreen.classList.remove('fade-out');
    DOM.startScreen.classList.add('victory');
    DOM.startScreen.style.display = 'flex';
    DOM.startScreen.addEventListener('click', window.audioStopper); // Allow stopping music
    DOM.startBtn.style.display = 'block';
    DOM.startBtn.innerText = t("ui.restart");
    DOM.startBtn.onclick = () => {
        State.victoryState = false;
        DOM.startScreen.removeEventListener('click', window.audioStopper);
        startGame();
    };

    window.removeEventListener('mousedown', handleVictoryInteraction);
    window.removeEventListener('touchend', handleTouchVictoryInteraction);
};

export function winGame() {
    if (State.victoryState) return;
    State.victoryState = true;

    // Play Victory Music
    AudioEngine.playVictoryMusic();

    // ALL ENEMIES BECOME FRIENDS
    State.ships.forEach(s => {
        if (!s.isFriendly) {
            s.isFriendly = true;
            s.aiState = 'FORMATION';
            s.leaderRef = State.playerShip;
            addScreenMessage(t("game.system_purified"), "#00ffff");
        }
    });

    // MOVE PLANETS TO Z (Far background) to avoid further collisions
    State.roids.forEach(r => {
        if (r.isPlanet && r.id !== State.homePlanetId) {
            r.z = MAX_Z_DEPTH;
        }
    });

    // No text or buttons until click/tap
    // Wait a short bit to avoid capturing the click that destroyed the last asteroid
    setTimeout(() => {
        window.addEventListener('mousedown', handleVictoryInteraction);
        window.addEventListener('touchend', handleTouchVictoryInteraction);
    }, 1000);
}

export function loop() {
    requestAnimationFrame(loop);

    // Reset global transformation to prevent accumulation of effects like screen shake
    DOM.canvasContext.resetTransform();

    // Sync HUD with game state
    updateHUD();

    // Removed 'if (!State.gameRunning) return' to keep the background world visible even when not playing.

    // killPlayerShip is handled in hitShip and collision logic.
    // Calling it here every frame causes a recursion bug during Game Over.

    // Decrement player reload timer
    if (State.playerReloadTime > 0) State.playerReloadTime--;

    // Handle Tier 12 transformation
    if (State.playerShip && State.playerShip.transformationTimer > 0) {
        State.playerShip.transformationTimer--;



        if (State.playerShip.transformationTimer % 60 === 0 && State.playerShip.transformationTimer > 0) {
            const secondsLeft = Math.ceil(State.playerShip.transformationTimer / 60);
            addScreenMessage(t("game.metamorphosis", { seconds: secondsLeft }), "#00ffff");
        }

        // COMPLETION
        if (State.playerShip.transformationTimer === 0) {
            addScreenMessage(t("game.godship_activated"), "#00ffff");
            AudioEngine.playExplosion('large', State.worldOffsetX, State.worldOffsetY);
            // Flash effect
            DOM.canvasContext.fillStyle = "white";
            DOM.canvasContext.fillRect(0, 0, State.width, State.height);
        }
    }

    // Safety check against NaN/Infinity in State.velocity/world calculation
    if (isNaN(State.velocity.x) || isNaN(State.velocity.y) || !isFinite(State.velocity.x) || !isFinite(State.velocity.y)) {
        State.velocity = { x: 0, y: 0 };
    }
    if (isNaN(State.worldOffsetX) || isNaN(State.worldOffsetY) || !isFinite(State.worldOffsetX) || !isFinite(State.worldOffsetY)) {
        State.worldOffsetX = 0; State.worldOffsetY = 0;
    }

    if (State.stationSpawnTimer > 0) State.stationSpawnTimer--;
    if (State.stationSpawnTimer <= 0 && State.ships.length < 3) {
        spawnStation();
    }

    const isSafe = (obj) => !isNaN(obj.x) && !isNaN(obj.y) && isFinite(obj.x) && isFinite(obj.y);
    State.roids = State.roids.filter(isSafe);
    State.ships = State.ships.filter(isSafe);
    State.playerShipBullets = State.playerShipBullets.filter(isSafe);
    State.enemyShipBullets = State.enemyShipBullets.filter(isSafe);

    const activePlanets = State.roids.filter(r => r.isPlanet && !r._destroyed);

    // Track last known home planet position for cinematic camera
    if (State.homePlanetId) {
        const homeNode = State.roids.find(r => r.id === State.homePlanetId);
        if (homeNode) {
            State.lastHomeX = homeNode.x;
            State.lastHomeY = homeNode.y;
        }
    }

    // --- Tier 12 Godship Warning System ---
    if (!State.playerShip.dead && State.playerShip.tier >= 12) {
        let warningNeeded = false;
        const lethalRange = Math.max(State.width, State.height) * 3; // Synced with the shockwave's maxR

        // Check Home Planet
        if (State.homePlanetId) {
            const home = State.roids.find(r => r.id === State.homePlanetId);
            if (home) {
                const d = Math.hypot(home.x - State.worldOffsetX, home.y - State.worldOffsetY);
                if (d < lethalRange + home.r) warningNeeded = true;
            }
        }

        // Check Allies
        if (!warningNeeded) {
            for (let s of State.ships) {
                if (s.isFriendly && s !== State.playerShip) {
                    const d = Math.hypot(s.x - State.worldOffsetX, s.y - State.worldOffsetY);
                    if (d < lethalRange + 100) {
                        warningNeeded = true;
                        break;
                    }
                }
            }
        }

        if (!State.victoryState && !State.playerShip.dead) {
            if (warningNeeded && Date.now() % 1000 < 500) {
                addScreenMessage(t("game.lethal_radius_warning"), "#ffaa00");
            }
        }
    }

    // Clear DOM.canvas
    DOM.canvasContext.save(); // PUSH 0: Global Frame State
    DOM.canvasContext.fillStyle = '#010103'; DOM.canvasContext.fillRect(0, 0, State.width, State.height);

    // Handle Tier 12 metamorphosis EPIC VISUALS
    if (State.playerShip && State.playerShip.transformationTimer > 0) {
        const progress = 1 - (State.playerShip.transformationTimer / 600);

        // Intensity increases as timer goes down
        if (State.playerShip.transformationTimer < 300) {
            // Screen shake intensifies
            const shake = 15 * progress;
            DOM.canvasContext.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        // Background strobe / flashes
        if (State.playerShip.transformationTimer < 180 && Math.random() < 0.15) {
            const jitterX = (Math.random() - 0.5) * 800;
            const jitterY = (Math.random() - 0.5) * 800;
            createExplosion(State.width / 2 + jitterX, State.height / 2 + jitterY, 30, '#0ff', 5, 'spark');
        }

        // Pulsing white overlay
        if (State.playerShip.transformationTimer < 120) {
            const flashAlpha = (Math.sin(Date.now() / 50) + 1) * 0.1 * progress;
            DOM.canvasContext.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            DOM.canvasContext.fillRect(0, 0, State.width, State.height);
        }
    }

    // --- Viewport Zoom Calculation ---
    // Priority: Victory/GameOver > Input Mode (Touch/Mouse) > Tier 12 Godship modifier
    const isGameOverOrVictory = (State.playerShip.dead && State.playerShip.lives <= 0) || State.victoryState;
    let targetScale;

    if (isGameOverOrVictory) {
        // Grand cinematic zoom-out to show the universe
        targetScale = Math.max(0.08, Math.min(State.width, State.height) / (WORLD_BOUNDS * 0.75));
    } else if (State.inputMode === 'touch') {
        targetScale = (State.playerShip.tier >= 12 ? SCALE_IN_TOUCH_MODE / 2 : SCALE_IN_TOUCH_MODE);
    } else {
        targetScale = (State.playerShip.tier >= 12 ? SCALE_IN_MOUSE_MODE / 2 : SCALE_IN_MOUSE_MODE);
    }

    // Use a slow, smooth factor for cinematic reveals, and a more responsive one for gameplay scaling
    const zoomInterpolationFactor = isGameOverOrVictory ? 0.001 : 0.02;
    State.viewScale += (targetScale - State.viewScale) * zoomInterpolationFactor;

    if (State.viewScale !== 1.0) {
        // Scale and translate to keep (State.width/2, State.height/2) at the center
        DOM.canvasContext.translate(State.width / 2 * (1 - State.viewScale), State.height / 2 * (1 - State.viewScale));
        DOM.canvasContext.scale(State.viewScale, State.viewScale);
    }

    // DRAW CIRCULAR WORLD BOUNDARY (In World Space)
    DOM.canvasContext.save();
    const boundVpX = -State.worldOffsetX + State.width / 2;
    const boundVpY = -State.worldOffsetY + State.height / 2;
    DOM.canvasContext.beginPath();
    DOM.canvasContext.arc(boundVpX, boundVpY, WORLD_BOUNDS, 0, Math.PI * 2);
    DOM.canvasContext.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    DOM.canvasContext.lineWidth = 100;
    DOM.canvasContext.stroke();

    // Neon edge
    DOM.canvasContext.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    DOM.canvasContext.lineWidth = 20;
    DOM.canvasContext.stroke();
    DOM.canvasContext.restore();

    // Win condition check: make this very robust. Directly check the State.roids array.
    const activeAsteroids = State.roids.filter(r => !r.isPlanet).length;
    if (State.gameRunning && !State.victoryState && activeAsteroids === 0) {
        winGame();
    }

    // HUD Victory Effects (Flashing)
    if (State.victoryState && Date.now() % 400 < 200) {
        if (DOM.asteroidCountDisplay) DOM.asteroidCountDisplay.style.color = '#fff';
        if (DOM.scoreDisplay) DOM.scoreDisplay.style.color = '#fff';
    } else if (State.victoryState) {
        if (DOM.asteroidCountDisplay) DOM.asteroidCountDisplay.style.color = '#0ff';
        if (DOM.scoreDisplay) DOM.scoreDisplay.style.color = '#0ff';
    }

    if (!State.playerShip.dead) {
        if (State.inputMode === 'mouse') { // Mouse/Pointer control: rotate towards cursor
            const dx = State.mouse.x - State.width / 2; const dy = State.mouse.y - State.height / 2;
            State.playerShip.a = Math.atan2(dy, dx);
        }
        else {
            // Keyboard/Touch swipe control: Arrow State.keys handle rotation
            if (State.keys.ArrowLeft) State.playerShip.a -= 0.1; if (State.keys.ArrowRight) State.playerShip.a += 0.1;
        }
        if (State.inputMode === 'touch') {
            State.playerShip.thrusting = isTouching && (Date.now() - touchStartTime >= MIN_DURATION_TAP_TO_MOVE);
        } else {
            State.playerShip.thrusting = State.keys.ArrowUp;
        }

        let deltaX = 0;
        let deltaY = 0;
        const strafeMultiplier = 0.7; // 70% power for strafing

        if (State.playerShip.thrusting) {
            deltaX += SHIP_CONFIG.THRUST * Math.cos(State.playerShip.a);
            deltaY += SHIP_CONFIG.THRUST * Math.sin(State.playerShip.a);
            if (Math.random() < 0.2) AudioEngine.playThrust(State.worldOffsetX, State.worldOffsetY);
        }

        if (State.keys.KeyA) { // Strafe Left
            const strafeAngle = State.playerShip.a - Math.PI / 2;
            deltaX += SHIP_CONFIG.THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY += SHIP_CONFIG.THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust(State.worldOffsetX, State.worldOffsetY);
        }
        if (State.keys.KeyD) { // Strafe Right
            const strafeAngle = State.playerShip.a + Math.PI / 2;
            deltaX += SHIP_CONFIG.THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY += SHIP_CONFIG.THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust(State.worldOffsetX, State.worldOffsetY);
        }

        State.velocity.x += deltaX;
        State.velocity.y += deltaY;

        // --- NEW: Orbital Capture for Player ---
        // If the player is near a planet and not actively thrusting, they are captured into orbit
        if (!State.playerShip.thrusting && !State.keys.ArrowDown && !State.keys.KeyA && !State.keys.KeyD && !State.playerShip.dead && !State.victoryState) {
            let nearestPlanet = null;
            let minDistSq = Infinity;
            for (const r of State.roids) {
                if (r.isPlanet && Math.abs(r.z) < 0.5) {
                    const dSq = (r.x - State.worldOffsetX) ** 2 + (r.y - State.worldOffsetY) ** 2;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        nearestPlanet = r;
                    }
                }
            }

            if (nearestPlanet) {
                const dist = Math.sqrt(minDistSq);
                const orbitRadius = nearestPlanet.r * 1.8 + State.playerShip.r;
                const gravityRange = nearestPlanet.r * 8.0;

                if (dist < gravityRange) {
                    const dx = nearestPlanet.x - State.worldOffsetX;
                    const dy = nearestPlanet.y - State.worldOffsetY;
                    const angleToPlanet = Math.atan2(dy, dx);
                    const tangentAngle = angleToPlanet + Math.PI / 2;

                    // Desired orbital speed + planet's own movement
                    const theoreticalOrbitSpeed = Math.sqrt((G_CONST * nearestPlanet.mass * 8.0) / Math.max(dist, 10));
                    const targetXV = Math.cos(tangentAngle) * theoreticalOrbitSpeed + (nearestPlanet.xv || 0);
                    const targetYV = Math.sin(tangentAngle) * theoreticalOrbitSpeed + (nearestPlanet.yv || 0);

                    // Blend State.velocity towards orbital target
                    State.velocity.x += (targetXV - State.velocity.x) * 0.05;
                    State.velocity.y += (targetYV - State.velocity.y) * 0.05;

                    // Distance correction: maintain orbit State.height
                    const distError = dist - orbitRadius;
                    const maxCorrection = 0.15; // Limit max acceleration towards orbit
                    const correction = Math.sign(distError) * Math.min(Math.abs(distError * 0.001), maxCorrection);
                    State.velocity.x += (dx / Math.max(dist, 1)) * correction;
                    State.velocity.y += (dy / Math.max(dist, 1)) * correction;
                }
            }
        }

        // Apply braking/friction
        if (State.keys.ArrowDown) { State.velocity.x *= 0.92; State.velocity.y *= 0.92; }
        else { State.velocity.x *= FRICTION; State.velocity.y *= FRICTION; }

        // Limit max speed
        const currentSpeed = Math.sqrt(State.velocity.x ** 2 + State.velocity.y ** 2);
        if (currentSpeed > (State.playerShip.tier >= 12 ? SHIP_CONFIG.MAX_SPEED * 2 : SHIP_CONFIG.MAX_SPEED)) { const ratio = SHIP_CONFIG.MAX_SPEED / currentSpeed; State.velocity.x *= ratio; State.velocity.y *= ratio; }

        // 3. Update Player's World Position (State.worldOffsetX/Y)
        let nextWorldX = State.worldOffsetX + State.velocity.x;
        let nextWorldY = State.worldOffsetY + State.velocity.y;

        // 3. Update Player's World Position (State.worldOffsetX/Y)
        let shadow = [];
        const SHADOW_SIZE = 50; // Size of the inset shadow border

        // 3. Update Camera / World Offset (with soft magnetic boundary)
        let nextDist = Math.hypot(State.worldOffsetX + State.velocity.x, State.worldOffsetY + State.velocity.y);
        const magneticZone = WORLD_BOUNDS * 0.95; // Start pushing back at 95% of bounds

        if (nextDist > magneticZone) {
            // Calculate repulsion force
            const distPastZone = Math.max(0, nextDist - magneticZone);
            const severity = Math.min(1.0, distPastZone / (WORLD_BOUNDS * 0.1)); // 0 to 1 based on how far past

            // Soft dampening
            State.velocity.x *= (1 - severity * 0.1);
            State.velocity.y *= (1 - severity * 0.1);

            // Push towards center
            const angleToCenter = Math.atan2(-State.worldOffsetY, -State.worldOffsetX);
            const pushForce = severity * 2.0; // Max 2.0 force per frame

            State.velocity.x += Math.cos(angleToCenter) * pushForce;
            State.velocity.y += Math.sin(angleToCenter) * pushForce;

            // Hard cap at absolute max (e.g., 105% of bounds)
            if (nextDist > WORLD_BOUNDS * 1.05) {
                const limitAngle = Math.atan2(State.worldOffsetY, State.worldOffsetX);
                State.worldOffsetX = Math.cos(limitAngle) * WORLD_BOUNDS * 1.05;
                State.worldOffsetY = Math.sin(limitAngle) * WORLD_BOUNDS * 1.05;
                State.velocity.x = 0;
                State.velocity.y = 0;
            } else {
                State.worldOffsetX += State.velocity.x;
                State.worldOffsetY += State.velocity.y;
            }
        } else {
            State.worldOffsetX += State.velocity.x;
            State.worldOffsetY += State.velocity.y;
        }

        // 4. Visual Boundary Alert (Directional)
        const currentDist = Math.hypot(State.worldOffsetX, State.worldOffsetY);
        const RED_GLOW = 'rgba(255, 0, 0, 0.7)';
        if (currentDist >= WORLD_BOUNDS - BOUNDARY_CONFIG.TOLERANCE) {
            const angle = Math.atan2(State.worldOffsetY, State.worldOffsetX);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            if (cos > 0.5) shadow.push(`${-SHADOW_SIZE}px 0 0 0 ${RED_GLOW} inset`);
            if (cos < -0.5) shadow.push(`${SHADOW_SIZE}px 0 0 0 ${RED_GLOW} inset`);
            if (sin > 0.5) shadow.push(`0 ${-SHADOW_SIZE}px 0 0 ${RED_GLOW} inset`);
            if (sin < -0.5) shadow.push(`0 ${SHADOW_SIZE}px 0 0 ${RED_GLOW} inset`);
        }

        if (shadow.length > 0) {
            DOM.canvas.style.boxShadow = shadow.join(', ');
        } else {
            DOM.canvas.style.boxShadow = 'none';
        }
    } else {
        // --- CINEMATIC CAMERA TRAVEL ---
        // Smoothly move the camera to the Home Planet when dead, or fast if destroyed
        if (State.homePlanetId) {
            const home = State.roids.find(r => r.id === State.homePlanetId);
            const targetX = home ? home.x : State.lastHomeX;
            const targetY = home ? home.y : State.lastHomeY;

            if (targetX !== undefined && targetY !== undefined) {
                const travelSpeed = home ? 0.02 : 0.15; // Fast travel if destroyed
                State.worldOffsetX += (targetX - State.worldOffsetX) * travelSpeed;
                State.worldOffsetY += (targetY - State.worldOffsetY) * travelSpeed;
            }
        }
        // Clear boundary shadow when dead
        DOM.canvas.style.boxShadow = 'none';
    }

    // --- Shockwave Update (All in World Coords) ---
    State.shockwaves.forEach((sw, index) => {
        if (sw.isGodRing) {
            sw.r += 120; // Fast expansion
            sw.alpha -= 0.003;

            // TERMINATE at maxR to prevent global sweep
            if (sw.maxR && sw.r > sw.maxR) {
                State.shockwaves.splice(index, 1);
                return;
            }
        } else {
            sw.r += 15; sw.alpha -= 0.01;
        }

        if (sw.alpha <= 0) { State.shockwaves.splice(index, 1); return; }

        // Calculate Viewport Position for drawing
        const vpX = sw.x - State.worldOffsetX + State.width / 2;
        const vpY = sw.y - State.worldOffsetY + State.height / 2;

        if (sw.isGodRing) {
            // God Ring Visuals (Force Lightning & Sparkles)
            DOM.canvasContext.save();
            DOM.canvasContext.strokeStyle = `rgba(0, 255, 255, ${Math.min(1, sw.alpha)})`;
            DOM.canvasContext.lineWidth = 15;
            DOM.canvasContext.shadowBlur = 40;
            DOM.canvasContext.shadowColor = '#00FFFF';

            // Neon core ring
            DOM.canvasContext.beginPath();
            DOM.canvasContext.arc(vpX, vpY, sw.r, 0, Math.PI * 2);
            DOM.canvasContext.stroke();

            // Force Lightning Tendrils
            DOM.canvasContext.lineWidth = 3;
            DOM.canvasContext.strokeStyle = `rgba(200, 255, 255, ${Math.min(1, sw.alpha)})`;
            for (let i = 0; i < 60; i++) {
                const ang = Math.random() * Math.PI * 2;
                const jitter = (Math.random() - 0.5) * 150;
                const lx1 = vpX + Math.cos(ang) * (sw.r - 30);
                const ly1 = vpY + Math.sin(ang) * (sw.r - 30);
                const lx2 = vpX + Math.cos(ang) * (sw.r + 100) + jitter;
                const ly2 = vpY + Math.sin(ang) * (sw.r + 100) + jitter;

                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(lx1, ly1);
                // Multi-segment jittery lightning path
                let curX = lx1, curY = ly1;
                for (let j = 0; j < 3; j++) {
                    curX += (lx2 - lx1) / 3 + (Math.random() - 0.5) * 80;
                    curY += (ly2 - ly1) / 3 + (Math.random() - 0.5) * 80;
                    DOM.canvasContext.lineTo(curX, curY);
                }
                DOM.canvasContext.stroke();

                // Static Sparkles
                if (Math.random() < 0.4) {
                    DOM.canvasContext.fillStyle = '#FFFFFF';
                    DOM.canvasContext.fillRect(lx2 + (Math.random() - 0.5) * 40, ly2 + (Math.random() - 0.5) * 40, 5, 5);
                }
            }
            DOM.canvasContext.restore();
        } else {
            DOM.canvasContext.beginPath(); DOM.canvasContext.arc(vpX, vpY, sw.r, 0, Math.PI * 2);
            DOM.canvasContext.strokeStyle = `rgba(255, 200, 50, ${sw.alpha})`; DOM.canvasContext.lineWidth = 5; DOM.canvasContext.stroke();
        }

        // Apply force/destruction to asteroids, State.ships, and player (Force is World Units)
        const applyShockwaveEffect = (obj) => {
            let dx = obj.x - sw.x; let dy = obj.y - sw.y; // World Distance Vector
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Detection band
            const bandWidth = sw.isGodRing ? 600 : 30;

            if (Math.abs(dist - sw.r) < bandWidth) {
                if (sw.isGodRing) {
                    // Massive destruction: Indiscriminate except for the dealer
                    if (obj === State.playerShip) return;

                    if (obj.r !== undefined && !obj.type) { // Asteroid or Planet
                        if (obj.vaporized || obj.blinkNum > 0) return;

                        obj.r = 0; // Marked for instant removal (no split)
                        obj.vaporized = true;

                        // AWARD SCORE for Godship destruction
                        if (obj.isPlanet) {
                            addScreenMessage(t("game.planet_vaporized", { name: obj.name.toUpperCase() }), "#ff00ff");

                            const vpX = obj.x - State.worldOffsetX + State.width / 2;
                            const vpY = obj.y - State.worldOffsetY + State.height / 2;

                            createExplosion(vpX, vpY, 150, '#ffaa00', 8, 'flame');
                            createExplosion(vpX, vpY, 100, '#ff4400', 12, 'flame');
                            createExplosion(vpX, vpY, 80, '#550000', 15, 'smoke');
                            createExplosion(vpX, vpY, 50, '#ffff00', 4, 'spark');

                            AudioEngine.playPlanetExplosion(obj.x, obj.y, obj.z || 0);
                            State.pendingDebris.push({ x: obj.x, y: obj.y, count: ASTEROID_CONFIG.PLANET_DEBRIS, isHot: true });
                            createShockwave(obj.x, obj.y);
                            createShockwave(obj.x, obj.y);

                            increaseShipScore(State.playerShip, SCORE_REWARDS.PLANET_DESTROYED); // Score for planet

                            // Check if player destroyed their own home
                            if (obj.id === State.homePlanetId) {
                                triggerHomePlanetLost('player');
                            }
                        } else {
                            increaseShipScore(State.playerShip, SCORE_REWARDS.ASTEROID_DESTROYED);
                        }
                    } else if (obj.type === 'ship' || obj.type === 'station') {
                        obj.structureHP = -1; // Force death
                        obj.vaporized = true;
                    }
                } else {
                    let angle = Math.atan2(dy, dx);
                    let force = sw.strength * (1 - dist / sw.maxR);
                    if (force > 0) { obj.xv += Math.cos(angle) * force * 0.1; obj.yv += Math.sin(angle) * force * 0.1; }
                }
            }
        }
        State.roids.forEach(applyShockwaveEffect);
        State.ships.forEach(applyShockwaveEffect);

        // Player knockback (Regular State.shockwaves only)
        if (!sw.isGodRing) {
            let dx = State.worldOffsetX - sw.x; let dy = State.worldOffsetY - sw.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - sw.r) < 30) {
                let angle = Math.atan2(dy, dx);
                let force = sw.strength * (1 - dist / sw.maxR);
                if (force > 0) { State.velocity.x += Math.cos(angle) * force * 0.05; State.velocity.y += Math.sin(angle) * force * 0.05; }
            }
        }
    });

    // --- Ambient Fog Drawing ---
    DOM.canvasContext.globalCompositeOperation = 'screen';
    for (let i = State.ambientFogs.length - 1; i >= 0; i--) {
        let f = State.ambientFogs[i];

        // Fog position is in Viewport Coordinates, so update as before
        f.x += f.xv; f.y += f.yv; // Absolute movement (slow drift)
        f.x -= State.velocity.x; // Parallax/Camera movement
        f.y -= State.velocity.y;

        f.life--;
        // Check if fog is off-screen or lifetime expired
        if (f.life <= 0 || f.x < -f.r * 0.5 || f.x > State.width + f.r * 0.5 || f.y > State.height + f.r * 0.5 || f.y < -f.r * 0.5) {
            State.ambientFogs.splice(i, 1);
            if (State.ambientFogs.length < 3) State.ambientFogs.push(createAmbientFog());
            continue;
        }

        let g = DOM.canvasContext.createRadialGradient(f.x, f.y, f.r * 0.1, f.x, f.y, f.r);
        g.addColorStop(0, `hsla(${f.hue}, 80%, 40%, ${f.alpha})`);
        g.addColorStop(1, 'transparent');
        DOM.canvasContext.fillStyle = g; DOM.canvasContext.beginPath(); DOM.canvasContext.arc(f.x, f.y, f.r, 0, Math.PI * 2); DOM.canvasContext.fill();
    }
    DOM.canvasContext.globalCompositeOperation = 'source-over'; // Reset blend mode

    // --- Background Parallax Drawing ---
    const moveLayer = (list, factor) => list.forEach(item => {
        // Background items use VIEWPORT coordinates for display, so update with State.velocity
        item.x -= State.velocity.x * factor; item.y -= State.velocity.y * factor;
    });

    DOM.canvasContext.globalCompositeOperation = 'screen';
    moveLayer(State.backgroundLayers.nebulas, 0.05);
    State.backgroundLayers.nebulas.forEach(n => {
        let g = DOM.canvasContext.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 80%, 40%, ${n.alpha})`); g.addColorStop(1, 'transparent');
        DOM.canvasContext.fillStyle = g; DOM.canvasContext.beginPath(); DOM.canvasContext.arc(n.x, n.y, n.r, 0, Math.PI * 2); DOM.canvasContext.fill();
    });
    DOM.canvasContext.globalCompositeOperation = 'source-over';
    // Draw distant galaxies
    State.backgroundLayers.galaxies.forEach(g => {
        g.x -= State.velocity.x * 0.1; g.y -= State.velocity.y * 0.1;
        g.angle += 0.001;
        DOM.canvasContext.save(); DOM.canvasContext.translate(g.x, g.y); DOM.canvasContext.rotate(g.angle);
        DOM.canvasContext.shadowBlur = 30; DOM.canvasContext.shadowColor = `rgb(${g.color.r},${g.color.g},${g.color.b})`;
        DOM.canvasContext.fillStyle = 'white'; DOM.canvasContext.beginPath(); DOM.canvasContext.arc(0, 0, 8, 0, Math.PI * 2); DOM.canvasContext.fill();
        g.stars.forEach(s => { DOM.canvasContext.fillStyle = `rgba(${g.color.r},${g.color.g},${g.color.b}, ${s.alpha})`; DOM.canvasContext.beginPath(); DOM.canvasContext.arc(s.r * Math.cos(s.theta), s.r * Math.sin(s.theta), s.size, 0, Math.PI * 2); DOM.canvasContext.fill(); });
        DOM.canvasContext.restore(); DOM.canvasContext.shadowBlur = 0;
    });
    // Draw starfield parallax layers
    moveLayer(State.backgroundLayers.starsFar, 0.1); moveLayer(State.backgroundLayers.starsMid, 0.4); moveLayer(State.backgroundLayers.starsNear, 0.8);
    const drawStars = (list, c) => { DOM.canvasContext.fillStyle = c; list.forEach(s => DOM.canvasContext.fillRect(s.x, s.y, s.size, s.size)); };
    drawStars(State.backgroundLayers.starsFar, '#555'); drawStars(State.backgroundLayers.starsMid, '#888'); drawStars(State.backgroundLayers.starsNear, '#fff');

    updatePhysics(); // Run asteroid merging and gravity simulation (uses World Coords)

    DOM.canvasContext.shadowBlur = 10; DOM.canvasContext.lineCap = 'round'; DOM.canvasContext.lineJoin = 'round';

    // --- Enemy Update and MOVEMENT/AI (Separated from Drawing for Z-order) ---
    let shipsToDraw = [];
    for (let i = State.ships.length - 1; i >= 0; i--) {
        let ship = State.ships[i];

        if (!ship.vaporized && ship.structureHP > 0) {
            let factionPlanetDestroyed = false;
            if (ship.type === 'station' && ship.hostPlanetId) {
                if (!State.roids.some(r => r.id === ship.hostPlanetId && r.isPlanet)) factionPlanetDestroyed = true;
            } else if (ship.type === 'ship' && ship.homeStation && ship.homeStation.hostPlanetId) {
                if (!State.roids.some(r => r.id === ship.homeStation.hostPlanetId && r.isPlanet)) factionPlanetDestroyed = true;
            }
            if (ship.isFriendly && State.homePlanetId) {
                if (!State.roids.some(r => r.id === State.homePlanetId && r.isPlanet)) factionPlanetDestroyed = true;
            }

            if (factionPlanetDestroyed) {
                ship.vaporized = true;
                ship.structureHP = -1;
            }
        }

        if (ship.vaporized || ship.structureHP <= -1) {
            let vpX = (ship.x - State.worldOffsetX) + State.width / 2;
            let vpY = (ship.y - State.worldOffsetY) + State.height / 2;
            createExplosion(vpX, vpY, 60, '#00ffff', 5, 'spark');

            // If vaporized, it was the player's God Ring
            const killer = ship.vaporized ? State.playerShip : null;

            if (ship.type === 'station') onStationDestroyed(ship, killer);
            else onShipDestroyed(ship, killer);
            State.ships.splice(i, 1);
            AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
            continue;
        }

        const cullRange = WORLD_BOUNDS * 1.5;

        if (ship.blinkNum > 0) ship.blinkNum--;

        // Ships dancing in victory (Refined: Synchronized spiral)
        if (State.victoryState) {
            const time = Date.now() / 1000;
            const orbitR = 300 + Math.sin(time + i) * 100;
            const destX = State.worldOffsetX + Math.cos(time * 0.5 + i * 0.5) * orbitR;
            const destY = State.worldOffsetY + Math.sin(time * 0.5 + i * 0.5) * orbitR;

            ship.xv += (destX - ship.x) * 0.05;
            ship.yv += (destY - ship.y) * 0.05;
            ship.xv *= 0.95; ship.yv *= 0.95;
            ship.a += 0.1;
        }

        let isOrbiting = false;
        if (ship.type === 'station' && ship.hostPlanetId) {
            const host = State.roids.find(r => r.id === ship.hostPlanetId);
            if (!host) {
                ship.hostPlanetId = null;
                ship.xv = (Math.random() - 0.5) * 0.5; ship.yv = (Math.random() - 0.5) * 0.5;
            } else {
                ship.orbitAngle += ship.orbitSpeed;

                // Dynamic distance: host.r + 30% of host.r + station radius
                // This ensures it stays "no much far" even if planet grows
                const effectiveOrbitDist = host.r * 1.3 + ship.r;

                const dx_orbit = Math.cos(ship.orbitAngle) * effectiveOrbitDist;
                const dy_orbit = Math.sin(ship.orbitAngle) * effectiveOrbitDist;

                const targetX = host.x + dx_orbit;
                const targetY = host.y + dy_orbit;

                // SPRING FORCE TO ORBIT (Soft Lock)
                // Instead of e.x = targetX, we apply force towards targetX
                const distToTargetX = targetX - ship.x;
                const distToTargetY = targetY - ship.y;

                // Strong spring to keep it in orbit, but allows deviation
                ship.xv += distToTargetX * 0.1;
                ship.yv += distToTargetY * 0.1;
                ship.xv *= 0.8; // Heavy damping to stop oscillation
                ship.yv *= 0.8;

                // Stations avoid crashing.
                let stationNeighbors = spatialGrid.query(ship);
                for (let r of stationNeighbors) {
                    if (r === host) continue; // Don't avoid host
                    if (r.z > 0.5 || r.isPlanet) continue;

                    let dx = ship.x - r.x;
                    let dy = ship.y - r.y;
                    let dist = Math.hypot(dx, dy);
                    let minDist = ship.r + r.r + 100; // Buffer

                    if (dist < minDist && dist > 0) {
                        // Repulsion
                        let force = (minDist - dist) * 0.05;
                        ship.xv += (dx / dist) * force;
                        ship.yv += (dy / dist) * force;
                    }
                }

                // e.z = host.z; // REMOVED: Don't sync Z with planet

                isOrbiting = true; // Use physics integration below

                // Recover shield and make station effectively "gone" if far away
                if (ship.z >= 0.5) {
                    ship.structureHP = STATION_CONFIG.RESISTANCE;
                }
            }
        }



        ship.x += ship.xv;
        ship.y += ship.yv;

        // Circular boundary enforcement for ships
        const distFromCenter = Math.hypot(ship.x, ship.y);
        if (distFromCenter > WORLD_BOUNDS) {
            const angleToCenter = Math.atan2(ship.y, ship.x);
            // Apply a correction force back towards the center
            ship.xv -= Math.cos(angleToCenter) * BOUNDARY_CONFIG.CORRECTION_FORCE * 2;
            ship.yv -= Math.sin(angleToCenter) * BOUNDARY_CONFIG.CORRECTION_FORCE * 2;
        }

        // Calculate Viewport Position for drawing (WITH PARALLAX)
        let depthScale = 1;
        if (ship.z > 0) {
            depthScale = 1 / (1 + ship.z);
        }

        const vpX = (ship.x - State.worldOffsetX) * depthScale + State.width / 2;
        const vpY = (ship.y - State.worldOffsetY) * depthScale + State.height / 2;

        // OPTIMIZED: Use spatial grid for collisions
        let nearbyColliders = spatialGrid.query(ship);
        for (let r of nearbyColliders) {
            if (r.z > 0.5) continue;

            if ((ship.type === 'station' && ship.hostPlanetId && r.id === ship.hostPlanetId) || ship.blinkNum > 0) {
                continue;
            }

            let dx = ship.x - r.x; let dy = ship.y - r.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = ship.r + r.r;

            if (dist < minDist) {
                if (ship.z > 0.5) continue;
                if (r.isPlanet) continue; // Should not happen with grid, but safety

                let angle = Math.atan2(dy, dx);
                let overlap = minDist - dist;

                ship.x += Math.cos(angle) * overlap;
                ship.y += Math.sin(angle) * overlap;

                ship.xv += Math.cos(angle) * 2;
                ship.yv += Math.sin(angle) * 2;

                ship.structureHP--;
                ship.shieldHitTimer = 10;
                const rVpX = r.x - State.worldOffsetX + State.width / 2;
                const rVpY = r.y - State.worldOffsetY + State.height / 2;
                createExplosion(rVpX, rVpY, 5, '#aa00ff', 1, 'debris');
                if (ship.structureHP <= 0) {
                    createExplosion(vpX, vpY, 30, '#ffaa00', 3, 'spark');
                    ship.dead = true;
                    State.ships.splice(i, 1);
                    // i--; // Removed i-- as we are iterating backwards and splicing current. 
                    break;
                }
            }
        }
        if (i < 0) continue;

        let threat = null; let minThreatDist = Infinity;
        // Don't set player as threat if dead
        // (threat will remain null if player is dead and no asteroids are close)

        // Check for closer asteroid threats (avoidance), but prioritize player if somewhat close?
        // OPTIMIZED: Threat check using same grid query if possible? 
        // We can just query again (cheap)
        let potentialThreats = spatialGrid.query(ship);
        for (let r of potentialThreats) {
            if (r.z > 0.5) continue;
            let d = Math.hypot(ship.x - r.x, ship.y - r.y);
            if (d < 300 && d < minThreatDist && d > ship.r + r.r) {
                threat = r;
                minThreatDist = d;
            }
        }

        if (ship.type === 'station') {
            ship.a += ship.rotSpeed;
            ship.spawnTimer--;
            if (ship.spawnTimer <= 0) {
                const currentShips = State.ships.filter(en => en.type === 'ship').length;
                if (currentShips <= SHIP_CONFIG.LIMIT) {
                    spawnShipsSquad(ship);
                }
                ship.spawnTimer = SHIP_CONFIG.SPAWN_TIME + Math.random() * SHIP_CONFIG.SPAWN_TIME;
            }

            // Stations shoot at nearby asteroids
            if (ship.reloadTime <= 0) {
                let targets = spatialGrid.query(ship);
                for (let r of targets) {
                    if (r.z > 0.5 || r.isPlanet) continue;
                    const distToRoid = Math.hypot(r.x - ship.x, r.y - ship.y);
                    if (distToRoid < 1500) {
                        enemyShoot(ship, r.x, r.y);
                        if (ship.reloadTime > 0) break;
                    }
                }
            }
        } else {
            // --- ADVANCED SHIP AI ---
            const distToPlayer = Math.hypot(State.worldOffsetX - ship.x, State.worldOffsetY - ship.y);

            // 1. STATE TRANSITION
            if (!ship.isFriendly && distToPlayer < SHIP_CONFIG.SIGHT_RANGE && !State.playerShip.dead) { // Only State.ships auto-switch to combat by distance
                ship.aiState = 'COMBAT';
            } else if (distToPlayer > SHIP_CONFIG.SIGHT_RANGE * 1.5 && ship.aiState === 'COMBAT') {
                ship.aiState = 'FORMATION';
            }

            // 2. BEHAVIOR EXECUTION
            if (ship.aiState === 'FORMATION') {
                let isRetreating = false;
                if (ship.isFriendly && State.playerShip.tier >= 12 && State.homePlanetId) {
                    // WINGMAN RETREAT: Orbit home when the player is a Godship to avoid the ring
                    const home = State.roids.find(r => r.id === State.homePlanetId);
                    if (home) {
                        const dx = home.x - ship.x;
                        const dy = home.y - ship.y;
                        const dist = Math.hypot(dx, dy);
                        const ORBIT_RADIUS = home.r * 1.5 + ship.r;

                        if (dist > ORBIT_RADIUS + 100) {
                            ship.xv += (dx / dist) * 1.5;
                            ship.yv += (dy / dist) * 1.5;
                            let angleDiff = Math.atan2(ship.yv, ship.xv) - ship.a;
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                            while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                            ship.a += angleDiff * 0.1;
                        } else if (dist < ORBIT_RADIUS - 100) {
                            ship.xv -= (dx / dist) * 1.5;
                            ship.yv -= (dy / dist) * 1.5;
                            let angleDiff = Math.atan2(ship.yv, ship.xv) - ship.a;
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                            while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                            ship.a += angleDiff * 0.1;
                        } else {
                            if (!ship.orbitDir) ship.orbitDir = (Math.random() > 0.5 ? 1 : -1);
                            const orbitAngle = Math.atan2(dy, dx) + (Math.PI / 2) * ship.orbitDir;
                            ship.xv += Math.cos(orbitAngle) * 1.0;
                            ship.yv += Math.sin(orbitAngle) * 1.0;

                            let targetAngle = Math.atan2(ship.yv, ship.xv); // Default: face movement direction

                            // Scan for danger to put attention
                            let nearestThreat = null;
                            let minThreatDist = Infinity;
                            for (let r of State.roids) {
                                if (r.z > 0.5 || r.isPlanet) continue;
                                const distToStation = Math.hypot(r.x - home.x, r.y - home.y);
                                if (distToStation < home.r * 8.0) {
                                    const distToShip = Math.hypot(r.x - ship.x, r.y - ship.y);
                                    if (distToShip < minThreatDist && distToShip < 2000) {
                                        nearestThreat = r;
                                        minThreatDist = distToShip;
                                    }
                                }
                            }
                            for (let target of State.ships) {
                                if (target === ship || target.type === 'station') continue;
                                if (ship.isFriendly && !target.isFriendly) {
                                    const distToStation = Math.hypot(target.x - home.x, target.y - home.y);
                                    if (distToStation < home.r * 8.0) {
                                        const distToShip = Math.hypot(target.x - ship.x, target.y - ship.y);
                                        if (distToShip < minThreatDist && distToShip < 2000) {
                                            nearestThreat = target;
                                            minThreatDist = distToShip;
                                        }
                                    }
                                }
                            }

                            if (nearestThreat) {
                                targetAngle = Math.atan2(nearestThreat.y - ship.y, nearestThreat.x - ship.x);
                            }

                            let angleDiff = targetAngle - ship.a;
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                            while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                            ship.a += angleDiff * 0.15;
                        }
                        ship.xv *= 0.95; ship.yv *= 0.95;
                        isRetreating = true;
                    }
                }
                proactiveCombatScanner(ship);

                if (!isRetreating && ship.isFriendly && !State.playerShip.dead && ship.leaderRef === State.playerShip) {
                    // FRIENDLY: Follow Player in V-Formation
                    const lx = State.worldOffsetX;
                    const ly = State.worldOffsetY;
                    const la = State.playerShip.a;


                    const fwdX = Math.cos(la);
                    const fwdY = Math.sin(la); // Player uses Standard Canvas Coordinates (Y-Down)
                    // Right Vector: Rotate Forward +90 degrees (CW)
                    // in Y-Down: (x, y) -> (-y, x)
                    const rightX = -fwdY;
                    const rightY = fwdX;

                    const targetX = lx + (rightX * ship.formationOffset.x) + (fwdX * ship.formationOffset.y);
                    const targetY = ly + (rightY * ship.formationOffset.x) + (fwdY * ship.formationOffset.y);

                    const dx = targetX - ship.x;
                    const dy = targetY - ship.y;
                    const distToTarget = Math.hypot(dx, dy);

                    // Check if strictly in visual slot
                    const isInVisualSlot = distToTarget < 40;

                    // Break formation if about to crash while player is active
                    const isPlayerActive = Math.abs(State.velocity.x) > 0.5 || Math.abs(State.velocity.y) > 0.5 ||
                        State.keys.KeyA || State.keys.KeyD || State.keys.ArrowLeft || State.keys.ArrowRight ||
                        State.keys.ArrowUp || State.keys.KeyW || State.keys.Space;

                    let obstacle = null;
                    const safetyDist = 50; // Much tighter tolerance, only break for immediate collision

                    // Check Asteroids
                    let nearbyObs = spatialGrid.query(ship);
                    for (let r of nearbyObs) {
                        if (r.z > 0.5 || r.isPlanet) continue;
                        let d = Math.hypot(ship.x - r.x, ship.y - r.y);
                        if (d < r.r + ship.r + safetyDist) {
                            obstacle = r; break;
                        }
                    }
                    // Check Stations
                    if (!obstacle) {
                        for (let other of State.ships) {
                            if (other === ship || (other.isFriendly && other.type !== 'station')) continue;
                            let d = Math.hypot(ship.x - other.x, ship.y - other.y);
                            if (d < other.r + ship.r + safetyDist) {
                                obstacle = other; break;
                            }
                        }
                    }

                    if (obstacle && isPlayerActive) ship.isAvoiding = true;
                    else if (!isPlayerActive) ship.isAvoiding = false;

                    let formationForce = 0.15; // Increased from 0.05
                    ship.arrivalDamping = 0.85;

                    if (ship.isAvoiding) {
                        if (obstacle) {
                            // STEER AWAY from obstacle
                            let avoidAng = Math.atan2(ship.y - obstacle.y, ship.x - obstacle.x);
                            ship.xv += Math.cos(avoidAng) * 2.5;
                            ship.yv += Math.sin(avoidAng) * 2.5;
                            ship.arrivalDamping = 0.92;
                        } else {
                            // ABANDONED: Just slow down and wait for player to stop
                            ship.arrivalDamping = 0.98;
                        }
                        // While avoiding, do NOT imitate leader
                    } else {
                        // Normal formation logic: Incorporate leader velocity to eliminate lag
                        const leaderVX = State.velocity.x;
                        const leaderVY = State.velocity.y;

                        // Smoothly match leader velocity
                        ship.xv += (leaderVX - ship.xv) * 0.1;
                        ship.yv += (leaderVY - ship.yv) * 0.1;

                        if (distToTarget < 200) {
                            const arrivalFactor = distToTarget / 200;
                            formationForce *= arrivalFactor;
                            ship.arrivalDamping = 0.85 + (1 - arrivalFactor) * 0.1;
                        }

                        ship.xv += dx * formationForce;
                        ship.yv += dy * formationForce;
                    }

                    // IMITATION LOGIC: Only if in visual slot
                    if (isInVisualSlot && !ship.isAvoiding) {
                        // Match player rotation EXACTLY when in V-formation with player
                        let angleDiff = la - ship.a;
                        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                        while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                        if (Math.abs(angleDiff) < 0.05) ship.a = la;
                        else ship.a += angleDiff * 0.4;
                    } else {
                        // Independent rotation - rotate toward movement/target
                        // If we are not in slot, we might look at enemies or look where we are going
                        const moveAngle = Math.atan2(ship.yv, ship.xv);
                        let angleDiff = moveAngle - ship.a;
                        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                        while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                        ship.a += angleDiff * 0.1;
                    }

                    // Damping and Speed Cap (IMPORTANT for stability)
                    const speed = Math.hypot(ship.xv, ship.yv);
                    const maxFormationSpeed = 25;
                    if (speed > maxFormationSpeed) {
                        ship.xv = (ship.xv / speed) * maxFormationSpeed;
                        ship.yv = (ship.yv / speed) * maxFormationSpeed;
                    }
                    ship.xv *= (ship.arrivalDamping || 0.85); ship.yv *= (ship.arrivalDamping || 0.85); // Stronger damping for formation
                } else if (!isRetreating && ship.role === 'leader') {
                    // Update Squad Slots (Clean dead occupants)
                    // Update Squad Slots (Compact and Clean)
                    if (ship.squadSlots) {
                        // 1. Collect all valid living occupants
                        let validOccupants = [];
                        ship.squadSlots.forEach(slot => {
                            if (slot.occupant && !slot.occupant.dead && (State.ships.includes(slot.occupant) || slot.occupant === State.playerShip)) {
                                validOccupants.push(slot.occupant);
                            }
                            slot.occupant = null; // Clear all slots first
                        });

                        // 2. Re-assign occupants to slots in order (filling from closest to leader)
                        // 'squadSlots' is naturally ordered by creation (which is usually inner-to-outer in V-formation logic)
                        for (let i = 0; i < Math.min(validOccupants.length, ship.squadSlots.length); i++) {
                            const member = validOccupants[i];
                            const slot = ship.squadSlots[i];

                            slot.occupant = member;
                            // Update the member's target offset to the new slot's position
                            member.formationOffset = { x: slot.x, y: slot.y };
                        }

                        // Dissolution Check
                        const currentCount = validOccupants.length;
                        if (ship._lastSquadCount > 0 && currentCount === 0) {
                            if (ship === State.playerShip) {
                                if (State.gameRunning) console.log("Player wingman squad dissolved.");
                            } else {
                                if (State.gameRunning) console.log(ship.isFriendly ? "Friendly squad dissolved." : "Enemy wingman squad dissolved.");
                            }
                        }
                        ship._lastSquadCount = currentCount;
                    }

                    // LEADER: Patrol or Defend
                    let targetX, targetY;
                    let targetFound = false;

                    // 1. DEFEND HOME STATION (Priority)
                    if (ship.homeStation && !ship.homeStation.dead) {
                        // Check for asteroids threatening the home station
                        let threateningAst = null;
                        let minAstDist = Infinity;

                        let stationHazards = spatialGrid.query(ship.homeStation);
                        for (let r of stationHazards) {
                            if (r.z > 0.5 || r.isPlanet) continue;
                            const distToHome = Math.hypot(r.x - ship.homeStation.x, r.y - ship.homeStation.y);

                            // If asteroid is dangerously close to home station (within 2500 units)
                            if (distToHome < 2500) {
                                if (distToHome < minAstDist) {
                                    minAstDist = distToHome;
                                    threateningAst = r;
                                }
                            }
                        }

                        if (threateningAst) {
                            targetX = threateningAst.x;
                            targetY = threateningAst.y;
                            targetFound = true;
                        }
                    }

                    // 2. PATROL (If no immediate threat at home)
                    if (!targetFound) {
                        if (!ship.patrolTarget) {
                            // Initialize patrol target
                            ship.patrolTarget = { x: ship.x, y: ship.y };
                        }

                        // Check if we reached the patrol target
                        const distToPatrol = Math.hypot(ship.x - ship.patrolTarget.x, ship.y - ship.patrolTarget.y);
                        if (distToPatrol < 500) {
                            // Pick a new target
                            if (Math.random() < 0.5) {
                                // Random point in the world
                                let ang = Math.random() * Math.PI * 2;
                                let r = Math.random() * WORLD_BOUNDS * 0.9;
                                ship.patrolTarget.x = Math.cos(ang) * r;
                                ship.patrolTarget.y = Math.sin(ang) * r;
                            } else {
                                // Target check: find a rival station?
                                let rival = State.ships.find(s => s.type === 'station' && !s.isFriendly && s.fleetHue !== ship.fleetHue && !s.dead);
                                if (rival) {
                                    ship.patrolTarget.x = rival.x;
                                    ship.patrolTarget.y = rival.y;
                                } else {
                                    // Fallback to random
                                    ship.patrolTarget.x = (Math.random() - 0.5) * 1.8 * WORLD_BOUNDS;
                                    ship.patrolTarget.y = (Math.random() - 0.5) * 1.8 * WORLD_BOUNDS;
                                }
                            }
                        }
                        targetX = ship.patrolTarget.x;
                        targetY = ship.patrolTarget.y;
                    }

                    // Move towards target
                    let targetAngle = Math.atan2(targetY - ship.y, targetX - ship.x);

                    // Smooth rotation
                    let angleDiff = targetAngle - ship.a;
                    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                    ship.a += angleDiff * 0.05;

                    // Cruising Speed
                    const CRUISE_SPEED = 12;
                    ship.xv += Math.cos(ship.a) * 0.5;
                    ship.yv += Math.sin(ship.a) * 0.5;

                    // Cap speed
                    const speed = Math.hypot(ship.xv, ship.yv);
                    if (speed > CRUISE_SPEED) {
                        ship.xv = (ship.xv / speed) * CRUISE_SPEED;
                        ship.yv = (ship.yv / speed) * CRUISE_SPEED;
                    }
                } else if (!isRetreating && ship.role !== 'leader') {
                    if (ship.leaderRef && (ship.leaderRef.dead || (!State.ships.includes(ship.leaderRef) && ship.leaderRef !== State.playerShip))) {
                        ship.leaderRef = null;
                        ship.squadId = null;
                    }

                    if (ship.leaderRef) {
                        const lx = ship.leaderRef.x || State.worldOffsetX; // Fallback for player
                        const ly = ship.leaderRef.y || State.worldOffsetY;
                        const la = ship.leaderRef.a;

                        const fwdX = Math.cos(la);
                        const fwdY = Math.sin(la); // State.ships use Screen Down (Positive Screen Y)
                        const rightX = -fwdY;
                        const rightY = fwdX;

                        const targetX = lx + (rightX * ship.formationOffset.x) + (fwdX * ship.formationOffset.y);
                        const targetY = ly + (rightY * ship.formationOffset.x) + (fwdY * ship.formationOffset.y);

                        // Spring Force to Target
                        const dx = targetX - ship.x;
                        const dy = targetY - ship.y;
                        const distToTarget = Math.hypot(dx, dy);

                        const isInVisualSlot = distToTarget < 50;

                        let force = 0.25; // Greatly increased for agility
                        let damping = 0.90;

                        // Leader Velocity Inheritance
                        const lvx = ship.leaderRef === State.playerShip ? State.velocity.x : (ship.leaderRef.xv || 0);
                        const lvy = ship.leaderRef === State.playerShip ? State.velocity.y : (ship.leaderRef.yv || 0);

                        // Match leader velocity more aggressively
                        ship.xv += (lvx - ship.xv) * 0.25;
                        ship.yv += (lvy - ship.yv) * 0.25;

                        if (distToTarget < 200) {
                            const factor = distToTarget / 200;
                            force *= factor;
                            damping = 0.90 + (1 - factor) * 0.05;
                        } else if (distToTarget > 500) {
                            // Catch-up mode if very far
                            force *= 1.5;
                        }

                        ship.xv += dx * force;
                        ship.yv += dy * force;

                        // Physical separation from leader
                        const distToLeader = Math.hypot(ship.x - lx, ship.y - ly);
                        const minSafeDist = ship.r + (ship.leaderRef.r || 30) + 10;
                        if (distToLeader < minSafeDist) {
                            const ang = Math.atan2(ship.y - ly, ship.x - lx);
                            ship.xv += Math.cos(ang) * 1.5;
                            ship.yv += Math.sin(ang) * 1.5;
                        }

                        // Separation from other State.ships (respect SHIP_CONFIG.SEPARATION_DISTANCE)
                        let sepX = 0;
                        let sepY = 0;
                        let sepCount = 0;

                        for (let other of State.ships) {
                            if (other === ship || other.type !== 'ship') continue;
                            // Separate from same fleet OR friendly State.ships (everyone avoids bumping)
                            const isTeammate = (ship.isFriendly && other.isFriendly) || (ship.fleetHue === other.fleetHue);

                            if (isTeammate) {
                                let distToOther = Math.hypot(ship.x - other.x, ship.y - other.y);
                                const requiredDist = SHIP_CONFIG.SEPARATION_DISTANCE + (ship.r + other.r) * 0.5; // Ensure padding
                                if (distToOther < requiredDist) {
                                    let ang = Math.atan2(ship.y - other.y, ship.x - other.x);
                                    // Stronger separation force (0.05 instead of 0.01) to act as a hard buffer
                                    let force = (requiredDist - distToOther) * 0.08;
                                    sepX += Math.cos(ang) * force;
                                    sepY += Math.sin(ang) * force;
                                    sepCount++;
                                }
                            }
                        }

                        if (sepCount > 0) {
                            ship.xv += sepX;
                            ship.yv += sepY;
                        }

                        // === ASTEROID DANGER DETECTION & EVASION ===
                        // Wingmen scan for nearby asteroids and respond to threats
                        let dangerousAsteroid = null;
                        let minDangerDist = Infinity;
                        const DANGER_SCAN_RANGE = 400; // How far to scan for asteroids
                        const CRITICAL_DANGER_RANGE = 200; // Distance at which to consider abandoning squad
                        const SHOOT_RANGE = 600; // Distance at which to start shooting

                        // Scan for nearby asteroids (OPTIMIZED)
                        let nearbyDanger = spatialGrid.query(ship);
                        for (let r of nearbyDanger) {
                            if (r.isPlanet || r.z > 0.5) continue;

                            const distToAsteroid = Math.hypot(r.x - ship.x, r.y - ship.y);

                            if (distToAsteroid < DANGER_SCAN_RANGE && distToAsteroid < minDangerDist) {
                                // Calculate if asteroid is on collision course
                                // Project asteroid's future position
                                const relVelX = r.xv - ship.xv;
                                const relVelY = r.yv - ship.yv;
                                const relPosX = r.x - ship.x;
                                const relPosY = r.y - ship.y;

                                // Time to closest approach
                                const relSpeed = Math.hypot(relVelX, relVelY);
                                if (relSpeed > 0.1) {
                                    const timeToClosest = -(relPosX * relVelX + relPosY * relVelY) / (relSpeed * relSpeed);

                                    if (timeToClosest > 0 && timeToClosest < 60) { // Within next 60 frames (~1 second)
                                        const closestDist = Math.hypot(
                                            relPosX + relVelX * timeToClosest,
                                            relPosY + relVelY * timeToClosest
                                        );

                                        if (closestDist < ship.r + r.r + 50) { // Collision predicted
                                            dangerousAsteroid = r;
                                            minDangerDist = distToAsteroid;
                                        }
                                    }
                                }
                            }
                        }

                        // Initialize danger tracking if not present
                        if (!ship.asteroidDangerTimer) ship.asteroidDangerTimer = 0;
                        if (!ship.lastDangerousAsteroid) ship.lastDangerousAsteroid = null;

                        if (dangerousAsteroid) {
                            // Track if this is the same asteroid as before
                            if (ship.lastDangerousAsteroid === dangerousAsteroid) {
                                ship.asteroidDangerTimer++;
                            } else {
                                ship.lastDangerousAsteroid = dangerousAsteroid;
                                ship.asteroidDangerTimer = 1;
                            }

                            const asteroidAngle = Math.atan2(dangerousAsteroid.y - ship.y, dangerousAsteroid.x - ship.x);

                            // CRITICAL DANGER: Abandon squad if threat persists
                            if (minDangerDist < CRITICAL_DANGER_RANGE && ship.asteroidDangerTimer > 30) {
                                // Shooting failed to neutralize threat - ABANDON SQUAD
                                ship.leaderRef = null;
                                ship.squadId = null;
                                ship.asteroidDangerTimer = 0;
                                ship.lastDangerousAsteroid = null;

                                // Evasive maneuver - move perpendicular to asteroid approach
                                const evadeAngle = asteroidAngle + Math.PI / 2;
                                ship.xv += Math.cos(evadeAngle) * 3;
                                ship.yv += Math.sin(evadeAngle) * 3;

                            } else if (minDangerDist < SHOOT_RANGE) {
                                // MODERATE DANGER: Try to shoot the asteroid while maintaining formation

                                // Temporarily override rotation to face the asteroid
                                let angleDiff = asteroidAngle - ship.a;
                                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

                                // Rotate toward asteroid (faster rotation for danger response)
                                ship.a += angleDiff * 0.3;

                                // Shoot if lined up with the asteroid
                                if (ship.reloadTime <= 0 && Math.abs(angleDiff) < 0.3) {
                                    const bullets = ship.isFriendly ? State.playerShipBullets : State.enemyShipBullets;
                                    fireEntityWeapon(ship, bullets, !ship.isFriendly);
                                    ship.reloadTime = 20 + Math.random() * 30;
                                }
                            }
                        } else {
                            // No danger - reset tracking
                            ship.asteroidDangerTimer = 0;
                            ship.lastDangerousAsteroid = null;

                            // Normal rotation logic: friendly State.ships only match rotation when following player
                            // Enemy State.ships and independent friendly State.ships rotate toward movement
                            if (isInVisualSlot) {
                                // Match leader rotation EXACTLY (Imitate)
                                let angleDiff = la - ship.a;
                                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                                if (Math.abs(angleDiff) < 0.05) ship.a = la;
                                else ship.a += angleDiff * 0.4;
                            } else {
                                // Independent rotation - rotate toward movement direction or threat
                                const moveAngle = Math.atan2(ship.yv, ship.xv);
                                let angleDiff = moveAngle - ship.a;
                                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                                ship.a += angleDiff * 0.1; // Slower rotation for smoother movement
                            }
                        }

                        ship.xv *= damping;
                        ship.yv *= damping;

                    } else {
                        // JOIN LOGIC: Search for a new Leader with open slots
                        // ship.leaderRef is null here
                        let foundLeader = null;
                        let foundSlot = null;
                        const PLAYER_JOIN_RANGE = 1500; // Large range to prioritize following player
                        const NPC_JOIN_RANGE = 300; // Smaller range for npc clumping

                        // 1. CHECK PLAYER FIRST (Priority)
                        if (ship.isFriendly && !State.playerShip.dead && !State.playerShip.loneWolf) {
                            if (State.playerShip.squadSlots) {
                                // Find open slot
                                const openSlot = State.playerShip.squadSlots.find(s => !s.occupant || s.occupant.dead || !State.ships.includes(s.occupant));
                                if (openSlot) {
                                    foundLeader = State.playerShip;
                                    foundSlot = openSlot;
                                }
                            }
                        }

                        // 2. CHECK NPC LEADERS OR STRAYS (If not joined player)
                        if (!foundLeader && !ship.isFriendly) {
                            for (let other of State.ships) {
                                if (other.dead || other === ship || other.type !== 'ship') continue;
                                if (other.fleetHue === ship.fleetHue && !other.isFriendly) {
                                    const dist = Math.hypot(other.x - ship.x, other.y - ship.y);
                                    if (dist < NPC_JOIN_RANGE) {
                                        if (other.role === 'leader' && other.squadSlots) {
                                            const openSlot = other.squadSlots.find(s => !s.occupant || s.occupant.dead || !State.ships.includes(s.occupant));
                                            if (openSlot) {
                                                foundLeader = other;
                                                foundSlot = openSlot;
                                                break;
                                            }
                                        } else if (!other.leaderRef && other.role !== 'leader' && ship.role !== 'leader') {
                                            // Dynamic Promotion: Both are independent strays. Promote 'other' to leader.
                                            other.role = 'leader';
                                            other.squadId = Math.random();
                                            if (State.gameRunning) console.log("Enemy wingman squad formed.");
                                            other.squadSlots = [
                                                { x: -150, y: -150, occupant: null }, { x: 150, y: -150, occupant: null },
                                                { x: -300, y: -300, occupant: null }, { x: 300, y: -300, occupant: null },
                                                { x: -450, y: -450, occupant: null }, { x: 450, y: -450, occupant: null } // 6 slots
                                            ];
                                            foundLeader = other;
                                            foundSlot = other.squadSlots[0];
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        if (foundLeader && foundSlot) {
                            ship.leaderRef = foundLeader;
                            ship.aiState = 'FORMATION';
                            ship.formationOffset = { x: foundSlot.x, y: foundSlot.y };
                            foundSlot.occupant = ship;
                        } else {
                            // BECOME FREE / INDEPENDENT / DEFENDER
                            // Act like a mini-leader (patrol/hunt)
                            proactiveCombatScanner(ship);

                            // Orbit / Defend behavior
                            let patrolCenter = { x: ship.x, y: ship.y };
                            let baseRadius = 0;
                            if (ship.homeStation) {
                                if (ship.homeStation.hostPlanet && !ship.homeStation.hostPlanet._destroyed) {
                                    patrolCenter = { x: ship.homeStation.hostPlanet.x, y: ship.homeStation.hostPlanet.y };
                                    baseRadius = ship.homeStation.hostPlanet.r;
                                } else if (!ship.homeStation.dead) {
                                    patrolCenter = { x: ship.homeStation.x, y: ship.homeStation.y };
                                    baseRadius = ship.homeStation.r;
                                }
                            }

                            const distToCenter = Math.hypot(ship.x - patrolCenter.x, ship.y - patrolCenter.y);
                            const ORBIT_RADIUS = baseRadius > 0 ? (baseRadius * 1.8 + ship.r) : 300;

                            if (distToCenter > ORBIT_RADIUS + 100) {
                                // Move towards orbit radius
                                const angle = Math.atan2(patrolCenter.y - ship.y, patrolCenter.x - ship.x);
                                ship.xv += Math.cos(angle) * 0.5;
                                ship.yv += Math.sin(angle) * 0.5;
                            } else if (distToCenter < ORBIT_RADIUS - 100) {
                                // Move away to orbit radius
                                const angle = Math.atan2(ship.y - patrolCenter.y, ship.x - patrolCenter.x);
                                ship.xv += Math.cos(angle) * 0.5;
                                ship.yv += Math.sin(angle) * 0.5;
                            } else {
                                // Tangential orbit movement
                                const orbitAngle = Math.atan2(ship.y - patrolCenter.y, ship.x - patrolCenter.x);
                                if (!ship.orbitDir) ship.orbitDir = (Math.random() > 0.5 ? 1 : -1);
                                const tangentAngle = orbitAngle + (Math.PI / 2) * ship.orbitDir;
                                ship.xv += Math.cos(tangentAngle) * 0.3;
                                ship.yv += Math.sin(tangentAngle) * 0.3;
                            }

                            // Rotation
                            const moveAngle = Math.atan2(ship.yv, ship.xv);
                            let angleDiff = moveAngle - ship.a;
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                            while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                            ship.a += angleDiff * 0.1;

                            ship.xv *= 0.95;
                            ship.yv *= 0.95;
                        }
                    }
                }
            }
            else if (ship.aiState === 'COMBAT') {
                // Only target alive player, not dead player's position
                let target = null;
                let minDist = Infinity;

                // Enemy State.ships can target alive player IF CLOSE ENOUGH
                // This logic ensures they don't hunt across the map
                if (!ship.isFriendly && !State.playerShip.dead && distToPlayer < SHIP_CONFIG.SIGHT_RANGE * 1.5) {
                    target = { x: State.worldOffsetX, y: State.worldOffsetY, isRival: false, r: 0 };
                    minDist = distToPlayer;
                }

                // Search for rivals
                for (let other of State.ships) {
                    if (other === ship) continue;

                    let isRival = false;
                    if (ship.isFriendly) {
                        if (!other.isFriendly) isRival = true;
                    } else {
                        // Enemy State.ships target different fleets AND friendly State.ships
                        if (other.isFriendly || other.fleetHue !== ship.fleetHue) isRival = true;
                    }

                    if (isRival && (other.type === 'ship' || other.type === 'station')) {
                        let d = Math.hypot(other.x - ship.x, other.y - ship.y);
                        // Aggro if closer than player or player is dead/far or ship is patroling
                        // Modified: Enemy State.ships will attack everything they find on their path
                        if (d < minDist && d < 2000) { // 2000 is aggro range
                            target = other;
                            target.isRival = true; // Mark as rival
                            minDist = d;
                        }
                    }
                }

                if (!target) {
                    // No target? Return to formation or stay put
                    ship.aiState = 'FORMATION';
                    continue;
                }

                let tx = target.x;
                let ty = target.y;
                let d = minDist;

                let targetAngle = Math.atan2(ty - ship.y, tx - ship.x);

                // Friendly squad State.ships point the same way as player
                if (ship.isFriendly && ship.role !== 'leader' && ship.leaderRef === State.playerShip) {
                    targetAngle = State.playerShip.a;
                }

                let angleDiff = targetAngle - ship.a;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

                // Smoother elegant rotation (Reduced from 0.1 to 0.04)
                ship.a += angleDiff * 0.04;

                // 1. Radial Force (Push/Pull) - Proportional smooth spring
                // Instead of hard ±0.8, we scale by distance diff
                const distError = d - SHIP_CONFIG.COMBAT_ORBIT_DISTANCE;
                // If positive (too far), pull in. If negative (too close), push out.
                const radialForce = distError * 0.002; // Small spring constant

                ship.xv += Math.cos(targetAngle) * radialForce;
                ship.yv += Math.sin(targetAngle) * radialForce;

                // 2. Tangential Force (Strafe/Orbit)
                const orbitDir = (ship.squadId && ship.squadId > 0.5) ? 1 : -1;
                const orbAngle = targetAngle + (Math.PI / 2 * orbitDir);

                ship.xv += Math.cos(orbAngle) * 0.08; // Slower (Reduced from 0.20)
                ship.yv += Math.sin(orbAngle) * 0.08;

                // 3. Separation Logic (Avoid bunching up)
                let sepX = 0;
                let sepY = 0;
                let count = 0;

                for (let other of State.ships) {
                    if (other === ship || other.type !== 'ship') continue;
                    // Simple distance check
                    let distToOther = Math.hypot(ship.x - other.x, ship.y - other.y);
                    if (distToOther < SHIP_CONFIG.SEPARATION_DISTANCE) {
                        // Push away relative to other
                        let ang = Math.atan2(ship.y - other.y, ship.x - other.x);
                        // Force stronger the closer they are
                        let force = (SHIP_CONFIG.SEPARATION_DISTANCE - distToOther) * 0.01;
                        sepX += Math.cos(ang) * force;
                        sepY += Math.sin(ang) * force;
                        count++;
                    }
                }

                if (count > 0) {
                    ship.xv += sepX;
                    ship.yv += sepY;
                }

                // Drag for control (slightly stronger to dampen spring effects)
                ship.xv *= 0.96;
                ship.yv *= 0.96;

                let currentSpeed = Math.hypot(ship.xv, ship.yv);
                if (currentSpeed > (ship.tier >= 12 ? SHIP_CONFIG.MAX_SPEED * 2 : SHIP_CONFIG.MAX_SPEED)) {
                    let scale = (ship.tier >= 12 ? SHIP_CONFIG.MAX_SPEED * 2 : SHIP_CONFIG.MAX_SPEED) / currentSpeed;
                    ship.xv *= scale;
                    ship.yv *= scale;
                }

                // Shoot if lined up (slightly wider angle for smoother shooting feel)
                if (ship.reloadTime <= 0 && Math.abs(angleDiff) < 0.4) {
                    const bullets = ship.isFriendly ? State.playerShipBullets : State.enemyShipBullets;
                    fireEntityWeapon(ship, bullets, !ship.isFriendly);
                    ship.reloadTime = 30 + Math.random() * 50;
                }

                // Also shoot at nearby asteroids while in combat
                if (ship.reloadTime <= 0) {
                    let combatThreats = spatialGrid.query(ship);
                    for (let r of combatThreats) {
                        if (r.z > 0.5 || r.isPlanet) continue;
                        const distToRoid = Math.hypot(r.x - ship.x, r.y - ship.y);
                        if (distToRoid < 1000) {
                            const roidAngle = Math.atan2(r.y - ship.y, r.x - ship.x);
                            let roidAngleDiff = roidAngle - ship.a;
                            while (roidAngleDiff > Math.PI) roidAngleDiff -= 2 * Math.PI;
                            while (roidAngleDiff <= -Math.PI) roidAngleDiff += 2 * Math.PI;
                            if (Math.abs(roidAngleDiff) < 0.5) {
                                const bullets = ship.isFriendly ? State.playerShipBullets : State.enemyShipBullets;
                                fireEntityWeapon(ship, bullets, !ship.isFriendly);
                                ship.reloadTime = 30 + Math.random() * 50;
                                break;
                            }
                        }
                    }
                }
            }

            ship.reloadTime--;
        }

        // Collisions
        if (!State.playerShip.dead && (!ship.z || ship.z < 0.5)) {
            let distToPlayer = Math.hypot(State.worldOffsetX - ship.x, State.worldOffsetY - ship.y);
            let collisionThreshold = (State.playerShip.effectiveR || State.playerShip.r) + ship.r + 10;
            if (distToPlayer < collisionThreshold) {
                if (ship.isFriendly) {
                    shipsToDraw.push(ship);
                    continue; // Skip collision response but keep alive
                }

                if (ship.structureHP > 0) {
                    ship.structureHP--;
                    ship.shieldHitTimer = 10;
                    createExplosion(vpX, vpY, 20, '#ff0055', 2, 'spark');
                    if (State.playerShip.tier < 12) {
                        hitPlayerShip(1);
                    }
                    AudioEngine.playSoftThud(ship.x, ship.y, ship.z);
                    let ang = Math.atan2(ship.y - State.worldOffsetY, ship.x - State.worldOffsetX);
                    ship.x += Math.cos(ang) * 60; ship.y += Math.sin(ang) * 60;
                } else {
                    State.ships.splice(i, 1); i--;
                    AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                    continue; // Ship is gone, don't draw
                }

                if (ship.structureHP <= 0) {
                    let debrisColor = ship.type === 'station' ? `hsl(${ship.fleetHue}, 100%, 50%)` : `hsl(${ship.fleetHue}, 100%, 40%)`;
                    createExplosion(vpX, vpY, 40, '#ffaa00', 3, 'spark'); createExplosion(vpX, vpY, 20, debrisColor, 4, 'debris');
                    if (ship.type === 'station') { onStationDestroyed(ship, State.playerShip); }
                    else { onShipDestroyed(ship, State.playerShip); }
                    State.ships.splice(i, 1); i--; AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                    continue; // Ship is gone, don't draw
                }
            }
        }

        shipsToDraw.push(ship);

    }
    // --- End Enemy Update/AI ---

    DOM.canvasContext.shadowColor = '#ffffff'; DOM.canvasContext.strokeStyle = 'white'; DOM.canvasContext.lineWidth = 1.5;

    // Sort asteroids from Near to Far (Small Z to Large Z) with safety
    State.roids.sort((a, b) => {
        const za = (isNaN(a.z) || !isFinite(a.z)) ? 0 : a.z;
        const zb = (isNaN(b.z) || !isFinite(b.z)) ? 0 : b.z;
        return za - zb;
    });

    // --- Asteroid/Planet DRAWING (Order 1: Behind State.ships) ---
    for (let i = State.roids.length - 1; i >= 0; i--) {
        let r = State.roids[i];

        // GOD RING VAPORIZATION
        if (r.r <= 0 || r.vaporized) {
            let vpX = (r.x - State.worldOffsetX) + State.width / 2;
            let vpY = (r.y - State.worldOffsetY) + State.height / 2;
            createExplosion(vpX, vpY, r.isPlanet ? 200 : 40, '#00ffff', r.isPlanet ? 15 : 4, 'spark');
            if (r.isPlanet) {
                const planetsBefore = State.roids.filter(plan => plan.isPlanet && !plan._destroyed).length;
                if (State.gameRunning) console.log("Planet " + r.name + " destroyed. Total planets " + (planetsBefore - 1));
                PLANET_CONFIG.LIMIT = Math.max(0, PLANET_CONFIG.LIMIT - 1);
            }
            State.roids.splice(i, 1);
            if (!r.isPlanet) updateAsteroidCounter();
            AudioEngine.playExplosion(r.isPlanet ? 'large' : 'small', r.x, r.y, r.z);
            continue;
        }

        if (r.isPlanet) {
            if (r.isPlanet) {
                // Steering and Max Speed logic REMOVED to allow smooth orbital movement
            }
        }

        // Natural movement - no minimum speed enforcement for smoother physics

        let depthScale = 1; let depthAlpha = 1;

        // 1. Update Absolute World Position (World Coords)
        r.x += r.xv; r.y += r.yv;

        // 2. Calculate Parallax and Viewport Position
        let vpX, vpY;
        if (r.isPlanet) {
            // Parallax is applied to the viewport position calculation only
            depthScale = 1 / (1 + r.z);
            depthAlpha = Math.max(0.1, 1 - (r.z / MAX_Z_DEPTH));

            vpX = (r.x - State.worldOffsetX) * depthScale + State.width / 2;
            vpY = (r.y - State.worldOffsetY) * depthScale + State.height / 2;
        } else {
            // Standard asteroid: 1:1 scale
            vpX = r.x - State.worldOffsetX + State.width / 2;
            vpY = r.y - State.worldOffsetY + State.height / 2;
        }

        // Apply transformations for depth
        DOM.canvasContext.save();
        DOM.canvasContext.translate(vpX, vpY); // Translate to Viewport Position
        DOM.canvasContext.scale(depthScale, depthScale);

        // Apply calculated depth alpha
        DOM.canvasContext.globalAlpha = depthAlpha;

        // Draw asteroid blinking if newly created
        if (r.blinkNum % 2 !== 0) { DOM.canvasContext.globalAlpha *= 0.3; }


        if (r.isPlanet) {

            // === DRAW PLANET RINGS (BACK HALF) ===
            if (r.rings) {
                drawRings(DOM.canvasContext, r.rings, r.r, depthScale);
            }

            // Draw planet texture and name
            DOM.canvasContext.shadowBlur = 30; DOM.canvasContext.shadowColor = r.textureData.atmosphereColor;
            drawPlanetTexture(DOM.canvasContext, 0, 0, r.r, r.textureData); // Draw relative to translated origin

            // === DRAW PLANET RINGS (FRONT HALF) ===
            if (r.rings) {
                DOM.canvasContext.save();
                DOM.canvasContext.rotate(r.rings.tilt);
                r.rings.bands.forEach(band => {
                    const bandRadius = r.r * band.rRatio;
                    const bandWidth = r.r * band.wRatio;
                    const outerRadius = bandRadius * depthScale;

                    DOM.canvasContext.lineWidth = bandWidth * depthScale;
                    DOM.canvasContext.strokeStyle = band.color;
                    DOM.canvasContext.globalAlpha = band.alpha * depthAlpha;
                    DOM.canvasContext.shadowBlur = 0;

                    DOM.canvasContext.beginPath();
                    DOM.canvasContext.ellipse(0, 0, outerRadius, outerRadius * 0.15, 0, Math.PI, Math.PI * 2, false);
                    DOM.canvasContext.stroke();
                });
                DOM.canvasContext.restore();
            }

            // Draw Name
            DOM.canvasContext.globalAlpha = depthAlpha;
            DOM.canvasContext.fillStyle = 'white';
            DOM.canvasContext.font = `bold ${28 / depthScale}px Courier New`;
            DOM.canvasContext.textAlign = 'center';

            // Add a slight black stroke so it's readable against bright planets
            DOM.canvasContext.strokeStyle = 'rgba(0,0,0,0.8)';
            DOM.canvasContext.lineWidth = 3 / depthScale;
            DOM.canvasContext.strokeText(r.name, 0, r.r + (40 / depthScale));

            DOM.canvasContext.fillText(r.name, 0, r.r + (40 / depthScale));

        } else {
            // Draw standard asteroid shape
            if (r.isHot) {
                DOM.canvasContext.shadowBlur = 20;
                DOM.canvasContext.shadowColor = '#ff6600';
                DOM.canvasContext.strokeStyle = '#ffcc00';
            } else {
                DOM.canvasContext.shadowBlur = 0; // Optimization: Disable blur for standard asteroids
                DOM.canvasContext.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // Softer outline for more realistic feel
            }

            DOM.canvasContext.fillStyle = r.color; // Dark gray base fill
            DOM.canvasContext.beginPath();
            for (let j = 0; j < r.vert; j++) {
                const px = r.r * r.offs[j] * Math.cos(r.a + j * Math.PI * 2 / r.vert);
                const py = r.r * r.offs[j] * Math.sin(r.a + j * Math.PI * 2 / r.vert);
                if (j === 0) DOM.canvasContext.moveTo(px, py); else DOM.canvasContext.lineTo(px, py);
            }
            DOM.canvasContext.closePath();
            DOM.canvasContext.fill();

            // Soft gradient shadow overlay for volumetric 3D feel
            let shadowGrad = DOM.canvasContext.createRadialGradient(
                -r.r * 0.3, -r.r * 0.3, 0,
                0, 0, r.r
            );
            shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)'); // Soft highlight on top left
            shadowGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0)');        // Transparent mid
            shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');        // Deep shadow on bottom right edge
            DOM.canvasContext.fillStyle = shadowGrad;
            DOM.canvasContext.fill();
            DOM.canvasContext.stroke();

            // Draw Craters
            DOM.canvasContext.fillStyle = 'rgba(0, 0, 0, 0.4)';
            DOM.canvasContext.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            DOM.canvasContext.lineWidth = 1;
            // Deterministic pseudo-random generation to keep craters bound to specific asteroid ID
            const craterCount = 2 + (r.id % 3);
            for (let c = 0; c < craterCount; c++) {
                let pseudoRand1 = ((r.id * 13 + c * 29) % 100) / 100;
                let pseudoRand2 = ((r.id * 17 + c * 31) % 100) / 100;
                let pseudoRand3 = ((r.id * 19 + c * 37) % 100) / 100;

                let dist = r.r * 0.5 * pseudoRand1;
                let angle = pseudoRand2 * Math.PI * 2 + r.a; // Revolve with asteroid rotation
                let crx = Math.cos(angle) * dist;
                let cry = Math.sin(angle) * dist;
                let crr = r.r * 0.08 + (pseudoRand3 * r.r * 0.15); // Scale crater size relative to asteroid

                DOM.canvasContext.beginPath();
                // Perspective crater ellipse orienting towards center
                DOM.canvasContext.ellipse(crx, cry, crr, crr * 0.85, angle, 0, Math.PI * 2);
                DOM.canvasContext.fill();
                DOM.canvasContext.stroke();
            }

            // Draw lava veins if hot
            if (r.isHot) {
                DOM.canvasContext.globalAlpha = 0.6;
                DOM.canvasContext.strokeStyle = '#ff3300';
                DOM.canvasContext.lineWidth = 2;
                DOM.canvasContext.beginPath();
                for (let j = 0; j < r.vert; j += 2) {
                    const px = r.r * 0.5 * r.offs[j] * Math.cos(r.a + j * Math.PI * 2 / r.vert);
                    const py = r.r * 0.5 * r.offs[j] * Math.sin(r.a + j * Math.PI * 2 / r.vert);
                    if (j === 0) DOM.canvasContext.moveTo(px, py); else DOM.canvasContext.lineTo(px, py);
                }
                DOM.canvasContext.stroke();
                DOM.canvasContext.globalAlpha = 1;
            }
        }
        DOM.canvasContext.restore(); // Restore context

        // Check collision with player (World Coords)
        if (r.z < 0.5 && !State.playerShip.dead) {
            let distToPlayer = Math.hypot(r.x - State.worldOffsetX, r.y - State.worldOffsetY);
            if (distToPlayer < (State.playerShip.effectiveR || State.playerShip.r) + r.r * depthScale) {

                const isNearPlanetCollision = r.isPlanet && r.z < 0.5;

                // Go through planets.
                if (r.isPlanet) {
                    continue;
                }

                // ASTEROID COLLISION: Player takes 1 hit, asteroid is destroyed.
                if (r.blinkNum === 0) {
                    if (State.playerShip.tier < 12) {
                        hitPlayerShip(1, isNearPlanetCollision);
                    }
                    AudioEngine.playSoftThud(r.x, r.y, r.z);

                    // Create explosions
                    createExplosion(vpX, vpY, 15, '#0ff', 2, 'spark');
                    createExplosion(vpX, vpY, 8, '#fff', 1, 'debris');

                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_CONFIG.MIN_SIZE) {
                        const dynamicOffset = r.r * (ASTEROID_CONFIG.SPLIT_OFFSET / ASTEROID_CONFIG.MAX_SIZE);
                        // West asteroid
                        let westAst = createAsteroid(r.x - dynamicOffset, r.y, newSize);
                        westAst.xv = r.xv - ASTEROID_CONFIG.MAX_SPEED;
                        westAst.yv = r.yv;
                        westAst.blinkNum = 30;
                        State.roids.push(westAst);

                        // East asteroid
                        let eastAst = createAsteroid(r.x + dynamicOffset, r.y, newSize);
                        eastAst.xv = r.xv + ASTEROID_CONFIG.MAX_SPEED;
                        eastAst.yv = r.yv;
                        eastAst.blinkNum = 30;
                        State.roids.push(eastAst);
                        updateAsteroidCounter();
                    }

                    if (State.playerShip.tier >= 12) increaseShipScore(State.playerShip, SCORE_REWARDS.ASTEROID_DESTROYED);
                    State.roids.splice(i, 1);
                    updateAsteroidCounter();

                    let ang = Math.atan2(r.y - State.worldOffsetY, r.x - State.worldOffsetX); // World Angle
                    r.x += Math.cos(ang) * 50; r.y += Math.sin(ang) * 50; // Knockback in World Coords (though it's removed next frame)
                }
            }
        }
    }
    // --- End Asteroid Drawing ---

    // --- Enemy DRAWING (Order 2: In Front of Planets) ---
    shipsToDraw.forEach(shipToDraw => {
        let depthScale = 1; let depthAlpha = 1;
        if (shipToDraw.z > 0) {
            depthScale = 1 / (1 + shipToDraw.z);
            depthAlpha = Math.max(0.1, 1 - (shipToDraw.z / MAX_Z_DEPTH));
        }

        const vpX = (shipToDraw.x - State.worldOffsetX) * depthScale + State.width / 2;
        const vpY = (shipToDraw.y - State.worldOffsetY) * depthScale + State.height / 2;

        // Drawing enemy
        DOM.canvasContext.shadowBlur = 15;

        // Proximity fading for friends
        let alpha = depthAlpha;
        if (shipToDraw.isFriendly) {
            const distToPlayer = Math.hypot(State.worldOffsetX - shipToDraw.x, State.worldOffsetY - shipToDraw.y);
            const fadeStart = 300;
            const fadeEnd = 50;
            if (distToPlayer < fadeStart) {
                const ratio = Math.max(0, (distToPlayer - fadeEnd) / (fadeStart - fadeEnd));
                alpha *= 0.4 + 0.6 * ratio; // Fades to 40% alpha (more visible)
            }
        }

        // If blinking, reduce opacity (for invulnerability feedback)
        if (shipToDraw.blinkNum % 2 !== 0) { DOM.canvasContext.globalAlpha = 0.5; }
        else { DOM.canvasContext.globalAlpha = alpha; } // Apply fading/depth alpha

        DOM.canvasContext.save();
        DOM.canvasContext.translate(vpX, vpY); // Translate to Viewport Position
        DOM.canvasContext.scale(depthScale, depthScale); // Apply depth scaling
        DOM.canvasContext.rotate(shipToDraw.a); // Standard rotation (CW positive)

        if (shipToDraw.type === 'ship') {

            // Individual evolution: State.ships match their OWN score visuals
            const tier = Math.floor((shipToDraw.score || 0) / SHIP_CONFIG.EVOLUTION_SCORE_STEP);
            const r = shipToDraw.r;

            // Generate Palette based on fleetHue (Host Planet)
            // Player Blue Theme: Hull(210, 60%, 30%), Detail(210, 100%, 50%), Cockpit(Cyan)
            // Enemy Theme: Hull(fleetHue, ...), Detail(fleetHue+variation, ...)

            const HULL_COLOR = `hsl(${shipToDraw.fleetHue}, 60%, 30%)`;
            const HULL_BORDER = `hsl(${shipToDraw.fleetHue}, 40%, 50%)`; // Lighter border
            const DETAIL_COLOR = `hsl(${shipToDraw.fleetHue}, 80%, 60%)`;
            const ACCENT_COLOR = `hsl(${(shipToDraw.fleetHue + 180) % 360}, 90%, 60%)`; // Complementary accent
            const THRUST_COLOR = `hsl(${shipToDraw.fleetHue}, 100%, 70%)`;
            const COCKPIT_GRAD_1 = `hsl(${shipToDraw.fleetHue}, 100%, 80%)`;
            const COCKPIT_GRAD_2 = `hsl(${shipToDraw.fleetHue}, 100%, 50%)`;

            if (tier >= 8) {
                // TIER 8 DREADNOUGHT VISUAL (Enemy Version)
                const HULL_COLOR_D = `hsl(${shipToDraw.fleetHue}, 20%, 20%)`; // Darker, menacing
                const HULL_BORDER_D = `hsl(${shipToDraw.fleetHue}, 40%, 40%)`;
                const DETAIL_GRAY_D = `hsl(${shipToDraw.fleetHue}, 10%, 40%)`;

                // Normalization scale to match Tier 7 visual radius
                const norm = 1.1;

                DOM.canvasContext.shadowBlur = 20; DOM.canvasContext.shadowColor = THRUST_COLOR;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 1.6 * norm, 0);
                DOM.canvasContext.lineTo(r * 0.5 * norm, r * 1.5 * norm); DOM.canvasContext.lineTo(-r * 1.2 * norm, r * 0.8 * norm);
                DOM.canvasContext.lineTo(-r * 1.8 * norm, r * 0.4 * norm); DOM.canvasContext.lineTo(-r * 1.8 * norm, -r * 0.4 * norm);
                DOM.canvasContext.lineTo(-r * 1.2 * norm, -r * 0.8 * norm); DOM.canvasContext.lineTo(r * 0.5 * norm, -r * 1.5 * norm);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fillStyle = HULL_COLOR_D; DOM.canvasContext.fill();
                DOM.canvasContext.lineWidth = 2; DOM.canvasContext.strokeStyle = HULL_BORDER_D; DOM.canvasContext.stroke();

                // Details
                DOM.canvasContext.shadowBlur = 0; DOM.canvasContext.fillStyle = DETAIL_GRAY_D;
                DOM.canvasContext.beginPath(); DOM.canvasContext.moveTo(r * 1.6 * norm, 0); DOM.canvasContext.lineTo(r * 1.4 * norm, r * 0.1 * norm); DOM.canvasContext.lineTo(r * 1.4 * norm, -r * 0.1 * norm); DOM.canvasContext.closePath(); DOM.canvasContext.fill();
                DOM.canvasContext.fillStyle = DETAIL_GRAY_D;
                DOM.canvasContext.fillRect(r * 0.2 * norm, r * 0.5 * norm, r * 0.3 * norm, r * 0.2 * norm); DOM.canvasContext.fillRect(r * 0.2 * norm, -r * 0.7 * norm, r * 0.3 * norm, r * 0.2 * norm);

                // Accent Engine/Core
                DOM.canvasContext.fillStyle = ACCENT_COLOR; DOM.canvasContext.beginPath(); DOM.canvasContext.arc(-r * 0.5 * norm, 0, r * 0.2 * norm, 0, Math.PI * 2); DOM.canvasContext.fill();

                // Thrust
                DOM.canvasContext.shadowBlur = 30; DOM.canvasContext.shadowColor = THRUST_COLOR;
                const EXHAUST_H = r * 0.7 * norm; const EXHAUST_X = -r * 1.8 * norm;
                DOM.canvasContext.fillStyle = HULL_BORDER_D; DOM.canvasContext.fillRect(EXHAUST_X, -EXHAUST_H / 2, 5, EXHAUST_H);

                // Always thrusting slightly for visual effect
                DOM.canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 60%, ${0.5 + Math.random() * 0.5})`;
                DOM.canvasContext.beginPath(); DOM.canvasContext.moveTo(EXHAUST_X + 5, -EXHAUST_H / 2); DOM.canvasContext.lineTo(EXHAUST_X + 5, EXHAUST_H / 2);
                DOM.canvasContext.lineTo(EXHAUST_X - 25 * norm * (0.8 + Math.random() * 0.4), 0); DOM.canvasContext.closePath(); DOM.canvasContext.fill();
                DOM.canvasContext.shadowBlur = 0;


            } else {
                // MODERN TRIANGULAR SHIP DESIGN (Tiers 0-7)
                // Sleek, sharp geometry with glowing edges inspired by tactical diagram

                // Base triangle size scales with tier
                const baseSize = r * (1 + tier * 0.08);

                // === MAIN HULL (Sharp Triangle) ===
                DOM.canvasContext.shadowBlur = 25;
                DOM.canvasContext.shadowColor = DETAIL_COLOR;

                // Main triangle body
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(baseSize * 1.2, 0);  // Nose (front)
                DOM.canvasContext.lineTo(-baseSize * 0.6, baseSize * 0.8);  // Bottom left
                DOM.canvasContext.lineTo(-baseSize * 0.6, -baseSize * 0.8); // Top left
                DOM.canvasContext.closePath();

                // Gradient fill from bright center to darker edges
                let hullGrad = DOM.canvasContext.createLinearGradient(baseSize * 0.6, 0, -baseSize * 0.6, 0);
                hullGrad.addColorStop(0, DETAIL_COLOR);
                hullGrad.addColorStop(0.5, HULL_COLOR);
                hullGrad.addColorStop(1, `hsl(${shipToDraw.fleetHue}, 40%, 15%)`);

                DOM.canvasContext.fillStyle = hullGrad;
                DOM.canvasContext.fill();

                // Bright glowing outline
                DOM.canvasContext.lineWidth = 3;
                DOM.canvasContext.strokeStyle = DETAIL_COLOR;
                DOM.canvasContext.stroke();

                // === INTERNAL DETAIL LINES ===
                DOM.canvasContext.shadowBlur = 10;
                DOM.canvasContext.lineWidth = 1.5;
                DOM.canvasContext.strokeStyle = `hsl(${shipToDraw.fleetHue}, 100%, 70%)`;

                // Center line
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(baseSize * 0.8, 0);
                DOM.canvasContext.lineTo(-baseSize * 0.4, 0);
                DOM.canvasContext.stroke();

                // Diagonal detail lines
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(baseSize * 0.4, 0);
                DOM.canvasContext.lineTo(-baseSize * 0.2, baseSize * 0.4);
                DOM.canvasContext.moveTo(baseSize * 0.4, 0);
                DOM.canvasContext.lineTo(-baseSize * 0.2, -baseSize * 0.4);
                DOM.canvasContext.stroke();

                // === WING ACCENTS ===
                DOM.canvasContext.shadowBlur = 15;
                DOM.canvasContext.fillStyle = `hsl(${shipToDraw.fleetHue}, 80%, 40%)`;

                // Top wing accent
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(baseSize * 0.2, -baseSize * 0.3);
                DOM.canvasContext.lineTo(-baseSize * 0.3, -baseSize * 0.6);
                DOM.canvasContext.lineTo(-baseSize * 0.4, -baseSize * 0.5);
                DOM.canvasContext.lineTo(baseSize * 0.1, -baseSize * 0.25);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill();

                // Bottom wing accent
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(baseSize * 0.2, baseSize * 0.3);
                DOM.canvasContext.lineTo(-baseSize * 0.3, baseSize * 0.6);
                DOM.canvasContext.lineTo(-baseSize * 0.4, baseSize * 0.5);
                DOM.canvasContext.lineTo(baseSize * 0.1, baseSize * 0.25);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill();

                // === COCKPIT (Glowing center) ===
                DOM.canvasContext.shadowBlur = 20;
                DOM.canvasContext.shadowColor = COCKPIT_GRAD_1;

                let cockpitGrad = DOM.canvasContext.createRadialGradient(baseSize * 0.5, 0, 0, baseSize * 0.5, 0, baseSize * 0.15);
                cockpitGrad.addColorStop(0, COCKPIT_GRAD_1);
                cockpitGrad.addColorStop(0.7, COCKPIT_GRAD_2);
                cockpitGrad.addColorStop(1, HULL_COLOR);

                DOM.canvasContext.fillStyle = cockpitGrad;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(baseSize * 0.5, 0, baseSize * 0.15, 0, Math.PI * 2);
                DOM.canvasContext.fill();

                // Cockpit bright rim
                DOM.canvasContext.strokeStyle = COCKPIT_GRAD_1;
                DOM.canvasContext.lineWidth = 2;
                DOM.canvasContext.stroke();

                // === ENGINE PORTS ===
                DOM.canvasContext.shadowBlur = 15;
                DOM.canvasContext.shadowColor = ACCENT_COLOR;

                // Top engine
                DOM.canvasContext.fillStyle = ACCENT_COLOR;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(-baseSize * 0.45, -baseSize * 0.35, baseSize * 0.08, 0, Math.PI * 2);
                DOM.canvasContext.fill();

                // Bottom engine
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(-baseSize * 0.45, baseSize * 0.35, baseSize * 0.08, 0, Math.PI * 2);
                DOM.canvasContext.fill();

                // === ENGINE THRUST (Animated) ===
                DOM.canvasContext.shadowBlur = 30;
                DOM.canvasContext.shadowColor = THRUST_COLOR;

                const thrustLength = 20 + Math.random() * 15;
                const thrustFlicker = 0.6 + Math.random() * 0.4;

                // Top thrust
                DOM.canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 70%, ${thrustFlicker})`;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(-baseSize * 0.5, -baseSize * 0.35);
                DOM.canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, -baseSize * 0.4);
                DOM.canvasContext.lineTo(-baseSize * 0.5 - thrustLength, -baseSize * 0.35);
                DOM.canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, -baseSize * 0.3);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill();

                // Bottom thrust
                DOM.canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 70%, ${thrustFlicker})`;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(-baseSize * 0.5, baseSize * 0.35);
                DOM.canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, baseSize * 0.4);
                DOM.canvasContext.lineTo(-baseSize * 0.5 - thrustLength, baseSize * 0.35);
                DOM.canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, baseSize * 0.3);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill();

                // === TIER INDICATORS (Small dots along the hull) ===
                if (tier > 0) {
                    DOM.canvasContext.shadowBlur = 8;
                    DOM.canvasContext.fillStyle = `hsl(${shipToDraw.fleetHue}, 100%, 80%)`;

                    for (let t = 0; t < Math.min(tier, 7); t++) {
                        const dotX = baseSize * 0.3 - (t * baseSize * 0.12);
                        const dotY = (t % 2 === 0) ? baseSize * 0.15 : -baseSize * 0.15;

                        DOM.canvasContext.beginPath();
                        DOM.canvasContext.arc(dotX, dotY, baseSize * 0.04, 0, Math.PI * 2);
                        DOM.canvasContext.fill();
                    }
                }

                DOM.canvasContext.shadowBlur = 0;
            }
            // DRAW HEART FOR FRIENDS
            if (shipToDraw.isFriendly) {
                drawHeart(DOM.canvasContext, 0, -5, 8);
            }
        }
        else {
            // MODERN HEXAGONAL STATION DESIGN
            // Sleek geometric station with glowing energy rings and pulsing core

            const haloColor = `hsl(${shipToDraw.fleetHue}, 100%, 70%)`;
            const bodyColor = `hsl(${shipToDraw.fleetHue}, 80%, 50%)`;
            const coreColor = `hsl(${(shipToDraw.fleetHue + 120) % 360}, 100%, 60%)`;
            const accentColor = `hsl(${shipToDraw.fleetHue}, 90%, 65%)`;

            const stationR = shipToDraw.r;

            // === OUTER HEXAGONAL STRUCTURE ===
            DOM.canvasContext.shadowBlur = 25;
            DOM.canvasContext.shadowColor = haloColor;

            // Draw hexagon
            DOM.canvasContext.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI / 3) + shipToDraw.a;
                const x = Math.cos(angle) * stationR * 1.1;
                const y = Math.sin(angle) * stationR * 1.1;
                if (i === 0) DOM.canvasContext.moveTo(x, y);
                else DOM.canvasContext.lineTo(x, y);
            }
            DOM.canvasContext.closePath();

            // Hexagon fill with gradient
            let hexGrad = DOM.canvasContext.createRadialGradient(0, 0, 0, 0, 0, stationR * 1.1);
            hexGrad.addColorStop(0, `hsl(${shipToDraw.fleetHue}, 60%, 40%)`);
            hexGrad.addColorStop(0.7, `hsl(${shipToDraw.fleetHue}, 70%, 25%)`);
            hexGrad.addColorStop(1, `hsl(${shipToDraw.fleetHue}, 50%, 15%)`);

            DOM.canvasContext.fillStyle = hexGrad;
            DOM.canvasContext.fill();

            // Glowing hexagon outline
            DOM.canvasContext.lineWidth = 4;
            DOM.canvasContext.strokeStyle = haloColor;
            DOM.canvasContext.stroke();

            // === ROTATING ENERGY RINGS ===
            DOM.canvasContext.shadowBlur = 20;

            // Outer ring
            DOM.canvasContext.lineWidth = 3;
            DOM.canvasContext.strokeStyle = accentColor;
            DOM.canvasContext.beginPath();
            DOM.canvasContext.arc(0, 0, stationR * 0.9, 0, Math.PI * 2);
            DOM.canvasContext.stroke();

            // Middle ring (slightly rotated)
            DOM.canvasContext.lineWidth = 2;
            DOM.canvasContext.strokeStyle = bodyColor;
            DOM.canvasContext.beginPath();
            DOM.canvasContext.arc(0, 0, stationR * 0.7, 0, Math.PI * 2);
            DOM.canvasContext.stroke();

            // === CONNECTING SPOKES (6 spokes to match hexagon) ===
            DOM.canvasContext.shadowBlur = 15;
            DOM.canvasContext.lineWidth = 2;
            DOM.canvasContext.strokeStyle = accentColor;

            for (let k = 0; k < 6; k++) {
                const angle = (k * Math.PI / 3) + shipToDraw.a;
                const rInner = stationR * 0.4;
                const rOuter = stationR * 0.95;

                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(Math.cos(angle) * rInner, Math.sin(angle) * rInner);
                DOM.canvasContext.lineTo(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter);
                DOM.canvasContext.stroke();

                // Small nodes at spoke ends
                DOM.canvasContext.fillStyle = haloColor;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter, stationR * 0.06, 0, Math.PI * 2);
                DOM.canvasContext.fill();
            }

            // === PULSING CORE ===
            DOM.canvasContext.shadowBlur = 30;
            DOM.canvasContext.shadowColor = coreColor;

            // Pulsing effect
            const pulsePhase = (Date.now() % 2000) / 2000; // 0 to 1 over 2 seconds
            const pulseSize = 0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.05;

            // Core gradient
            let coreGrad = DOM.canvasContext.createRadialGradient(0, 0, 0, 0, 0, stationR * pulseSize);
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.3, coreColor);
            coreGrad.addColorStop(1, bodyColor);

            DOM.canvasContext.fillStyle = coreGrad;
            DOM.canvasContext.beginPath();
            DOM.canvasContext.arc(0, 0, stationR * pulseSize, 0, Math.PI * 2);
            DOM.canvasContext.fill();

            // Core bright outline
            DOM.canvasContext.strokeStyle = '#ffffff';
            DOM.canvasContext.lineWidth = 2;
            DOM.canvasContext.stroke();

            // === ENERGY PARTICLES (Small glowing dots around the station) ===
            DOM.canvasContext.shadowBlur = 10;
            for (let p = 0; p < 8; p++) {
                const particleAngle = (p * Math.PI / 4) + (Date.now() / 1000) + shipToDraw.a;
                const particleR = stationR * (0.8 + Math.sin((Date.now() / 500) + p) * 0.1);
                const px = Math.cos(particleAngle) * particleR;
                const py = Math.sin(particleAngle) * particleR;

                DOM.canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 80%, ${0.6 + Math.random() * 0.4})`;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(px, py, stationR * 0.03, 0, Math.PI * 2);
                DOM.canvasContext.fill();
            }

            DOM.canvasContext.shadowBlur = 0;

            // DRAW HEART FOR FRIENDLY STATIONS
            if (shipToDraw.isFriendly) {
                drawHeart(DOM.canvasContext, 0, -shipToDraw.r * 0.1, shipToDraw.r * 0.2);
            }
        }

        DOM.canvasContext.restore();
        DOM.canvasContext.globalAlpha = 1;

        let currentHP = shipToDraw.structureHP;
        let maxHP = shipToDraw.type === 'station' ? STATION_CONFIG.RESISTANCE : SHIP_CONFIG.RESISTANCE;
        let shieldOpacity = 0;
        let r, g, b;

        if (currentHP === maxHP) {
            r = 0; g = 255; b = 255; // Cian
            shieldOpacity = 0.8;
        } else {
            shieldOpacity = 0;
        }

        if (shipToDraw.type === 'station') {
            // Shield is invisible when at far Z
            if (shipToDraw.z >= 0.5) {
                return;
            }
            if (currentHP >= STATION_CONFIG.RESISTANCE * 2 / 3) { // Phase 1: Green/Blue - High Shield
                r = 0; g = 255; b = 255; // Cian
                shieldOpacity = 1.0;
            } else if (currentHP >= STATION_CONFIG.RESISTANCE / 2) { // Phase 2: Yellow/Orange - Mid Shield/Warning
                r = 255; g = 165; b = 0;
                shieldOpacity = 0.7;
            } else { // Phase 3: Red - Critical Structure
                r = 255; g = 0; b = 0;
                shieldOpacity = 0.5;
            }
        }

        DOM.canvasContext.lineWidth = 2;
        if (shieldOpacity > 0) {
            if (shipToDraw.shieldHitTimer > 0) {
                DOM.canvasContext.shadowColor = '#fff';
                DOM.canvasContext.strokeStyle = `rgba(255,255,255,${shieldOpacity})`;
                shipToDraw.shieldHitTimer--;
            }
            else {
                DOM.canvasContext.shadowColor = `rgb(${r},${g},${b})`;
                DOM.canvasContext.strokeStyle = `rgba(${r},${g},${b},${shieldOpacity})`;
            }
            DOM.canvasContext.beginPath(); DOM.canvasContext.arc(vpX, vpY, shipToDraw.r + 10, 0, Math.PI * 2); DOM.canvasContext.stroke();
        }
    });

    DOM.canvasContext.shadowBlur = 10; DOM.canvasContext.lineCap = 'round'; DOM.canvasContext.lineJoin = 'round'; DOM.canvasContext.globalAlpha = 1;

    if (!State.playerShip.dead) {
        DOM.canvasContext.save(); // PUSH 1: Isolate entire player ship rendering block

        // Regeneration is now solely for visual/Tesla effect, as structureHP manages hits
        if (State.playerShip.shield < State.playerShip.maxShield) State.playerShip.shield += 0.05;

        let isTesla = State.playerShip.maxShield > SHIP_CONFIG.BASE_MAX_SHIELD;

        const tier = State.playerShip.tier;

        const BASE_SHIP_RADIUS = SHIP_CONFIG.SIZE / 2;
        const MAX_TIER_RADIUS = BASE_SHIP_RADIUS + (7 * 2); // Tier 7 size
        if (tier >= 8) State.playerShip.effectiveR = MAX_TIER_RADIUS;
        else State.playerShip.effectiveR = BASE_SHIP_RADIUS + (tier * 2);

        const centerX = State.width / 2; const centerY = State.height / 2;
        const r = State.playerShip.effectiveR;

        if (State.playerShip.blinkNum % 2 === 0) { // Invulnerability blink effect

            let shieldAlpha = 0;
            let strokeWidth = 1;
            let shieldRadius = State.playerShip.effectiveR + 10;

            const EPIC_SHIELD_FACTOR = 1.7;

            if (tier >= 8) {
                shieldRadius = State.playerShip.effectiveR * EPIC_SHIELD_FACTOR;
            }

            if (State.playerShip.structureHP === SHIP_CONFIG.RESISTANCE) {
                shieldAlpha = isTesla ? (0.5 + Math.random() * 0.2) : 0.5;
                strokeWidth = isTesla ? 1.5 : 1;
            }

            if (shieldAlpha > 0) {

                DOM.canvasContext.lineWidth = strokeWidth;

                let baseColor, shadowColor;

                if (State.playerShip.structureHP <= SHIP_CONFIG.RESISTANCE && tier < 8) {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                } else if (State.playerShip.structureHP >= 7) {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                } else if (State.playerShip.structureHP >= 4) {
                    baseColor = '#ffaa00'; shadowColor = 'rgba(255, 170, 0, 0.7)';
                } else {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                }

                DOM.canvasContext.shadowColor = shadowColor;
                DOM.canvasContext.strokeStyle = `rgba(0, 255, 255, ${shieldAlpha})`;

                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(centerX, centerY, shieldRadius, 0, Math.PI * 2);
                DOM.canvasContext.stroke();
            }

            DOM.canvasContext.save();
            DOM.canvasContext.translate(centerX, centerY);
            DOM.canvasContext.rotate(State.playerShip.a);

            DOM.canvasContext.globalAlpha = 1;

            // --- Drawing logic for Ship Tiers ---
            const PLAYER_HUE = SHIP_CONFIG.FRIENDLY_BLUE_HUE; // 210 (cyan/blue)
            if (tier >= 12) {
                // THE GODSHIP: Massive, glowing, advanced
                let norm = 1.2; // Adjusted target size (Reduced from 1.5)
                let transformationProgress = 1.0;

                // Gradually grow during transformation
                if (State.playerShip && State.playerShip.transformationTimer > 0) {
                    transformationProgress = 1 - (State.playerShip.transformationTimer / 600);
                    norm = 1.0 + (norm - 1.0) * transformationProgress;

                    // DRAW TIER 11 FORM (Fading out)
                    DOM.canvasContext.save();
                    DOM.canvasContext.globalAlpha = 1 - transformationProgress;
                    let sides = 3 + 11; // Tier 11
                    DOM.canvasContext.beginPath();
                    for (let i = 0; i <= sides; i++) {
                        let ang = i * (2 * Math.PI / sides);
                        if (i === 0) DOM.canvasContext.moveTo(r * Math.cos(ang), -r * Math.sin(ang));
                        else DOM.canvasContext.lineTo(r * Math.cos(ang), -r * Math.sin(ang));
                    }
                    DOM.canvasContext.closePath();
                    let chassisGrad = DOM.canvasContext.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                    chassisGrad.addColorStop(0, '#0055aa'); chassisGrad.addColorStop(1, '#002244');
                    DOM.canvasContext.fillStyle = chassisGrad; DOM.canvasContext.fill();
                    DOM.canvasContext.lineWidth = 2; DOM.canvasContext.strokeStyle = '#0088ff'; DOM.canvasContext.stroke();
                    DOM.canvasContext.restore();
                }

                DOM.canvasContext.globalAlpha = transformationProgress;
                const HULL_COLOR = '#050505';
                const BORDER_COLOR = '#00FFFF';
                const CORE_COLOR = '#FFFFFF';

                DOM.canvasContext.shadowBlur = 40;
                DOM.canvasContext.shadowColor = BORDER_COLOR;

                // Advanced Chassis Design - Wide and multi-segmented
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 2.5 * norm, 0); // Front
                DOM.canvasContext.lineTo(r * 1.5 * norm, r * 1.2 * norm);
                DOM.canvasContext.lineTo(0, r * 1.8 * norm);
                DOM.canvasContext.lineTo(-r * 1.5 * norm, r * 1.2 * norm);
                DOM.canvasContext.lineTo(-r * 2.5 * norm, r * 1.5 * norm);
                DOM.canvasContext.lineTo(-r * 3 * norm, r * 0.5 * norm);
                DOM.canvasContext.lineTo(-r * 3 * norm, -r * 0.5 * norm);
                DOM.canvasContext.lineTo(-r * 2.5 * norm, -r * 1.5 * norm);
                DOM.canvasContext.lineTo(-r * 1.5 * norm, -r * 1.2 * norm);
                DOM.canvasContext.lineTo(0, -r * 1.8 * norm);
                DOM.canvasContext.lineTo(r * 1.5 * norm, -r * 1.2 * norm);
                DOM.canvasContext.closePath();

                DOM.canvasContext.fillStyle = HULL_COLOR;
                DOM.canvasContext.fill();
                DOM.canvasContext.lineWidth = 4;
                DOM.canvasContext.strokeStyle = BORDER_COLOR;
                DOM.canvasContext.stroke();

                // Tech Overlay (Inner hull patterns)
                DOM.canvasContext.shadowBlur = 15;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 2 * norm, 0);
                DOM.canvasContext.lineTo(-r * 1.5 * norm, r * 0.8 * norm);
                DOM.canvasContext.moveTo(r * 2 * norm, 0);
                DOM.canvasContext.lineTo(-r * 1.5 * norm, -r * 0.8 * norm);
                DOM.canvasContext.stroke();

                // Pulsing Energy Core
                const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
                DOM.canvasContext.shadowBlur = 50 * pulse;
                DOM.canvasContext.fillStyle = CORE_COLOR;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(0, 0, r * norm * 0.6 * pulse, 0, Math.PI * 2);
                DOM.canvasContext.fill();

                // Heavy Thrusters
                const EXHAUST_X = -r * 3 * norm;
                if (State.playerShip.thrusting) {
                    DOM.canvasContext.shadowBlur = 80;
                    DOM.canvasContext.fillStyle = `rgba(0, 255, 255, ${0.4 + Math.random() * 0.6})`;
                    DOM.canvasContext.beginPath();
                    DOM.canvasContext.moveTo(EXHAUST_X, -r * 1.2 * norm);
                    DOM.canvasContext.lineTo(EXHAUST_X, r * 1.2 * norm);
                    DOM.canvasContext.lineTo(EXHAUST_X - r * 12 * norm * (0.8 + Math.random() * 0.4), 0);
                    DOM.canvasContext.closePath();
                    DOM.canvasContext.fill();
                }
                DOM.canvasContext.shadowBlur = 0;



            } else if (tier === 11) { // THE HYPERION - "The Celestial Dreadnought"
                // Transition design: Sharp mechanical edges with divine energy
                DOM.canvasContext.shadowBlur = 25; DOM.canvasContext.shadowColor = '#00ffff';
                DOM.canvasContext.lineWidth = 3;

                // 1. REINFORCED CHASSIS (Sleeker but heavier than Titan)
                DOM.canvasContext.fillStyle = '#0a0a0a'; DOM.canvasContext.strokeStyle = '#0088ff';
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 2.0, 0);               // Front Nose
                DOM.canvasContext.lineTo(r * 0.5, r * 0.8);          // Top Outer corner
                DOM.canvasContext.lineTo(-r * 1.2, r * 0.6);         // Top Back
                DOM.canvasContext.lineTo(-r * 1.5, 0);               // Rear Center
                DOM.canvasContext.lineTo(-r * 1.2, -r * 0.6);        // Bottom Back
                DOM.canvasContext.lineTo(r * 0.5, -r * 0.8);         // Bottom Outer corner
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill(); DOM.canvasContext.stroke();

                // 2. ENERGY WINGS (Floating but close to hull)
                const pulse = 0.8 + Math.sin(Date.now() / 300) * 0.2;
                DOM.canvasContext.fillStyle = `rgba(0, 150, 255, ${0.4 * pulse})`;
                DOM.canvasContext.strokeStyle = `rgba(0, 255, 255, ${0.6 * pulse})`;

                // Top Wing
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 0.2, -r * 0.9);
                DOM.canvasContext.lineTo(r * 1.2, -r * 1.4);
                DOM.canvasContext.lineTo(r * 0.8, -r * 0.8);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill(); DOM.canvasContext.stroke();

                // Bottom Wing
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 0.2, r * 0.9);
                DOM.canvasContext.lineTo(r * 1.2, r * 1.4);
                DOM.canvasContext.lineTo(r * 0.8, r * 0.8);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill(); DOM.canvasContext.stroke();

                // 3. CELESTIAL CORE (Divine aspect)
                DOM.canvasContext.shadowBlur = 40; DOM.canvasContext.shadowColor = '#fff';
                DOM.canvasContext.fillStyle = '#fff';
                DOM.canvasContext.beginPath();
                DOM.canvasContext.arc(0, 0, r * 0.5, 0, Math.PI * 2);
                DOM.canvasContext.fill();

                // 4. ENERGY CHANNELS (Connecting mechanical to divine)
                DOM.canvasContext.shadowBlur = 0;
                DOM.canvasContext.strokeStyle = '#00ffff'; DOM.canvasContext.lineWidth = 1;
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(r * 2.0, 0); DOM.canvasContext.lineTo(r * 0.5, 0); // Core to nose
                DOM.canvasContext.stroke();

            } else if (tier === 10) { // THE TITAN - Heavy Dreadnought
                DOM.canvasContext.shadowBlur = 20; DOM.canvasContext.shadowColor = '#ff5500';
                DOM.canvasContext.fillStyle = '#221100'; DOM.canvasContext.strokeStyle = '#ffaa00'; DOM.canvasContext.lineWidth = 4;

                // Main Block (Long along X)
                DOM.canvasContext.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
                DOM.canvasContext.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);

                // Side Armor (Top and Bottom)
                DOM.canvasContext.fillStyle = '#331100';
                DOM.canvasContext.fillRect(-r * 0.5, -r * 1.2, r * 1.5, r * 0.6);
                DOM.canvasContext.strokeRect(-r * 0.5, -r * 1.2, r * 1.5, r * 0.6);
                DOM.canvasContext.fillRect(-r * 0.5, r * 0.6, r * 1.5, r * 0.6);
                DOM.canvasContext.strokeRect(-r * 0.5, r * 0.6, r * 1.5, r * 0.6);

            } else if (tier === 9) { // THE CELESTIAL - Radiant Star
                DOM.canvasContext.shadowBlur = 25; DOM.canvasContext.shadowColor = '#ffffaa';
                DOM.canvasContext.fillStyle = '#ffffcc'; DOM.canvasContext.strokeStyle = '#ffffff'; DOM.canvasContext.lineWidth = 2;

                // 4-Pointed Star
                DOM.canvasContext.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = i * Math.PI / 4;
                    const rad = (i % 2 === 0) ? r * 1.5 : r * 0.4;
                    const px = Math.cos(angle) * rad; const py = Math.sin(angle) * rad;
                    if (i === 0) DOM.canvasContext.moveTo(px, py); else DOM.canvasContext.lineTo(px, py);
                }
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill(); DOM.canvasContext.stroke();

                // Inner Spin
                DOM.canvasContext.strokeStyle = '#ffaa00';
                DOM.canvasContext.beginPath(); DOM.canvasContext.arc(0, 0, r * 0.5, 0, Math.PI * 2); DOM.canvasContext.stroke();

            } else if (tier === 8) { // THE SPHERE - Energy Orb
                DOM.canvasContext.shadowBlur = 20; DOM.canvasContext.shadowColor = '#00ff88';
                let grad = DOM.canvasContext.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#00ff88'); grad.addColorStop(1, '#004422');
                DOM.canvasContext.fillStyle = grad;
                DOM.canvasContext.strokeStyle = '#00ff88'; DOM.canvasContext.lineWidth = 2;

                DOM.canvasContext.beginPath(); DOM.canvasContext.arc(0, 0, r, 0, Math.PI * 2); DOM.canvasContext.fill(); DOM.canvasContext.stroke();

                // Rotating Ring
                DOM.canvasContext.save(); DOM.canvasContext.rotate(Date.now() / 500);
                DOM.canvasContext.strokeStyle = '#fff'; DOM.canvasContext.lineWidth = 1;
                DOM.canvasContext.beginPath(); DOM.canvasContext.ellipse(0, 0, r * 1.4, r * 0.3, 0, 0, Math.PI * 2); DOM.canvasContext.stroke();
                DOM.canvasContext.restore();

            } else if (tier >= 1 && tier <= 7) {
                // GEOMETRIC SHAPES (1-7)
                const sides = tier + 3; // 1=Square(4), 2=Pent(5)...
                DOM.canvasContext.shadowBlur = 15; DOM.canvasContext.shadowColor = `hsl(${PLAYER_HUE}, 100%, 60%)`;
                DOM.canvasContext.fillStyle = `hsla(${PLAYER_HUE}, 60%, 20%, 0.8)`;
                DOM.canvasContext.strokeStyle = `hsl(${PLAYER_HUE}, 100%, 70%)`; DOM.canvasContext.lineWidth = 3;

                // Polygon Body
                DOM.canvasContext.beginPath();
                for (let i = 0; i < sides; i++) {
                    // Rotate so flat side is usually at bottom or point at top depending on preference.
                    // -Math.PI/2 puts a vertex at the top.
                    const angle = i * (Math.PI * 2 / sides) - Math.PI / 2;
                    const px = Math.cos(angle) * r; const py = Math.sin(angle) * r;
                    if (i === 0) DOM.canvasContext.moveTo(px, py); else DOM.canvasContext.lineTo(px, py);
                }
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill(); DOM.canvasContext.stroke();

                // Internal "Cool" Details based on shape
                DOM.canvasContext.lineWidth = 1.5; DOM.canvasContext.strokeStyle = `hsl(${PLAYER_HUE}, 100%, 90%)`;
                DOM.canvasContext.beginPath();
                if (tier === 1) { // SQUARE: Cross Bracing
                    DOM.canvasContext.moveTo(-r * 0.7, -r * 0.7); DOM.canvasContext.lineTo(r * 0.7, r * 0.7);
                    DOM.canvasContext.moveTo(r * 0.7, -r * 0.7); DOM.canvasContext.lineTo(-r * 0.7, r * 0.7);
                } else if (tier === 2) { // PENTAGON: Star
                    for (let i = 0; i < 5; i++) {
                        const a1 = i * (Math.PI * 2 / 5) - Math.PI / 2;
                        const a2 = (i + 2) * (Math.PI * 2 / 5) - Math.PI / 2;
                        DOM.canvasContext.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
                        DOM.canvasContext.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
                    }
                } else if (tier === 3) { // HEXAGON: Cube/Tri-split
                    DOM.canvasContext.moveTo(0, 0); DOM.canvasContext.lineTo(0, -r);
                    DOM.canvasContext.moveTo(0, 0); DOM.canvasContext.lineTo(Math.cos(Math.PI / 6) * r, Math.sin(Math.PI / 6) * r);
                    DOM.canvasContext.moveTo(0, 0); DOM.canvasContext.lineTo(Math.cos(Math.PI * 5 / 6) * r, Math.sin(Math.PI * 5 / 6) * r);
                } else { // HEPTAGON+ : Concentric shapes
                    const innerR = r * 0.5;
                    for (let i = 0; i < sides; i++) {
                        const angle = i * (Math.PI * 2 / sides) - Math.PI / 2;
                        const px = Math.cos(angle) * innerR; const py = Math.sin(angle) * innerR;
                        if (i === 0) DOM.canvasContext.moveTo(px, py); else DOM.canvasContext.lineTo(px, py);
                    }
                    DOM.canvasContext.closePath();
                }
                DOM.canvasContext.stroke();

            } else {
                // TIER 0: TRIANGLE (Classic Modern)
                // Base size logic
                const baseSize = r;
                const noseLength = 1.3;
                const wingSpan = 0.8;

                DOM.canvasContext.shadowBlur = 15; DOM.canvasContext.shadowColor = `hsl(${PLAYER_HUE}, 100%, 70%)`;

                // Triangle
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(baseSize * noseLength, 0);
                DOM.canvasContext.lineTo(-baseSize * 0.6, baseSize * wingSpan);
                DOM.canvasContext.lineTo(-baseSize * 0.6, -baseSize * wingSpan);
                DOM.canvasContext.closePath();

                let hullGrad = DOM.canvasContext.createLinearGradient(baseSize * 0.6, 0, -baseSize * 0.6, 0);
                hullGrad.addColorStop(0, `hsl(${PLAYER_HUE}, 100%, 70%)`);
                hullGrad.addColorStop(1, `hsl(${PLAYER_HUE}, 40%, 15%)`);
                DOM.canvasContext.fillStyle = hullGrad;
                DOM.canvasContext.fill();

                DOM.canvasContext.lineWidth = 2;
                DOM.canvasContext.strokeStyle = `hsl(${PLAYER_HUE}, 80%, 60%)`;
                DOM.canvasContext.stroke();

                // Detail
                DOM.canvasContext.beginPath(); DOM.canvasContext.moveTo(r * 0.5, 0); DOM.canvasContext.lineTo(-r * 0.2, 0); DOM.canvasContext.stroke();
            }

            // === COMMON THRUSTER LOGIC (Adapted for all models) ===
            if (State.playerShip.thrusting) {
                DOM.canvasContext.shadowBlur = 25; DOM.canvasContext.shadowColor = '#ffaa00';
                DOM.canvasContext.fillStyle = `rgba(255, 170, 0, ${0.5 + Math.random() * 0.5})`;
                const thrustL = 30 + Math.random() * 10;

                // Single central thrust for most, specialized for heavy tiers
                if (tier === 10) { // Titan: Dual Thrusters on rear ends
                    [-r * 0.9, r * 0.9].forEach(yPos => {
                        DOM.canvasContext.beginPath();
                        DOM.canvasContext.moveTo(-r, yPos - 5); DOM.canvasContext.lineTo(-r - thrustL, yPos); DOM.canvasContext.lineTo(-r, yPos + 5);
                        DOM.canvasContext.fill();
                    });
                } else if (tier === 11) { // Hyperion: Celestial Thrust
                    DOM.canvasContext.beginPath();
                    DOM.canvasContext.moveTo(-r * 1.5, -r * 0.3);
                    DOM.canvasContext.lineTo(-r * 1.5 - thrustL * 1.5, 0); // Slightly longer thrust
                    DOM.canvasContext.lineTo(-r * 1.5, r * 0.3);
                    DOM.canvasContext.fill();
                } else {
                    DOM.canvasContext.beginPath();
                    DOM.canvasContext.moveTo(-r * 0.7, -r * 0.2);
                    DOM.canvasContext.lineTo(-r * 0.7 - thrustL, 0);
                    DOM.canvasContext.lineTo(-r * 0.7, r * 0.2);
                    DOM.canvasContext.fill();
                }
                DOM.canvasContext.shadowBlur = 0;
            }
        }
        DOM.canvasContext.restore();
    }
    if (State.playerShip.blinkNum > 0) State.playerShip.blinkNum--;
    DOM.canvasContext.restore(); // POP 1: Restore state after ship block

    DOM.canvasContext.shadowColor = '#ff0000'; DOM.canvasContext.fillStyle = '#ff0000';
    for (let i = State.enemyShipBullets.length - 1; i >= 0; i--) {
        let enemyShipBullet = State.enemyShipBullets[i];

        // Gravity (World Coords)
        for (let r of activePlanets) {
            if (r.z < 0.5) { // Near planet
                let dx = r.x - enemyShipBullet.x; let dy = r.y - enemyShipBullet.y; // World Distance Vector
                let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);
                let force = (G_CONST * r.mass) / Math.max(distSq, 1000);
                if (dist < r.r * 8 && dist > 1) {
                    enemyShipBullet.xv += (dx / dist) * force * SHIP_CONFIG.BULLET_GRAVITY_FACTOR;
                    enemyShipBullet.yv += (dy / dist) * force * SHIP_CONFIG.BULLET_GRAVITY_FACTOR;
                }
            }
        }

        enemyShipBullet.x += enemyShipBullet.xv; enemyShipBullet.y += enemyShipBullet.yv;
        enemyShipBullet.life--;

        if (enemyShipBullet.life <= 0 || Math.hypot(State.worldOffsetX - enemyShipBullet.x, State.worldOffsetY - enemyShipBullet.y) > WORLD_BOUNDS * 1.5) {
            State.enemyShipBullets.splice(i, 1); continue;
        }

        const vpX = enemyShipBullet.x - State.worldOffsetX + State.width / 2;
        const vpY = enemyShipBullet.y - State.worldOffsetY + State.height / 2;

        let alpha = 1.0;
        if (enemyShipBullet.life < SHIP_CONFIG.BULLET_FADE_FRAMES) {
            alpha = enemyShipBullet.life / SHIP_CONFIG.BULLET_FADE_FRAMES;
        }
        DOM.canvasContext.globalAlpha = alpha;

        // TIERED ENEMY BULLET RENDERING (Synchronized with Player)
        const tier = enemyShipBullet.tier || 0;
        const hue = enemyShipBullet.hue || 0; // Faction Color

        // Colors derived from faction hue
        const mainColor = `hsl(${hue}, 100%, 70%)`;
        const glowColor = `hsl(${hue}, 100%, 50%)`;
        const coreColor = '#ffffff';

        if (tier >= 8) { // Ultimate Beam-like (Enemy)
            DOM.canvasContext.shadowBlur = 15; DOM.canvasContext.shadowColor = glowColor; DOM.canvasContext.fillStyle = mainColor;
            DOM.canvasContext.beginPath();
            let ang = Math.atan2(enemyShipBullet.yv, enemyShipBullet.xv);
            DOM.canvasContext.ellipse(vpX, vpY, enemyShipBullet.size * 4, enemyShipBullet.size * 0.8, ang, 0, Math.PI * 2);
            DOM.canvasContext.fill();
            DOM.canvasContext.fillStyle = coreColor;
            DOM.canvasContext.beginPath(); DOM.canvasContext.arc(vpX, vpY, enemyShipBullet.size / 2, 0, Math.PI * 2); DOM.canvasContext.fill();
        } else {
            // GEOMETRIC SHAPES (Tier 0-7) matching Ship Hull
            let sides = 3 + tier;
            DOM.canvasContext.shadowBlur = 5; DOM.canvasContext.shadowColor = glowColor; DOM.canvasContext.fillStyle = mainColor;

            DOM.canvasContext.save();
            DOM.canvasContext.translate(vpX, vpY);
            // Spin effect based on life
            DOM.canvasContext.rotate(enemyShipBullet.life * 0.2);

            DOM.canvasContext.beginPath();
            for (let k = 0; k < sides; k++) {
                let ang = k * (2 * Math.PI / sides);
                let r = enemyShipBullet.size * (1 + tier * 0.1); // Slightly larger for higher tiers
                if (k === 0) DOM.canvasContext.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                else DOM.canvasContext.lineTo(r * Math.cos(ang), r * Math.sin(ang));
            }
            DOM.canvasContext.closePath();
            DOM.canvasContext.fill();

            // Core
            DOM.canvasContext.fillStyle = coreColor;
            DOM.canvasContext.beginPath(); DOM.canvasContext.arc(0, 0, enemyShipBullet.size * 0.4, 0, Math.PI * 2); DOM.canvasContext.fill();

            DOM.canvasContext.restore();
        }

        DOM.canvasContext.globalAlpha = 1; // Reset alpha

        let hit = false;
        // Collision with player (World Coords)
        if (!State.playerShip.dead && !enemyShipBullet.isFriendly && Math.hypot(State.worldOffsetX - enemyShipBullet.x, State.worldOffsetY - enemyShipBullet.y) < (State.playerShip.effectiveR || State.playerShip.r) + 5) {
            hitPlayerShip(1);

            // INDIVIDUAL EVOLUTION: Gain score for hitting/killing player
            if (enemyShipBullet.owner && State.ships.includes(enemyShipBullet.owner)) {
                enemyShipBullet.owner.score += SCORE_REWARDS.SHIP_KILLED;
            }

            State.enemyShipBullets.splice(i, 1);
            hit = true;
        }
        if (hit) continue;

        // NEW: Collision with RIVAL SHIPS (Faction War)
        for (let k = State.ships.length - 1; k >= 0; k--) {
            let e = State.ships[k];
            if (e.z > 0.5) continue; // Ignore background State.ships

            // Basic collision check
            if (Math.hypot(enemyShipBullet.x - e.x, enemyShipBullet.y - e.y) < e.r + enemyShipBullet.size) {
                // Friendly fire exclusion
                if (enemyShipBullet.isFriendly && e.isFriendly) continue;
                if (!enemyShipBullet.isFriendly && !e.isFriendly && enemyShipBullet.hue === e.fleetHue) continue; // Same fleet enemy State.ships

                e.structureHP--;
                e.shieldHitTimer = 10;
                createExplosion(enemyShipBullet.x - State.worldOffsetX + State.width / 2, enemyShipBullet.y - State.worldOffsetY + State.height / 2, 5, '#ff0055', 1, 'spark');

                if (e.structureHP <= 0) {
                    let debrisColor = e.type === 'station' ? `hsl(${e.fleetHue}, 100%, 50%)` : `hsl(${e.fleetHue}, 100%, 40%)`;
                    createExplosion(e.x - State.worldOffsetX + State.width / 2, e.y - State.worldOffsetY + State.height / 2, 40, debrisColor, 4, 'debris');
                    if (e.type === 'station') { onStationDestroyed(e, enemyShipBullet.owner); }
                    else { onShipDestroyed(e, enemyShipBullet.owner); }

                    // INDIVIDUAL EVOLUTION: Gain score for killing rival
                    if (enemyShipBullet.owner && State.ships.includes(enemyShipBullet.owner)) {
                        enemyShipBullet.owner.score += (e.type === 'station') ? SCORE_REWARDS.STATION_KILLED : SCORE_REWARDS.SHIP_KILLED;
                    }

                    State.ships.splice(k, 1);
                    AudioEngine.playExplosion('large', e.x, e.y, e.z);
                }

                State.enemyShipBullets.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;

        // Collision with asteroids (World Coords)
        let nearbyRoids = spatialGrid.query(enemyShipBullet);
        for (let j = nearbyRoids.length - 1; j >= 0; j--) {
            let r = nearbyRoids[j];
            if (r.z > 0.5 || r._destroyed) continue;
            if (Math.hypot(enemyShipBullet.x - r.x, enemyShipBullet.y - r.y) < r.r + enemyShipBullet.size) {
                const rVpX = r.x - State.worldOffsetX + State.width / 2;
                const rVpY = r.y - State.worldOffsetY + State.height / 2;

                if (r.isPlanet) {
                    let planet = r;
                    let hasSquad = false;
                    let shooter = enemyShipBullet.owner;
                    if (shooter && shooter.role === 'leader') {
                        let squadCount = 0;
                        if (shooter.squadSlots) {
                            shooter.squadSlots.forEach(s => {
                                if (s.occupant && !s.occupant.dead && State.ships.includes(s.occupant)) squadCount++;
                            });
                        }
                        if (squadCount >= 2) hasSquad = true;
                    }

                    if (hasSquad) {
                        if (planet.hp === undefined) planet.hp = 70;
                        if (planet.hp > 0) {
                            planet.hp--;
                            planet.blinkNum = 10;
                            createExplosion(vpX, vpY, 20, '#ffaa00', 3, 'spark');

                            if (planet.hp <= 0) {
                                planet.r = 0;
                                planet._destroyed = true;

                                const pVpX = planet.x - State.worldOffsetX + State.width / 2;
                                const pVpY = planet.y - State.worldOffsetY + State.height / 2;
                                createExplosion(pVpX, pVpY, 150, '#ffaa00', 8, 'flame');
                                createExplosion(pVpX, pVpY, 100, '#ff4400', 12, 'flame');
                                createExplosion(pVpX, pVpY, 80, '#550000', 15, 'smoke');
                                createExplosion(pVpX, pVpY, 50, '#ffff00', 4, 'spark');
                                AudioEngine.playPlanetExplosion(planet.x, planet.y, planet.z || 0);

                                if (planet.id === State.homePlanetId) {
                                    triggerHomePlanetLost('enemy');
                                } else {
                                    if (shooter && State.ships.includes(shooter)) {
                                        shooter.score += SCORE_REWARDS.PLANET_DESTROYED;
                                    }
                                    State.pendingDebris.push({ x: planet.x, y: planet.y, count: ASTEROID_CONFIG.PLANET_DEBRIS, isHot: true });
                                    createShockwave(planet.x, planet.y);
                                }
                            }
                        }
                    } else {
                        createExplosion(vpX, vpY, 3, '#fff', 1); // Bullet destroyed by planet shield
                    }
                }
                else {
                    createExplosion(rVpX, rVpY, 10, '#aa00ff', 1, 'debris');

                    // INDIVIDUAL EVOLUTION: Gain score for destroying asteroids
                    if (enemyShipBullet.owner && State.ships.includes(enemyShipBullet.owner)) {
                        enemyShipBullet.owner.score += SCORE_REWARDS.ASTEROID_DESTROYED;
                    }

                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_CONFIG.MIN_SIZE) {
                        const bulletAngle = Math.atan2(enemyShipBullet.yv, enemyShipBullet.xv);
                        const perpAngle1 = bulletAngle + Math.PI / 2;
                        const perpAngle2 = bulletAngle - Math.PI / 2;
                        const dynamicOffset = r.r * (ASTEROID_CONFIG.SPLIT_OFFSET / ASTEROID_CONFIG.MAX_SIZE);

                        let frag1 = createAsteroid(r.x + Math.cos(perpAngle1) * dynamicOffset, r.y + Math.sin(perpAngle1) * dynamicOffset, newSize);
                        frag1.xv = r.xv + Math.cos(perpAngle1) * ASTEROID_CONFIG.MAX_SPEED;
                        frag1.yv = r.yv + Math.sin(perpAngle1) * ASTEROID_CONFIG.MAX_SPEED;
                        frag1.blinkNum = 30;
                        State.roids.push(frag1);

                        let frag2 = createAsteroid(r.x + Math.cos(perpAngle2) * dynamicOffset, r.y + Math.sin(perpAngle2) * dynamicOffset, newSize);
                        frag2.xv = r.xv + Math.cos(perpAngle2) * ASTEROID_CONFIG.MAX_SPEED;
                        frag2.yv = r.yv + Math.sin(perpAngle2) * ASTEROID_CONFIG.MAX_SPEED;
                        frag2.blinkNum = 30;
                        State.roids.push(frag2);

                        updateAsteroidCounter();
                    }
                    const roidIdx = State.roids.indexOf(r);
                    if (roidIdx !== -1) State.roids.splice(roidIdx, 1);
                    r._destroyed = true;
                    updateAsteroidCounter();
                    AudioEngine.playExplosion('small', r.x, r.y, r.z); // Added for asteroid destruction by enemy
                }
                State.enemyShipBullets.splice(i, 1); hit = true; break;
            }
        }
    }

    // --- Player Bullet Logic (All in World Coords) ---
    DOM.canvasContext.shadowColor = '#ff0055'; DOM.canvasContext.fillStyle = '#ff0055';
    for (let i = State.playerShipBullets.length - 1; i >= 0; i--) {
        let playerShipBullet = State.playerShipBullets[i];

        for (let r of activePlanets) {
            if (r.z < 0.5) {
                let dx = r.x - playerShipBullet.x; let dy = r.y - playerShipBullet.y;
                let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);
                let force = (G_CONST * r.mass) / Math.max(distSq, 1000);
                if (dist < r.r * 8 && dist > 1) { // Same gravity reach
                    playerShipBullet.xv += (dx / dist) * force * SHIP_CONFIG.BULLET_GRAVITY_FACTOR;
                    playerShipBullet.yv += (dy / dist) * force * SHIP_CONFIG.BULLET_GRAVITY_FACTOR;
                }
            }
        }

        playerShipBullet.x += playerShipBullet.xv; playerShipBullet.y += playerShipBullet.yv;
        playerShipBullet.life--;

        if (playerShipBullet.life <= 0 || Math.hypot(State.worldOffsetX - playerShipBullet.x, State.worldOffsetY - playerShipBullet.y) > WORLD_BOUNDS * 1.5) {
            State.playerShipBullets.splice(i, 1); continue;
        }

        const vpX = playerShipBullet.x - State.worldOffsetX + State.width / 2;
        const vpY = playerShipBullet.y - State.worldOffsetY + State.height / 2;

        // NEW: Bullet Fade Effect
        let alpha = 1.0;
        if (playerShipBullet.life < SHIP_CONFIG.BULLET_FADE_FRAMES) {
            alpha = playerShipBullet.life / SHIP_CONFIG.BULLET_FADE_FRAMES;
        }
        DOM.canvasContext.globalAlpha = alpha;

        DOM.canvasContext.globalAlpha = alpha;

        // TIERED BULLET RENDERING
        const tier = playerShipBullet.tier || 0;

        if (tier >= 8) { // Ultimate Beam-like
            DOM.canvasContext.shadowBlur = 15; DOM.canvasContext.shadowColor = '#00ffff'; DOM.canvasContext.fillStyle = '#ffffff';
            DOM.canvasContext.beginPath();
            // Draw elongated bolt
            let ang = Math.atan2(playerShipBullet.yv, playerShipBullet.xv); // Use State.velocity for orientation
            DOM.canvasContext.ellipse(vpX, vpY, playerShipBullet.size * 4, playerShipBullet.size * 0.8, ang, 0, Math.PI * 2);
            DOM.canvasContext.fill();
            // Core
            DOM.canvasContext.fillStyle = '#ccffff';
            DOM.canvasContext.beginPath(); DOM.canvasContext.arc(vpX, vpY, playerShipBullet.size / 2, 0, Math.PI * 2); DOM.canvasContext.fill();
        } else {
            // GEOMETRIC SHAPES (Tier 0-7)
            let sides = 3 + tier;

            // Colors logic
            let pColor = '#ff0055'; let pGlow = '#ff0055';
            if (tier >= 4) { pColor = '#ffff00'; pGlow = '#ffff00'; }
            else if (tier >= 1) { pColor = '#ffaa00'; pGlow = '#ffaa00'; }

            DOM.canvasContext.shadowBlur = 5; DOM.canvasContext.shadowColor = pGlow; DOM.canvasContext.fillStyle = pColor;

            DOM.canvasContext.save();
            DOM.canvasContext.translate(vpX, vpY);
            DOM.canvasContext.rotate(playerShipBullet.life * 0.2);

            DOM.canvasContext.beginPath();
            for (let k = 0; k < sides; k++) {
                let ang = k * (2 * Math.PI / sides);
                let r = playerShipBullet.size; // Size already accounts for tier boost in createBullet
                if (k === 0) DOM.canvasContext.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                else DOM.canvasContext.lineTo(r * Math.cos(ang), r * Math.sin(ang));
            }
            DOM.canvasContext.closePath();
            DOM.canvasContext.fill();

            // Core
            DOM.canvasContext.fillStyle = '#ffffff';
            DOM.canvasContext.beginPath(); DOM.canvasContext.arc(0, 0, playerShipBullet.size * 0.4, 0, Math.PI * 2); DOM.canvasContext.fill();

            DOM.canvasContext.restore();
        }

        DOM.canvasContext.globalAlpha = 1; // Reset alpha
        let hit = false;

        // Collision with asteroids/planets (World Coords)
        let playerNearbyRoids = spatialGrid.query(playerShipBullet);
        for (let j = playerNearbyRoids.length - 1; j >= 0; j--) {
            let r = playerNearbyRoids[j];
            if (r.z > 0.5 || r._destroyed) continue;

            // Use bullet size for effective collision radius
            if (Math.hypot(playerShipBullet.x - r.x, playerShipBullet.y - r.y) < r.r + playerShipBullet.size) {
                const rVpX = r.x - State.worldOffsetX + State.width / 2;
                const rVpY = r.y - State.worldOffsetY + State.height / 2;

                if (r.isPlanet) {
                    if (r.id === State.homePlanetId) {
                        r.friendlyHits = (r.friendlyHits || 0) + 1;
                        if (r.friendlyHits === 2 || r.friendlyHits % 10 === 0) {
                            addScreenMessage(t("game.warn_shoot_home"), "#ff8800");
                        }
                        createExplosion(vpX, vpY, 3, '#fff', 1);
                        State.playerShipBullets.splice(i, 1);
                        hit = true;
                        break;
                    }
                    let planet = r;
                    let hasSquad = false;
                    let shooter = playerShipBullet.owner;

                    if (shooter === State.playerShip) {
                        if (State.playerShip.tier >= 12) {
                            hasSquad = true; // Godship can always destroy planets
                        } else if (!State.playerShip.loneWolf) {
                            let squadCount = 0;
                            if (State.playerShip.squadSlots) {
                                State.playerShip.squadSlots.forEach(s => {
                                    if (s.occupant && !s.occupant.dead && State.ships.includes(s.occupant)) squadCount++;
                                });
                            }
                            if (squadCount >= 2) hasSquad = true;
                        }
                    } else if (shooter && shooter.role === 'leader') {
                        let squadCount = 0;
                        if (shooter.squadSlots) {
                            shooter.squadSlots.forEach(s => {
                                if (s.occupant && !s.occupant.dead && State.ships.includes(s.occupant)) squadCount++;
                            });
                        }
                        if (squadCount >= 2) hasSquad = true;
                    }

                    if (hasSquad) {
                        if (planet.hp === undefined) planet.hp = 70;
                        if (planet.hp > 0) {
                            planet.hp--;
                            planet.blinkNum = 10;
                            createExplosion(vpX, vpY, 20, '#ffaa00', 3, 'spark');

                            if (planet.hp <= 0) {
                                planet.r = 0;
                                planet._destroyed = true;

                                const pVpX = planet.x - State.worldOffsetX + State.width / 2;
                                const pVpY = planet.y - State.worldOffsetY + State.height / 2;
                                createExplosion(pVpX, pVpY, 150, '#ffaa00', 8, 'flame');
                                createExplosion(pVpX, pVpY, 100, '#ff4400', 12, 'flame');
                                AudioEngine.playPlanetExplosion(planet.x, planet.y, planet.z || 0);

                                if (planet.id === State.homePlanetId) {
                                    triggerHomePlanetLost('player');
                                } else {
                                    increaseShipScore(State.playerShip, SCORE_REWARDS.PLANET_DESTROYED);
                                    State.pendingDebris.push({ x: planet.x, y: planet.y, count: ASTEROID_CONFIG.PLANET_DEBRIS, isHot: true });
                                    createShockwave(planet.x, planet.y);
                                }
                            }
                        }
                    } else if (r.blinkNum === 0) {
                        let asteroidMass = playerShipBullet.size * 10;
                        let asteroidR = playerShipBullet.size * 2;

                        let area1 = Math.PI * planet.r * planet.r;
                        let area2 = Math.PI * asteroidR * asteroidR;
                        let totalArea = area1 + area2;
                        let newR = Math.sqrt(totalArea / Math.PI);

                        let totalMass = planet.mass + asteroidMass;

                        planet.targetR = Math.min(newR, PLANET_CONFIG.MAX_SIZE);
                        planet.mass = totalMass * 0.05;

                        createExplosion(vpX, vpY, 10, '#00ffff', 2);
                    }

                    State.playerShipBullets.splice(i, 1); hit = true; break;
                } else {
                    if (r.blinkNum > 0) {
                        State.playerShipBullets.splice(i, 1); hit = true; break;
                    }
                    createExplosion(rVpX, rVpY, 15, '#ff0055', 1, 'spark');
                    createExplosion(rVpX, rVpY, 5, '#888', 2, 'debris');

                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_CONFIG.MIN_SIZE) {
                        const bulletAngle = Math.atan2(playerShipBullet.yv, playerShipBullet.xv);
                        const perpAngle1 = bulletAngle + Math.PI / 2;
                        const perpAngle2 = bulletAngle - Math.PI / 2;
                        const dynamicOffset = r.r * (ASTEROID_CONFIG.SPLIT_OFFSET / ASTEROID_CONFIG.MAX_SIZE);

                        let frag1 = createAsteroid(r.x + Math.cos(perpAngle1) * dynamicOffset, r.y + Math.sin(perpAngle1) * dynamicOffset, newSize);
                        frag1.xv = r.xv + Math.cos(perpAngle1) * ASTEROID_CONFIG.MAX_SPEED;
                        frag1.yv = r.yv + Math.sin(perpAngle1) * ASTEROID_CONFIG.MAX_SPEED;
                        frag1.blinkNum = 30;
                        State.roids.push(frag1);

                        let frag2 = createAsteroid(r.x + Math.cos(perpAngle2) * dynamicOffset, r.y + Math.sin(perpAngle2) * dynamicOffset, newSize);
                        frag2.xv = r.xv + Math.cos(perpAngle2) * ASTEROID_CONFIG.MAX_SPEED;
                        frag2.yv = r.yv + Math.sin(perpAngle2) * ASTEROID_CONFIG.MAX_SPEED;
                        frag2.blinkNum = 30;
                        State.roids.push(frag2);

                        updateAsteroidCounter();
                    }

                    const roidIdx = State.roids.indexOf(r);
                    if (roidIdx !== -1) State.roids.splice(roidIdx, 1);
                    r._destroyed = true;
                    updateAsteroidCounter();
                    AudioEngine.playExplosion('small', r.x, r.y, r.z);
                }
                if (!r.isPlanet) {
                    increaseShipScore(State.playerShip, SCORE_REWARDS.ASTEROID_DESTROYED);
                }
                State.playerShipBullets.splice(i, 1); hit = true; break;
            }
        }
        if (hit) continue;

        // Collision with State.ships (World Coords)
        for (let j = State.ships.length - 1; j >= 0; j--) {
            let ship = State.ships[j];

            // If we are NOT a lone wolf, hitting friends triggers a warning
            if (ship.isFriendly && !State.playerShip.loneWolf && !State.victoryState && !State.playerShip.dead) {
                if (Math.hypot(playerShipBullet.x - ship.x, playerShipBullet.y - ship.y) < ship.r + playerShipBullet.size) {
                    addScreenMessage(t("game.warn_cease_fire"), "#ffcc00");
                    ship.structureHP -= 1.0;
                    ship.shieldHitTimer = 5;
                    State.playerShipBullets.splice(i, 1);
                    hit = true;

                    if (ship.structureHP <= 0) {
                        const eVpX = ship.x - State.worldOffsetX + State.width / 2;
                        const eVpY = ship.y - State.worldOffsetY + State.height / 2;
                        let debrisColor = ship.type === 'station' ? `hsl(${ship.fleetHue}, 100%, 50%)` : `hsl(${ship.fleetHue}, 100%, 40%)`;
                        createExplosion(eVpX, eVpY, 40, '#ffaa00', 3, 'spark');
                        createExplosion(eVpX, eVpY, 20, debrisColor, 4, 'debris');

                        if (ship.type === 'station') {
                            onStationDestroyed(ship, State.playerShip);
                        } else {
                            onShipDestroyed(ship, State.playerShip);
                        }

                        State.ships.splice(j, 1);
                        AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                    }
                    break;
                }
                continue;
            }

            // Use bullet size for effective collision radius
            if (ship.blinkNum === 0 && Math.hypot(playerShipBullet.x - ship.x, playerShipBullet.y - ship.y) < ship.r + playerShipBullet.size) {
                ship.structureHP--;
                ship.shieldHitTimer = 5;
                State.playerShipBullets.splice(i, 1);
                hit = true;

                const eVpX = ship.x - State.worldOffsetX + State.width / 2;
                const eVpY = ship.y - State.worldOffsetY + State.height / 2;

                if (ship.structureHP <= 0) {
                    let debrisColor = ship.type === 'station' ? `hsl(${ship.fleetHue}, 100%, 50%)` : `hsl(${ship.fleetHue}, 100%, 40%)`;
                    createExplosion(eVpX, eVpY, 40, '#ffaa00', 3, 'spark'); createExplosion(eVpX, eVpY, 20, debrisColor, 4, 'debris');
                    if (ship.type === 'station') { onStationDestroyed(ship, playerShipBullet.owner); }
                    else { onShipDestroyed(ship, playerShipBullet.owner); }
                    State.ships.splice(j, 1);
                    AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                }
                break;
            } else if (ship.blinkNum > 0 && Math.hypot(playerShipBullet.x - ship.x, playerShipBullet.y - ship.y) < ship.r + playerShipBullet.size) {
                State.playerShipBullets.splice(i, 1); hit = true; break;
            }
        }
    }
    // --- End Player Bullet Logic ---

    // Particle update (movement and decay)
    for (let i = State.particles.length - 1; i >= 0; i--) {
        let p = State.particles[i];
        // Particle position is World Coords + Velocity, but drawing uses Viewport Coords
        p.x += p.xv; p.y += p.yv;

        const vpX = p.x - State.worldOffsetX + State.width / 2;
        const vpY = p.y - State.worldOffsetY + State.height / 2;

        if (p.type === 'flame') {
            DOM.canvasContext.globalAlpha = p.life / 60;
            DOM.canvasContext.shadowBlur = 15;
            DOM.canvasContext.shadowColor = p.color;
            DOM.canvasContext.fillStyle = p.color;
            DOM.canvasContext.beginPath();
            // Flames pulsate and grow slightly then shrink
            const flameSize = Math.max(0.1, p.size * (1 + Math.sin(p.life * 0.2) * 0.3));
            DOM.canvasContext.arc(vpX, vpY, flameSize, 0, Math.PI * 2);
            DOM.canvasContext.fill();
        } else if (p.type === 'smoke') {
            DOM.canvasContext.globalAlpha = (p.life / 100) * 0.4;
            DOM.canvasContext.fillStyle = p.color;
            DOM.canvasContext.beginPath();
            const smokeSize = Math.max(0.1, p.size * (1 + (100 - p.life) * 0.05));
            DOM.canvasContext.arc(vpX, vpY, smokeSize, 0, Math.PI * 2);
            DOM.canvasContext.fill();
        } else {
            DOM.canvasContext.shadowColor = p.color; DOM.canvasContext.fillStyle = p.color; DOM.canvasContext.globalAlpha = p.life / 60;
            DOM.canvasContext.beginPath();
            if (p.type === 'debris') DOM.canvasContext.fillRect(vpX, vpY, p.size, p.size); else DOM.canvasContext.arc(vpX, vpY, p.size, 0, Math.PI * 2);
            DOM.canvasContext.fill();
        }
        DOM.canvasContext.globalAlpha = 1;
        DOM.canvasContext.shadowBlur = 0;

        p.life--; if (p.life <= 0) State.particles.splice(i, 1);
    }

    // Auto-spawn asteroid if count is too low
    /* DISABLED: Victory is based on cleaning the map
    if (State.roids.length < 5 + State.level && !State.victoryState) {
        let x, y, d;
        // Spawning logic (off-screen in World Coords)
        const spawnRadius = WORLD_BOUNDS * 0.9;
        do { x = (Math.random() - 0.5) * spawnRadius * 2; y = (Math.random() - 0.5) * spawnRadius * 2; d = Math.sqrt(x ** 2 + y ** 2); } while (d < 300);
        State.roids.push(createAsteroid(x, y, 60));
        updateAsteroidCounter();
    }
    */

    drawRadar();

    DOM.canvasContext.restore();
    DOM.canvasContext.shadowBlur = 0;

    // --- Off-Screen Enemy Indicators ---
    // Show red dots at screen borders for State.ships that are approaching but not visible
    // Draw in screen space (unscaled) to work correctly in touch mode
    if (!(State.playerShip.dead && State.playerShip.lives <= 0)) {
        DOM.canvasContext.save();
        DOM.canvasContext.resetTransform(); // Draw in screen space, not affected by viewport scaling
        const INDICATOR_SIZE = 8;
        const BORDER_PADDING = 20;
        const DETECTION_RANGE = 3000; // How far off-screen to detect State.ships

        State.ships.forEach(e => {
            if (e.isFriendly || e.z > 0.5) return; // Skip friendly State.ships and far-away State.ships

            // Calculate viewport position (in world viewport space)
            const depthScale = 1 / (1 + e.z);
            const worldVpX = (e.x - State.worldOffsetX) * depthScale + State.width / 2;
            const worldVpY = (e.y - State.worldOffsetY) * depthScale + State.height / 2;

            // Apply State.viewScale transformation to get screen position
            const vpX = worldVpX * State.viewScale + State.width / 2 * (1 - State.viewScale);
            const vpY = worldVpY * State.viewScale + State.height / 2 * (1 - State.viewScale);

            const screenLeft = 0;
            const screenRight = State.width;
            const screenTop = 0;
            const screenBottom = State.height;

            // Check if enemy is off-screen but within detection range
            const isOffScreen = vpX < screenLeft || vpX > screenRight || vpY < screenTop || vpY > screenBottom;
            const distToPlayer = Math.hypot(e.x - State.worldOffsetX, e.y - State.worldOffsetY);

            if (isOffScreen && distToPlayer < DETECTION_RANGE) {
                // Calculate indicator position at screen border
                let indicatorX = vpX;
                let indicatorY = vpY;

                // Clamp to screen borders with padding
                if (vpX < screenLeft) indicatorX = screenLeft + BORDER_PADDING;
                else if (vpX > screenRight) indicatorX = screenRight - BORDER_PADDING;

                if (vpY < screenTop) indicatorY = screenTop + BORDER_PADDING;
                else if (vpY > screenBottom) indicatorY = screenBottom - BORDER_PADDING;

                // Draw pulsing red indicator
                const pulseAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.3;
                DOM.canvasContext.globalAlpha = pulseAlpha;
                DOM.canvasContext.fillStyle = '#FF0000';
                DOM.canvasContext.shadowColor = '#FF0000';
                DOM.canvasContext.shadowBlur = 10;

                // Draw arrow pointing towards enemy
                const angleToEnemy = Math.atan2(vpY - indicatorY, vpX - indicatorX);
                DOM.canvasContext.save();
                DOM.canvasContext.translate(indicatorX, indicatorY);
                DOM.canvasContext.rotate(angleToEnemy);

                // Draw triangle arrow
                DOM.canvasContext.beginPath();
                DOM.canvasContext.moveTo(INDICATOR_SIZE, 0);
                DOM.canvasContext.lineTo(-INDICATOR_SIZE / 2, -INDICATOR_SIZE / 2);
                DOM.canvasContext.lineTo(-INDICATOR_SIZE / 2, INDICATOR_SIZE / 2);
                DOM.canvasContext.closePath();
                DOM.canvasContext.fill();

                DOM.canvasContext.restore();
                DOM.canvasContext.globalAlpha = 1;
            }
        });



        DOM.canvasContext.restore();
        DOM.canvasContext.shadowBlur = 0;

        // --- Render Screen Messages ---
        if (State.screenMessages.length > 0) {
            DOM.canvasContext.save();
            DOM.canvasContext.resetTransform(); // Draw in screen space
            DOM.canvasContext.textAlign = 'center';

            // Responsive font size based on screen State.width
            const baseFontSize = 24;
            const fontSize = Math.max(14, Math.min(baseFontSize, State.width / 30)); // Scale between 14px and 24px
            DOM.canvasContext.font = `bold ${fontSize}px Courier New`;

            for (let i = State.screenMessages.length - 1; i >= 0; i--) {
                const m = State.screenMessages[i];
                const alpha = Math.min(1, m.life / 30);
                DOM.canvasContext.globalAlpha = alpha;
                DOM.canvasContext.fillStyle = m.color;
                DOM.canvasContext.shadowBlur = 10;
                DOM.canvasContext.shadowColor = m.color;

                // Draw relative to center, offset by message index
                const yPos = State.height * 0.3 + (i * (fontSize + 16));

                // Use maxWidth to prevent text overflow (90% of screen State.width)
                const maxWidth = State.width * 0.9;
                DOM.canvasContext.fillText(m.text, State.width / 2, yPos, maxWidth);

                m.life--;
                if (m.life <= 0) State.screenMessages.splice(i, 1);
            }
            DOM.canvasContext.restore();
        }

        // Victory Fireworks
        if (State.victoryState && Math.random() < 0.05) {
            const fx = (Math.random() - 0.5) * State.width;
            const fy = (Math.random() - 0.5) * State.height;
            const hue = Math.floor(Math.random() * 360);
            createExplosion(State.width / 2 + fx, State.height / 2 + fy, 40, `hsl(${hue}, 100%, 50%)`, 3, 'spark');
        }
    }
}

window.startGame = startGame;
export function startGame() {
    // Stop menu music
    AudioEngine.stopMusic();
    AudioEngine.setTrack('game');

    // Hide start/restart button in order to gradually show it again in the game over screen.
    DOM.startBtn.style.display = 'none';

    // RESTORE HUD
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'flex';

    if (originalPlanetLimit === null) originalPlanetLimit = PLANET_CONFIG.LIMIT;
    else PLANET_CONFIG.LIMIT = originalPlanetLimit;

    DOM.startScreen.style.display = 'none';
    DOM.startScreen.classList.remove('game-over', 'game-over-bg', 'victory', 'fade-out');
    DOM.startScreen.removeEventListener('click', window.audioStopper);

    State.level = 0;
    State.homePlanetId = null;
    State.screenMessages = [];
    State.victoryState = false;
    State.viewScale = 1.0;

    DOM.fadeOverlay.style.background = 'rgba(0, 0, 0, 0)';

    State.velocity = { x: 0, y: 0 };
    State.worldOffsetX = 0;
    State.worldOffsetY = 0;
    State.stationSpawnTimer = STATION_CONFIG.SPAWN_TIMER;
    stationsDestroyedCount = 0;
    State.playerReloadTime = 0; // Reset reload timer

    State.particles = [];
    State.ambientFogs = [];
    State.playerShipBullets = [];
    State.enemyShipBullets = [];
    State.shockwaves = [];
    State.ships = []; // NEW: Reset State.ships here, safely before adding player and stations

    State.playerShip = newPlayerShip();
    increaseShipScore(State.playerShip, 0);
    State.ships.push(State.playerShip);

    if (State.playerShip.lives <= 0) {
        killPlayerShip();
        return;
    }

    State.gameRunning = true;
    initBackground();
    createLevel();

    // NEW: Spawn player at Home Planet if it exists
    if (State.homePlanetId) {
        const home = State.roids.find(r => r.id === State.homePlanetId);
        if (home) {
            State.worldOffsetX = home.x;
            State.worldOffsetY = home.y;
        }
    }

    drawLives();
    updateAsteroidCounter(); // Sync score/count immediately

    // Reset radar zoom to default (2500)
    State.currentZoomIndex = 2;
    State.RADAR_RANGE = ZOOM_LEVELS[State.currentZoomIndex];
    // radarRangeEl.innerText = State.RADAR_RANGE; // REMOVED

    // Determine initial input mode based on device
    if (window.matchMedia("(pointer: coarse)").matches) { State.inputMode = 'touch'; }
    else { State.inputMode = 'mouse'; }

    if (!State.loopStarted) {
        State.loopStarted = true;
        loop();
    }
}



