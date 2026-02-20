function onShipDestroyed(ship, killerShip = null) {
    if (killerShip === playerShip) {
        if (ship.isFriendly && !playerShip.loneWolf) {
            triggerBetrayal();
            return;
        }

        increaseShipScore(killerShip, SHIP_KILLED_REWARD);
    }
}

function onStationDestroyed(station, killerShip = null) {
    if (station) {
        let junkAst = createAsteroid(station.x + ASTEROID_SPLIT_OFFSET, station.y, ASTEROID_MIN_SIZE);
        junkAst.xv = station.xv + ASTEROID_SPLIT_SPEED;
        junkAst.yv = station.yv;
        junkAst.blinkNum = 30;
        roids.push(junkAst);
        updateAsteroidCounter();
    };

    if (killerShip === playerShip) {
        if (station.isFriendly && !playerShip.loneWolf) {
            triggerBetrayal();
            return;
        }

        playerShip.shield = playerShip.maxShield;
        increaseShipScore(killerShip, STATION_KILLED_REWARD);
        stationsDestroyedCount++;

        playerShip.lives++;
        drawLives();
        addScreenMessage("EXTRA LIFE!");

        playerShip.structureHP = SHIP_RESISTANCE;
        playerShip.shield = playerShip.maxShield;
    }
}


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
    startScreen.removeEventListener('click', audioStarter);
}

const audioStopper = () => {
    AudioEngine.stopMusic();
    startScreen.removeEventListener('click', audioStopper);
}

window.onload = function () {
    resize();
    AudioEngine.init();
    AudioEngine.setTrack('menu');

    // Initialize dummy playerShip for safety during early loops
    playerShip = { dead: true, tier: 0, score: 0, a: 0 };

    // Initialize background world immediately
    initBackground();
    createLevel();

    // Start loop immediately so we see the world behind the intro
    if (!loopStarted) {
        loopStarted = true;
        loop();
    }

    // Add listener to start audio on the first interaction
    startScreen.addEventListener('click', audioStarter);

    showInfoLEDText("The Classic, reimagined by Aron Galdon. Have a safe trip!")
}

// Function to handle zoom change (used by Z key and Mouse Wheel)
function changeRadarZoom(direction) {
    let newIndex = currentZoomIndex + direction;

    if (newIndex < 0) newIndex = 0;
    if (newIndex >= ZOOM_LEVELS.length) newIndex = ZOOM_LEVELS.length - 1;

    if (newIndex !== currentZoomIndex) {
        currentZoomIndex = newIndex;
        RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex];
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') shootLaser();

    // NOTE: The logic for KeyE to create matter has been permanently removed.

    if (e.code === 'KeyZ') {
        changeRadarZoom(1); // Zoom Out (next level)
    }

    if (e.code === 'KeyX') {
        changeRadarZoom(-1); // Zoom In (previous level)
    }

    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.ArrowUp = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.ArrowDown = false; // KeyS is brake

    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;

    if (e.code === 'KeyA') keys.KeyA = true;
    if (e.code === 'KeyD') keys.KeyD = true;
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

let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchStartTime = 0;
let initialPinchDistance = 0;
let wasPinching = false;

document.addEventListener('touchstart', (e) => {
    if (!gameRunning) return; // Allow interaction with start screen
    if (e.target.closest('.btn') || e.target.closest('.start-btn')) return;

    inputMode = 'touch';
    isTouching = true;

    if (e.touches.length === 1) {
        // Joystick Anchor
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();

        // Rotate ship to face the tap immediately
        const dx = touchStartX - width / 2;
        const dy = touchStartY - height / 2;
        playerShip.a = Math.atan2(dy, dx);
    } else if (e.touches.length === 2) {
        // Prepare for pinch zoom
        wasPinching = true;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }

    e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (!isTouching || !gameRunning || playerShip.dead) return;
    e.preventDefault();

    if (e.touches.length === 1) {
        const duration = Date.now() - touchStartTime;
        if (duration < MIN_DURATION_TAP_TO_MOVE) {
            return;
        }

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        const dx = currentX - touchStartX;
        const dy = currentY - touchStartY;

        // Deadzone to prevent jitter
        if (Math.hypot(dx, dy) > 10) {
            // Steer towards the drag vector
            // Note: dy is screen coordinates (down is positive).
            let targetAngle = Math.atan2(dy, dx);

            // Smooth rotate towards target
            let angleDiff = targetAngle - playerShip.a;

            // Safety check for NaN or Infinity
            if (isNaN(angleDiff) || !isFinite(angleDiff)) angleDiff = 0;

            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

            playerShip.a += angleDiff * 0.2; // Responsiveness

            // Normalize a to [-PI, PI] to prevent overflow over long gameplay
            while (playerShip.a > Math.PI) playerShip.a -= 2 * Math.PI;
            while (playerShip.a <= -Math.PI) playerShip.a += 2 * Math.PI;
        }
    } else if (e.touches.length === 2) {
        const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = currentDistance - initialPinchDistance;

        // Sensivity threshold for zoom change
        if (Math.abs(diff) > 40) {
            const direction = diff > 0 ? -1 : 1; // Pinch out (diff > 0) -> Zoom In (-1 index)
            changeRadarZoom(direction);
            initialPinchDistance = currentDistance;
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!gameRunning) return;
    if (e.target.closest('.btn') || e.target.closest('.start-btn')) return;

    if (e.touches.length === 0) {
        isTouching = false;
        initialPinchDistance = 0;
        // Reset wasPinching after a short delay to allow the last touchend to check it
        setTimeout(() => { wasPinching = false; }, 0);
    }

    // Short tap => shoot still (only if it was a single touch interaction and no pinch occurred)
    const duration = Date.now() - touchStartTime;
    if (duration < MIN_DURATION_TAP_TO_MOVE && e.changedTouches.length === 1 && !wasPinching) {
        shootLaser();
    }
    e.preventDefault();
});

/* Background factories moved to core.js */

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

function spawnStation(hostPlanet = null) {
    if (!hostPlanet) {
        const nearbyPlanets = roids.filter(r => r.isPlanet);
        if (nearbyPlanets.length === 0) {
            stationSpawnTimer = 300;
            return;
        }

        // Select a random planet to host the station
        hostPlanet = nearbyPlanets[Math.floor(Math.random() * nearbyPlanets.length)];
    }

    const SAFE_ORBIT_FACTOR = 0.3; // Much closer
    const STATION_R = 70;
    const orbitDistance = hostPlanet.r + (hostPlanet.r * SAFE_ORBIT_FACTOR) + STATION_R;

    const orbitAngle = Math.random() * Math.PI * 2;

    // Calculate initial ABSOLUTE WORLD position relative to the planet center
    const startX = hostPlanet.x + Math.cos(orbitAngle) * orbitDistance;
    const startY = hostPlanet.y + Math.sin(orbitAngle) * orbitDistance;

    const friendly = playerShip.loneWolf === false && homePlanetId !== null && hostPlanet.id === homePlanetId;

    ships.push({
        type: 'station',
        x: startX, // World Coordinate X
        y: startY, // World Coordinate Y
        xv: hostPlanet.xv, // Inherit planet velocity
        yv: hostPlanet.yv,
        r: STATION_R, a: Math.random() * Math.PI * 2, rotSpeed: 0.005,
        structureHP: STATION_RESISTANCE,
        shieldHitTimer: 0,
        spawnTimer: 180, reloadTime: 120, mass: 500,
        hostPlanet: hostPlanet, // Reference to the planet object
        orbitDistance: orbitDistance,
        orbitAngle: orbitAngle,
        orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * 0.002, // Slow orbital rotation
        fleetHue: friendly ? SHIP_FRIENDLY_BLUE_HUE : Math.floor(Math.random() * 360),
        blinkNum: 60,
        z: 0, // Always at default Z-depth for radar visibility
        hostPlanetId: hostPlanet.id, // Store ID instead of reference
        isFriendly: friendly,
        // Weapon Props
        bulletSpeed: 20,
        bulletSize: 6,
        bulletLife: 50,
        effectiveR: STATION_R // Use station radius for bullet spawn offset
    });
    stationSpawnTimer = STATIONS_SPAWN_TIMER + Math.random() * STATIONS_SPAWN_TIMER;
}

function spawnShipsSquad(station) {
    // Avoid spawning more than SHIPS_LIMIT total ships (including players for friendly squads)
    if (station.isFriendly) {
        const currentFriendlyShips = ships.filter(en => en.type === 'ship' && en.isFriendly === true).length;
        if (currentFriendlyShips >= SHIPS_LIMIT) { return; }
    } else {
        const currentHostileShips = ships.filter(en => en.type === 'ship' && en.isFriendly === false).length;
        // Hostile stations have their own local limit based on SHIPS_LIMIT
        if (currentHostileShips >= SHIPS_LIMIT * 3) { return; } // Allowing more hostiles than friends for balance
    }
    const squadId = Math.random();

    let formationData = [
        { role: 'leader', x: 0, y: 0 },
        { role: 'wingman', x: -120, y: -120 }, { role: 'wingman', x: 120, y: -120 },
        { role: 'wingman', x: -240, y: -240 }, { role: 'wingman', x: 240, y: -240 },
        { role: 'wingman', x: -360, y: -360 }, { role: 'wingman', x: 360, y: -360 }
    ];

    // Limit squad size to SHIPS_LIMIT (accounting for player if friendly)
    formationData = formationData.slice(0, SHIPS_LIMIT);

    const spawnDist = station.r * 2.0;
    const spawnAngle = Math.random() * Math.PI * 2;

    const squadX = station.x + Math.cos(spawnAngle) * spawnDist;
    const squadY = station.y + Math.sin(spawnAngle) * spawnDist;

    let e = null;
    let leader = null;

    formationData.forEach(slot => {
        if (station.isFriendly && playerShip.dead === false && playerShip.squadId === null) {
            e = playerShip;
            e.squadId = squadId;
            e.bulletSpeed = 25; // Player stats are handled elsewhere usually, but good fallback
        }
        else {
            e = {
                a: spawnAngle + Math.PI,
                aiState: 'FORMATION',
                blinkNum: 30,
                fleetHue: station.fleetHue,
                formationOffset: { x: slot.x, y: slot.y },
                isFriendly: station.isFriendly,
                leaderRef: null,
                mass: 30,
                r: SHIP_SIZE / 2,
                reloadTime: 100 + Math.random() * 100,
                role: slot.role,
                score: 0,
                shieldHitTimer: 0,
                squadId: squadId,
                structureHP: SHIP_RESISTANCE,
                thrusting: false,
                tier: 0,
                // Weapon Properties (Default for Player)
                bulletSpeed: 25,
                bulletLife: 50,
                bulletSize: 6,
                type: 'ship',
                x: squadX + slot.x,
                xv: station.xv,
                y: squadY + slot.y,
                yv: station.yv,
                z: 0,
                homeStation: station,
                // Individual Weapon Properties (Randomized)
                bulletSpeed: 15 + Math.random() * 10, // 15-25
                bulletSize: 4 + Math.random() * 3, // 4-7
                bulletLife: 45 + Math.random() * 15,
                shootDelay: Math.random() * 20 // Randomize firing phase
            };
        }

        if (slot.role === 'leader') {
            leader = e;
            leader.squadSlots = []; // Initialize slots
            // If the leader is the player, we attach slots to the player object
            if (e === playerShip) playerShip.squadSlots = [];
        } else {
            e.leaderRef = leader;
            // Register this wingman in the leader's slot list
            if (leader) {
                // Determine which list to use (player or NPC leader)
                const slots = leader === playerShip ? playerShip.squadSlots : leader.squadSlots;
                if (slots) {
                    slots.push({
                        x: slot.x,
                        y: slot.y,
                        occupant: e
                    });
                }
            }
        }

        ships.push(e);
    });
}

/* Entity factories moved to core.js */

function addScreenMessage(text, color = "white") {
    // Avoid duplicate messages if they are the same
    if (screenMessages.length > 0 && screenMessages[screenMessages.length - 1].text === text) return;
    screenMessages.push({ text, color, life: 180 }); // 3 seconds at 60fps

    // Limit to 2 most recent messages
    if (screenMessages.length > 2) {
        screenMessages.shift();
    }
}

function triggerBetrayal() {
    if (playerShip.loneWolf) return;
    playerShip.leaderRef = null;
    playerShip.loneWolf = true;
    playerShip.squadId = null;
    addScreenMessage("⚠ BETRAYAL: YOU ARE NOW A LONE WOLF!", "#ff0000");
    addScreenMessage("NO MORE ALLIES WILL SUPPORT YOU.", "#ff4444");

    // Turn all current friends into ships
    ships.forEach(ship => {
        if (ship.isFriendly) {
            ship.isFriendly = false;
            ship.aiState = 'COMBAT';
            ship.fleetHue = 0; // Red for betrayal
        }
    });
}

function fireGodWeapon(ship) {
    playerReloadTime = PLAYER_RELOAD_TIME_MAX * 5; // Long cooldown for massive power

    // Play Godly sound
    AudioEngine.playLaser(worldOffsetX, worldOffsetY, 12);

    // One-time announcement handled in metamorphosis completion logic

    // Create the expanding ring
    shockwaves.push({
        x: worldOffsetX,
        y: worldOffsetY,
        r: 100,
        maxR: Math.max(width, height) * 4, // Reach 4 times the visible viewport (~4000 units)
        strength: 2000,
        alpha: 3.0,
        isGodRing: true,
        type: 'lightning'
    });
}

function fireEntityWeapon(ship, bulletList, isEnemy = true) {
    const isPlayer = (ship === playerShip);
    const tier = isPlayer ? ship.tier : Math.floor(ship.score / SHIP_EVOLUTION_SCORE_STEP);

    if (isPlayer && tier >= 12) {
        if (ship.transformationTimer > 0) {
            // Cannot fire while transforming to Godship
            if (playerReloadTime <= 0) {
                addScreenMessage("ENERGY UNSTABLE: TRANSFORMING...", "#ffaa00");
                playerReloadTime = 30; // Brief internal cooldown for message
            }
            return;
        }
        fireGodWeapon(ship);
        return;
    }

    const hue = ship.fleetHue !== undefined ? ship.fleetHue : 200;
    const a = isPlayer ? playerShip.a : ship.a;

    const pushBullet = (angleOffset, isPrimary = true) => {
        const shootAngle = a + angleOffset;

        // Systematic scaling for power feel
        const speedScale = 1 + (tier * 0.08); // +8% speed per tier
        const sizeScale = 1 + (tier * 0.12);  // +12% size per tier

        // Strictly force bullet origin to be at the ship's nose (front vertex)
        const visualScale = 1 + (tier * 0.1);
        const spawnRadius = ((ship.effectiveR || ship.r) * visualScale) + 20;

        const fwdX = Math.cos(a);
        const fwdY = Math.sin(a);

        const startX = (isPlayer ? worldOffsetX : ship.x) + (fwdX * spawnRadius);
        const startY = (isPlayer ? worldOffsetY : ship.y) + (fwdY * spawnRadius);

        const bSpeed = (ship.bulletSpeed || 18) * speedScale;
        const bLife = ship.bulletLife || (isPrimary ? SHIP_BULLET1_LIFETIME : SHIP_BULLET2_LIFETIME);
        const bSize = (ship.bulletSize || 5) * sizeScale;

        const velX = (Math.cos(shootAngle) * bSpeed) + (isPlayer ? velocity.x : ship.xv);
        const velY = (Math.sin(shootAngle) * bSpeed) + (isPlayer ? velocity.y : ship.yv);

        const bullet = {
            x: startX,
            y: startY,
            xv: velX,
            yv: velY,
            a: shootAngle,
            dist: 0,
            life: bLife,
            size: bSize,
            tier: tier,
            hue: hue,
            isFriendly: isPlayer || ship.isFriendly,
            owner: ship
        };
        bulletList.push(bullet);
    };

    // --- TIER PATTERNS (Clearly more powerful with each step) ---
    if (tier === 11) { // THE HYPERION: Massive Arc & Defense
        pushBullet(0, true);
        for (let i = 1; i <= 6; i++) {
            pushBullet(i * 0.1, true); pushBullet(-i * 0.1, true);
        }
        pushBullet(Math.PI, false); // Rear guard
    } else if (tier === 10) { // THE TITAN: Heavy Frontal Wall
        pushBullet(0, true);
        for (let i = 1; i <= 5; i++) {
            pushBullet(i * 0.05, true); pushBullet(-i * 0.05, true);
        }
    } else if (tier === 9) { // THE CELESTIAL: Wide Radiant Spray
        pushBullet(0, true);
        pushBullet(0.15, true); pushBullet(-0.15, true);
        pushBullet(0.3, false); pushBullet(-0.3, false);
        pushBullet(0.45, false); pushBullet(-0.45, false);
    } else if (tier === 8) { // THE SPHERE: 7 Strong Frontal
        pushBullet(0, true);
        pushBullet(0.1, true); pushBullet(-0.1, true);
        pushBullet(0.2, true); pushBullet(-0.2, true);
        pushBullet(0.3, false); pushBullet(-0.3, false);
    } else if (tier === 7) { // DECAGON
        pushBullet(0, true);
        pushBullet(0.1, true); pushBullet(-0.1, true);
        pushBullet(0.2, false); pushBullet(-0.2, false);
        pushBullet(0.3, false); pushBullet(-0.3, false);
    } else if (tier === 6) { // NONAGON
        pushBullet(0, true);
        pushBullet(0.12, true); pushBullet(-0.12, true);
        pushBullet(0.24, false); pushBullet(-0.24, false);
    } else if (tier === 5) { // OCTAGON
        pushBullet(0, true);
        pushBullet(0.15, true); pushBullet(-0.15, true);
        pushBullet(0.3, false); pushBullet(-0.3, false);
    } else if (tier === 4) { // HEPTAGON
        pushBullet(0, true);
        pushBullet(0.2, false); pushBullet(-0.2, false);
    } else if (tier === 3) { // HEXAGON
        pushBullet(0, true);
        pushBullet(0.1, true); pushBullet(-0.1, true);
    } else if (tier === 2) { // PENTAGON
        pushBullet(0, true); // Double shot (Parallel feel)
        pushBullet(0, true);
    } else if (tier === 1) { // SQUARE
        pushBullet(0, true); // One shot, but scaling makes it stronger
    } else { // TIER 0: TRIANGLE
        pushBullet(0, true);
    }

    if (isPlayer) AudioEngine.playLaser(worldOffsetX, worldOffsetY, tier);
    else AudioEngine.playLaser(ship.x, ship.y, tier);
}

function shootLaser() {
    if (!gameRunning || playerShip.dead || victoryState) return;
    if (playerReloadTime > 0) return;
    playerReloadTime = PLAYER_RELOAD_TIME_MAX;
    fireEntityWeapon(playerShip, playerShipBullets, false);
}

// --- ASTEROID EXPULSION LOGIC REMOVED ---

function isTrajectoryClear(e, targetX, targetY) {
    const trajectoryAngle = Math.atan2(targetY - e.y, targetX - e.x);
    const distToTarget = Math.hypot(targetX - e.x, targetY - e.y);

    // Check against player
    if (!playerShip.dead) {
        if (e.isFriendly) {
            // Friendlies check if player is in way
            const distToPlayer = Math.hypot(worldOffsetX - e.x, worldOffsetY - e.y);
            if (distToPlayer < distToTarget) {
                const angleToPlayer = Math.atan2(worldOffsetY - e.y, worldOffsetX - e.x);
                let diff = Math.abs(trajectoryAngle - angleToPlayer);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if (diff < 0.2) return false; // Player is in way
            }
        } else {
            // ships check if other ships are in way
            // (Standard enemy behavior handled in enemyShoot, but let's be thorough)
        }
    }

    // Check against all other ships/stations
    for (let other of ships) {
        if (other === e) continue;

        let shouldRespect = false;
        if (e.isFriendly && other.isFriendly) shouldRespect = true;
        if (!e.isFriendly && !other.isFriendly && e.fleetHue === other.fleetHue) shouldRespect = true;

        if (shouldRespect) {
            const distToOther = Math.hypot(other.x - e.x, other.y - e.y);
            if (distToOther < distToTarget) {
                const angleToOther = Math.atan2(other.y - e.y, other.x - e.x);
                let diff = Math.abs(trajectoryAngle - angleToOther);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if (diff < 0.25) return false; // Friend is in way
            }
        }
    }
    return true;
}

function proactiveCombatScanner(e) {
    if (e.reloadTime > 0) return;

    // 1. SCAN FOR RIVALS
    for (let target of ships) {
        if (target === e || target.type === 'station') continue;

        let isRival = false;
        if (e.isFriendly && !target.isFriendly) isRival = true;
        if (!e.isFriendly && (target.isFriendly || target.fleetHue !== e.fleetHue)) isRival = true;

        if (isRival) {
            const dist = Math.hypot(target.x - e.x, target.y - e.y);
            if (dist < 2000) {
                // Since we mirror rotation, we only shoot if lined up
                enemyShoot(e, target.x, target.y);
                if (e.reloadTime > 0) return; // Shot fired
            }
        }
    }

    // 2. SCAN FOR ASTEROIDS (Defend Home Station)
    // Priority: Asteroids near the home station
    if (e.homeStation) {
        for (let r of roids) {
            if (r.z > 0.5 || r.isPlanet) continue;
            const distToStation = Math.hypot(r.x - e.homeStation.x, r.y - e.homeStation.y);
            const dangerRange = e.homeStation.r * 8.0;

            if (distToStation < dangerRange) {
                const distToShip = Math.hypot(r.x - e.x, r.y - e.y);
                if (distToShip < 2000) { // Within firing range
                    enemyShoot(e, r.x, r.y);
                    if (e.reloadTime > 0) return;
                }
            }
        }
    }

    // Generic asteroid clearing
    for (let r of roids) {
        if (r.z > 0.5 || r.isPlanet) continue;
        const dist = Math.hypot(r.x - e.x, r.y - e.y);
        if (dist < 1500) {
            enemyShoot(e, r.x, r.y);
            if (e.reloadTime > 0) return;
        }
    }

    // 3. SCAN FOR PLAYER (if enemy)
    if (!e.isFriendly && !playerShip.dead) {
        const dist = Math.hypot(worldOffsetX - e.x, worldOffsetY - e.y);
        if (dist < 2000) {
            enemyShoot(e, worldOffsetX, worldOffsetY);
        }
    }
}

function enemyShoot(e, tx, ty) {
    // e.x, e.y, tx, ty are ABSOLUTE WORLD COORDINATES

    if (tx === undefined) tx = worldOffsetX;
    if (ty === undefined) ty = worldOffsetY;

    let trajectoryAngle = Math.atan2(ty - e.y, tx - e.x); // Correct angle in world space

    let angleDiff = trajectoryAngle - e.a;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

    const FIRE_CONE = Math.PI / 6; // 30 degrees
    if (Math.abs(angleDiff) > FIRE_CONE) return;

    if (!isTrajectoryClear(e, tx, ty)) return;

    let clearShot = true;

    for (let other of ships) {
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
        fireEntityWeapon(e, enemyShipBullets, true);
        e.reloadTime = 30 + Math.random() * 20; // Set cooldown after successful shot
    }
}

function drawRadar() {
    try {
        const rW = canvasRadar.width; const rH = canvasRadar.height;
        const cX = rW / 2; const cY = rH / 2;
        canvasRadarContext.clearRect(0, 0, rW, rH);

        const radarRadius = rW / 2;
        const scale = radarRadius / Math.max(1, RADAR_RANGE);

        const drawBlip = (worldX, worldY, type, color, size, z = 0) => {
            if (!isFinite(worldX) || !isFinite(worldY) || isNaN(worldX) || isNaN(worldY)) return;

            let dx = worldX - worldOffsetX;
            let dy = worldY - worldOffsetY;

            // Safety check for worldOffset being invalid
            if (isNaN(dx) || isNaN(dy)) return;

            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > RADAR_RANGE || !isFinite(dist)) return;

            let angle = Math.atan2(dy, dx);
            let radarDist = dist * scale;
            let radarSize = (size * scale) / (1 + z);

            // Ensure elements are visible on the radar regardless of zoom
            if (type === 'planet') radarSize = Math.max(4, radarSize);
            else if (type === 'asteroid') radarSize = Math.max(1.5, radarSize);
            else radarSize = Math.max(2, radarSize); // Default minimum for ships/etc

            // Safety check for radarSize
            if (isNaN(radarSize) || !isFinite(radarSize)) radarSize = 2;

            if (radarDist > radarRadius - radarSize) {
                radarDist = Math.max(0, radarRadius - radarSize - 1);
            }

            if (isNaN(radarDist) || !isFinite(radarDist)) return;

            let rx = cX + radarDist * Math.cos(angle);
            let ry = cY + radarDist * Math.sin(angle);

            if (isNaN(rx) || isNaN(ry)) return;

            canvasRadarContext.fillStyle = color;
            canvasRadarContext.strokeStyle = color;

            if (type === 'station') {
                canvasRadarContext.font = "bold 12px Courier New";
                canvasRadarContext.textAlign = 'center';
                canvasRadarContext.textBaseline = 'middle';
                canvasRadarContext.fillText('O', rx, ry);
            } else if (type === 'asteroid') {
                canvasRadarContext.beginPath();
                canvasRadarContext.arc(rx, ry, radarSize, 0, Math.PI * 2);
                canvasRadarContext.stroke();
            } else {
                canvasRadarContext.beginPath();
                canvasRadarContext.arc(rx, ry, radarSize, 0, Math.PI * 2);
                canvasRadarContext.fill();
            }
        };

        roids.forEach(r => {
            if (r.isPlanet) {
                const color = r.textureData ? r.textureData.waterColor : 'rgba(0, 150, 255, 0.7)';
                const radarSize = r.r;
                drawBlip(r.x, r.y, 'planet', color, radarSize, r.z);
            }
        });

        roids.forEach(r => {
            if (!r.isPlanet && r.z <= 0.1) {
                drawBlip(r.x, r.y, 'asteroid', 'rgba(200, 200, 200, 0.9)', r.r, r.z);
            }
        });

        ships.forEach(e => {
            if (e.z <= 0.1) {
                const color = e.isFriendly ? '#0088FF' : '#FF0000';
                if (e.type === 'station') {
                    drawBlip(e.x, e.y, 'station', color, 0, e.z);
                } else {
                    drawBlip(e.x, e.y, 'ship', color, 2, e.z);
                }
            }
        });

        canvasRadarContext.strokeStyle = 'rgba(0, 255, 255, 0.2)'; canvasRadarContext.lineWidth = 1;
        canvasRadarContext.beginPath(); canvasRadarContext.moveTo(cX, 0); canvasRadarContext.lineTo(cX, rH); canvasRadarContext.stroke();
        canvasRadarContext.beginPath(); canvasRadarContext.moveTo(0, cY); canvasRadarContext.lineTo(rW, cY); canvasRadarContext.stroke();
        canvasRadarContext.beginPath(); canvasRadarContext.arc(cX, cY, rW / 2 - 1, 0, Math.PI * 2); canvasRadarContext.stroke();
        canvasRadarContext.fillStyle = '#0ff'; canvasRadarContext.beginPath(); canvasRadarContext.arc(cX, cY, 3, 0, Math.PI * 2); canvasRadarContext.fill();

        // 4. HOME PLANET NAVIGATOR (Dotted path to home)
        if (homePlanetId) {
            const home = roids.find(r => r.id === homePlanetId);
            if (home) {
                let dx = home.x - worldOffsetX;
                let dy = home.y - worldOffsetY;
                let dist = Math.sqrt(dx * dx + dy * dy);
                let angle = Math.atan2(dy, dx);

                // Calculate radar position for home planet blip
                let radarDist = dist * scale;
                if (radarDist > radarRadius - 5) radarDist = radarRadius - 5;

                let rx = cX + radarDist * Math.cos(angle);
                let ry = cY + radarDist * Math.sin(angle);

                // Draw dotted line
                canvasRadarContext.setLineDash([3, 5]);
                canvasRadarContext.strokeStyle = 'rgba(0, 255, 255, 0.5)';
                canvasRadarContext.lineWidth = 1;
                canvasRadarContext.beginPath();
                canvasRadarContext.moveTo(cX, cY);
                canvasRadarContext.lineTo(rx, ry);
                canvasRadarContext.stroke();
                canvasRadarContext.setLineDash([]); // Reset dash

                // Ensure home blip is always visible on radar edge if far away
                canvasRadarContext.fillStyle = '#00ffaa';
                canvasRadarContext.beginPath();
                canvasRadarContext.arc(rx, ry, 4, 0, Math.PI * 2);
                canvasRadarContext.fill();

                // Pulse effect for home planet
                if (Date.now() % 1000 < 500) {
                    canvasRadarContext.strokeStyle = '#00ffaa';
                    canvasRadarContext.beginPath();
                    canvasRadarContext.arc(rx, ry, 7, 0, Math.PI * 2);
                    canvasRadarContext.stroke();
                }
            }
        }
    } catch (e) {
        console.error("Radar drawing error:", e);
    }
}

function drawHeart(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size, -size, -size * 1.5, size / 2, 0, size);
    ctx.bezierCurveTo(size * 1.5, size / 2, size, -size, 0, 0);
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    ctx.restore();
}

function drawLives() {
    livesDisplay.innerText = `LIVES: ${playerShip.lives}`;
    livesDisplay.style.color = '#0ff';
    livesDisplay.style.marginTop = '5px';
}

function updateHUD() {
    if (scoreDisplay && playerShip) {
        const currentScore = playerShip.score || 0;
        scoreDisplay.innerText = isNaN(currentScore) ? 0 : currentScore;
    }
    if (asteroidCountDisplay) {
        asteroidCountDisplay.innerText = roids.filter(r => !r.isPlanet).length;
    }
}

function updateAsteroidCounter() {
    updateHUD();
}

function createAsteroidBelt(cx, cy, innerRadius, outerRadius, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const r = (Math.random() < 0.5 ? 0.5 : 0.25) * ASTEROID_MAX_SIZE;
        const roid = createAsteroid(x, y, r);

        // Small tangential velocity to give a sense of belt movement
        const orbitalSpeed = 0.2 + Math.random() * 0.3;
        const tangentAngle = angle + Math.PI / 2;
        roid.xv += Math.cos(tangentAngle) * orbitalSpeed * (Math.random() < 0.5 ? 1 : -1);
        roid.yv += Math.sin(tangentAngle) * orbitalSpeed * (Math.random() < 0.5 ? 1 : -1);

        roids.push(roid);
    }
}

function createLevel() {
    roids = []; enemyShipBullets = []; playerShipBullets = []; shockwaves = [];
    // ships = []; // REMOVED: Don't clear ships here, clear it in startGame instead

    if (PLANETS_LIMIT === 0) {
        homePlanetId = null;
    }
    else {
        let planetSpawned = false;
        let planetX = (Math.random() - 0.5) * 5000;
        let planetY = (Math.random() - 0.5) * 5000;
        let firstPlanet = createAsteroid(planetX, planetY, PLANET_THRESHOLD + 1, 0);
        roids.push(firstPlanet);
        homePlanetId = firstPlanet.id;
        firstPlanet.name = "HOME";
        firstPlanet.zSpeed = 0;

        if (firstPlanet.textureData) {
            firstPlanet.textureData.waterColor = `hsl(${SHIP_FRIENDLY_BLUE_HUE}, 60%, 30%)`;
            firstPlanet.textureData.atmosphereColor = `hsl(${SHIP_FRIENDLY_BLUE_HUE}, 80%, 60%)`;
            firstPlanet.textureData.innerGradColor = `hsl(${SHIP_FRIENDLY_BLUE_HUE}, 10%, 2%)`;
        }

        planetSpawned = true;
    }

    createAsteroidBelt(0, 0, ASTEROIDS_INIT_INNER, ASTEROIDS_INIT_OUTER, ASTEROIDS);

    roids.filter(r => r.isPlanet).forEach(planet => {
        const stationCount = Math.floor(Math.random() * STATIONS_PER_PLANET) + 1;
        for (let i = 0; i < stationCount; i++) {
            spawnStation(planet);
        }
    });

    updateAsteroidCounter();
}

function hitPlayerShip(damageAmount, sourceIsNearPlanet = false) {
    if (playerShip.blinkNum > 0 || playerShip.dead || victoryState) return;

    playerShip.structureHP--;

    const vpX = width / 2; const vpY = height / 2;
    createExplosion(vpX, vpY, 10, '#0ff', 2);

    if (playerShip.structureHP <= 0) {
        playerShip.structureHP = 0;
        killPlayerShip();
    }
    else {
        playerShip.blinkNum = 15;
        velocity.x *= -0.5; velocity.y *= -0.5;
    }
}

function killPlayerShip(reason = 'normal') {
    const vpX = width / 2; const vpY = height / 2;
    createExplosion(vpX, vpY, 60, '#0ff', 3);
    AudioEngine.playExplosion('large', worldOffsetX, worldOffsetY);

    playerShip.dead = true;
    playerShip.leaderRef = null;
    playerShip.lives--;
    drawLives(); // Ensure HUD reflects 0 immediately
    playerShip.squadId = null;

    velocity = { x: 0, y: 0 };

    increaseShipScore(playerShip, -1000);

    if (playerShip.lives > 0) setTimeout(() => {
        playerShip.dead = false;
        playerShip.structureHP = SHIP_RESISTANCE;

        drawLives();
    }, 3000);
    else {
        // MOVE PLANETS TO Z (Far background)
        roids.forEach(r => {
            if (r.isPlanet && r.id !== homePlanetId) {
                r.z = MAX_Z_DEPTH;
            }
        });

        // HIDE HUD DURING GAME OVER
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'none';

        setTimeout(() => {
            fadeOverlay.style.background = 'rgba(0, 0, 0, 0.4)'; // Trigger semi-transparent fade
            startScreen.classList.remove('fade-out'); // Reset before fade
            startScreen.classList.add('game-over');
            startScreen.style.display = 'flex';

            gameRunning = false;

            // Audio: Game Over Sequence
            AudioEngine.playGameOverMusic();
            startScreen.addEventListener('click', audioStopper);

            // Philosophical Game Over Messages
            if (reason === 'player') {
                showInfoLEDText("The universe trembles at your power, but who are you now without a home? You reached for divinity and crushed the cradle that once held you.");
            } else if (reason === 'collision') {
                showInfoLEDText("A cosmic dance turned into tragedy. Two worlds collided in the cold silence of space, and your history was erased in an instant flash of light.");
            } else {
                showInfoLEDText("Your journey ends here. The stars remain indifferent to your passing, yet your echo lingers in the void.");
            }

            // Bring up the button and initiate the slow fade of the BG image
            setTimeout(() => {
                startBtn.style.display = 'block';
                startBtn.innerText = 'RESTART JOURNEY';
                startScreen.classList.add('fade-out');
            }, 3000);
        }, 5000);
    }
}

function triggerHomePlanetLost(reason) {
    playerShip.lives = 0; // Force game over
    killPlayerShip(reason);

    if (reason === 'player') {
        screenMessages = [];
        addScreenMessage("Oh, no, you destroyed your own home!", "#ff0000");
    } else {
        addScreenMessage("CRITICAL FAILURE: HOME PLANET DESTROYED", "#ff0000");
    }
}

function handleVictoryInteraction() {
    if (!victoryState) return;

    // Show Congratulations
    showInfoLEDText("CONGRATULATIONS: YOUR PLANET WILL LOVE YOU FOREVER.");
    addScreenMessage("MISSION ACCOMPLISHED!", "#00ff00");
    addScreenMessage("YOU HAVE CLEANED THE SYSTEM.", "#ffff00");

    startScreen.classList.remove('fade-out');
    startScreen.classList.add('victory');
    startScreen.style.display = 'flex';
    startScreen.addEventListener('click', audioStopper); // Allow stopping music
    startBtn.style.display = 'block';
    startBtn.innerText = 'RESTART JOURNEY';
    startBtn.onclick = () => {
        victoryState = false;
        startScreen.removeEventListener('click', audioStopper);
        startGame();
    };

    window.removeEventListener('mousedown', handleVictoryInteraction);
    window.removeEventListener('touchstart', handleVictoryInteraction);
};

function winGame() {
    if (victoryState) return;
    victoryState = true;

    // Play Victory Music
    AudioEngine.playVictoryMusic();

    // ALL ENEMIES BECOME FRIENDS
    ships.forEach(s => {
        if (!s.isFriendly) {
            s.isFriendly = true;
            s.aiState = 'FORMATION';
            s.leaderRef = playerShip;
            addScreenMessage("THE SYSTEM IS PURIFIED. ENEMIES JOIN THE CAUSE.", "#00ffff");
        }
    });

    // MOVE PLANETS TO Z (Far background) to avoid further collisions
    roids.forEach(r => {
        if (r.isPlanet && r.id !== homePlanetId) {
            r.z = MAX_Z_DEPTH;
        }
    });

    // No text or buttons until click/tap
    // Wait a short bit to avoid capturing the click that destroyed the last asteroid
    setTimeout(() => {
        window.addEventListener('mousedown', handleVictoryInteraction);
        window.addEventListener('touchstart', handleVictoryInteraction);
    }, 1000);
}

const spatialGrid = new SpatialHash(2000);

function updatePhysics() {
    const activePlanets = [];
    spatialGrid.clear();

    // PHASE 1: PHYSICS UPDATE & GRID POPULATION
    for (let i = 0; i < roids.length; i++) {
        let r1 = roids[i];
        if (isNaN(r1.x) || isNaN(r1.y)) { roids.splice(i, 1); updateAsteroidCounter(); i--; continue; }

        // --- 1. Radius Growth ---
        if (r1.targetR && r1.r < r1.targetR) {
            r1.r += (r1.targetR - r1.r) * 0.02;
            r1.mass = r1.r * r1.r * 0.05;
            if (r1.targetR - r1.r < 1.0) { r1.r = r1.targetR; r1.targetR = null; r1.mass = r1.r * r1.r * 0.05; }
        } else {
            r1.mass = r1.r * r1.r * 0.05;
        }

        // --- 2. Planet Physics (Z-Depth, Orbit) ---
        if (r1.isPlanet) {
            if (r1.zWait > 0) {
                r1.zWait--;
            } else {
                r1.z += r1.zSpeed;
                if (r1.z < 0.2 && !r1.hasSpawnedStationThisCycle) {
                    const hasStation = ships.some(e => e.type === 'station' && e.hostPlanetId === r1.id);
                    if (!hasStation) spawnStation(r1);
                    r1.hasSpawnedStationThisCycle = true;
                }
                if (r1.z > 1.0) r1.hasSpawnedStationThisCycle = false;
                if (r1.z > MAX_Z_DEPTH) r1.zSpeed *= -1;
                if (r1.z < 0) {
                    r1.z = 0; r1.zSpeed = Math.abs(r1.zSpeed);
                    r1.zWait = Math.floor(1.0 * (2 * MAX_Z_DEPTH / r1.zSpeed));
                }
            }
            if (r1.isBubbleDebris) {
                r1.xv *= r1.bubbleFriction; r1.yv *= r1.bubbleFriction;
                if (Math.hypot(r1.xv, r1.yv) < 0.1) r1.isBubbleDebris = false;
            }
            if (r1.semiMajorAxis && r1.orbitSpeed) {
                const zSpeedModifier = 1 / (1 + r1.z);
                const nextAngle = r1.orbitAngle + (r1.orbitSpeed * zSpeedModifier);
                const xEllipse = r1.semiMajorAxis * Math.cos(nextAngle);
                const yEllipse = r1.semiMinorAxis * Math.sin(nextAngle);
                const cosRot = Math.cos(r1.ellipseRotation);
                const sinRot = Math.sin(r1.ellipseRotation);
                const xRotated = xEllipse * cosRot - yEllipse * sinRot;
                const yRotated = xEllipse * sinRot + yEllipse * cosRot;
                r1.xv = (r1.orbitCenterX + xRotated) - r1.x;
                r1.yv = (r1.orbitCenterY + yRotated) - r1.y;
                r1.orbitAngle = nextAngle;
            }
        }

        // Unset destroyed flag for safety
        r1._destroyed = false;

        if (r1.blinkNum > 0) r1.blinkNum--;

        // Collect Active Planets (z < 1.0) for Attraction Logic
        if (r1.isPlanet && Math.abs(r1.z) < 1.0) {
            activePlanets.push(r1);
        }

        // --- 3. Attraction to Planets (Asteroids only) ---
        if (!r1.isPlanet) {
            let nearestPlanet = null;
            let minDistSq = Infinity;

            // Use local activePlanets list instead of full loop
            for (const other of activePlanets) {
                const dSq = (other.x - r1.x) ** 2 + (other.y - r1.y) ** 2;
                if (dSq < minDistSq) { minDistSq = dSq; nearestPlanet = other; }
            }

            if (nearestPlanet) {
                const dist = Math.sqrt(minDistSq);
                const dx = nearestPlanet.x - r1.x;
                const dy = nearestPlanet.y - r1.y;
                const orbitRadius = nearestPlanet.r * 1.5 + r1.r;
                const gravityRange = nearestPlanet.r * 8.0;

                if (dist < gravityRange) {
                    const isOrbitCandidate = (r1.r <= ASTEROID_MIN_SIZE * 1.1);
                    if (dist > orbitRadius || !isOrbitCandidate) {
                        const forceMagnitude = (G_CONST * nearestPlanet.mass * 8.0) / Math.max(minDistSq, 100);
                        r1.xv += (dx / dist) * forceMagnitude;
                        r1.yv += (dy / dist) * forceMagnitude;
                    }
                    if (dist <= orbitRadius && isOrbitCandidate) {
                        if (!r1.orbitRadiusFactor) r1.orbitRadiusFactor = 1.3 + Math.random() * 2.5;
                        const dynamicOrbitRadius = nearestPlanet.r * r1.orbitRadiusFactor + r1.r;
                        const angleToPlanet = Math.atan2(dy, dx);
                        const tangentAngle = angleToPlanet + Math.PI / 2;
                        const orbitSpeed = Math.sqrt((G_CONST * nearestPlanet.mass * 8.0) / dist);
                        const targetXV = Math.cos(tangentAngle) * orbitSpeed;
                        const targetYV = Math.sin(tangentAngle) * orbitSpeed;
                        r1.xv += (targetXV - r1.xv) * 0.1;
                        r1.yv += (targetYV - r1.yv) * 0.1;
                        const distError = dist - dynamicOrbitRadius;
                        const correctionForce = distError * 0.005;
                        r1.xv += (dx / dist) * correctionForce;
                        r1.yv += (dy / dist) * correctionForce;
                    }
                }
            }
        }

        // --- 4. Gravity on Player ---
        if (r1.isPlanet && r1.z < 0.5) {
            let dx = worldOffsetX - r1.x;
            let dy = worldOffsetY - r1.y;
            let distSq = dx * dx + dy * dy;
            let dist = Math.sqrt(distSq);
            if (dist < r1.r * 8 && dist > playerShip.r) {
                let clampedDistSq = Math.max(distSq, 100);
                let effectiveDist = Math.max(0, dist - playerShip.r);
                let feather = Math.min(1, (effectiveDist / (r1.r * 8)) * 5);
                let force = (G_CONST * r1.mass) / clampedDistSq;
                velocity.x += (dx / dist) * force * 1.5 * feather;
                velocity.y += (dy / dist) * force * 1.5 * feather;
            }
        }

        // --- 5. Speed Limit & Boundary ---
        const speed = Math.hypot(r1.xv, r1.yv);
        if (speed > ASTEROID_SPEED_LIMIT) {
            const ratio = ASTEROID_SPEED_LIMIT / speed;
            r1.xv *= ratio; r1.yv *= ratio;
        }
        if (Math.abs(r1.x) > WORLD_BOUNDS - BOUNDARY_TOLERANCE_ROIDS) r1.xv -= Math.sign(r1.x) * BOUNDARY_CORRECTION_FORCE;
        if (Math.abs(r1.y) > WORLD_BOUNDS - BOUNDARY_TOLERANCE_ROIDS) r1.yv -= Math.sign(r1.y) * BOUNDARY_CORRECTION_FORCE;

        // --- 6. Insert into Grid ---
        if (!r1.isPlanet && r1.z < 0.5) spatialGrid.insert(r1);
    }

    // PHASE 2: COLLISIONS & GRAVITY MESH
    for (let i = 0; i < activePlanets.length; i++) {
        let p = activePlanets[i];
        if (p._destroyed) continue;
        for (let j = i + 1; j < activePlanets.length; j++) {
            let p2 = activePlanets[j];
            if (!p2._destroyed) resolveInteraction(p, p2);
        }
        let potentialColliders = spatialGrid.query(p);
        for (let r2 of potentialColliders) {
            if (!r2._destroyed && !r2.isPlanet) resolveInteraction(p, r2);
        }
    }

    for (let i = 0; i < roids.length; i++) {
        let r1 = roids[i];
        if (r1.isPlanet || r1.z >= 0.5 || r1._destroyed) continue;
        let neighbors = spatialGrid.query(r1);
        for (let r2 of neighbors) {
            if (r1.id < r2.id && !r2.isPlanet && !r2._destroyed) {
                resolveInteraction(r1, r2);
            }
        }
    }

    // PHASE 3: CLEANUP
    let writeIdx = 0;
    for (let i = 0; i < roids.length; i++) {
        if (!roids[i]._destroyed) {
            roids[writeIdx++] = roids[i];
        }
    }
    roids.length = writeIdx;
    updateAsteroidCounter();
}

function resolveInteraction(r1, r2) {
    if (r1.blinkNum > 0 || r2.blinkNum > 0) return;

    let dx = r2.x - r1.x; let dy = r2.y - r1.y;
    let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);

    const attractionRange = (r1.r + r2.r) * 3;
    if (dist < attractionRange && dist > r1.r + r2.r) {
        let force = 0;
        if (r1.isPlanet && r2.isPlanet) {
            force = (G_CONST * r1.mass * r2.mass * 15.0) / Math.max(distSq, 2000);
        } else if (r1.isPlanet || r2.isPlanet) {
            force = (G_CONST * r1.mass * r2.mass) / Math.max(distSq, 500);
        } else {
            const isGiant = (r1.r >= ASTEROID_MAX_SIZE || r2.r >= ASTEROID_MAX_SIZE);
            const G_ROIDS = isGiant ? 5.0 : 0.08;
            force = (G_ROIDS * r1.mass * r2.mass) / Math.max(distSq, 400);
        }
        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;
        if (!isNaN(fx)) {
            r1.xv += fx / r1.mass; r1.yv += fy / r1.mass;
            r2.xv -= fx / r2.mass; r2.yv -= fy / r2.mass;
        }
        return;
    }

    if (dist < r1.r + r2.r) {
        const midX = (r1.x + r2.x) / 2; const midY = (r1.y + r2.y) / 2;
        const midVpX = midX - worldOffsetX + width / 2;
        const midVpY = midY - worldOffsetY + height / 2;

        if (r1.isPlanet && r2.isPlanet) {
            addScreenMessage("PLANETARY CATACLYSM: MASSIVE COLLISION DETECTED!", "#ff4400");
            createExplosion(midVpX, midVpY, 150, '#ffaa00', 8, 'flame');
            createExplosion(midVpX, midVpY, 100, '#ff4400', 12, 'flame');
            createExplosion(midVpX, midVpY, 80, '#550000', 15, 'smoke');
            createExplosion(midVpX, midVpY, 50, '#ffff00', 4, 'spark');
            AudioEngine.playPlanetExplosion(midX, midY, r1.z);
            if (r1.id === homePlanetId || r2.id === homePlanetId) triggerHomePlanetLost('collision');
            createExplosionDebris(midX, midY, Math.floor(ASTEROIDS * 1.5), true);
            createShockwave(midX, midY, true);
            createShockwave(midX, midY);
            for (let k = ships.length - 1; k >= 0; k--) {
                if (ships[k].hostPlanet === r1 || ships[k].hostPlanet === r2) ships.splice(k, 1);
            }
            r1._destroyed = true; r2._destroyed = true;
            return;
        }

        if (r1.isPlanet !== r2.isPlanet) {
            let planet = r1.isPlanet ? r1 : r2;
            let asteroid = r1.isPlanet ? r2 : r1;
            if (asteroid.r <= ASTEROID_MIN_SIZE * 1.2) {
                const angle = Math.atan2(asteroid.y - planet.y, asteroid.x - planet.x);
                const minDist = planet.r + asteroid.r + 5;
                asteroid.x = planet.x + Math.cos(angle) * minDist;
                asteroid.y = planet.y + Math.sin(angle) * minDist;
                asteroid.xv += Math.cos(angle) * 1.0; asteroid.yv += Math.sin(angle) * 1.0;
                return;
            }
            let totalMass = planet.mass + asteroid.mass;
            planet.xv = (planet.xv * planet.mass + asteroid.xv * asteroid.mass) / totalMass;
            planet.yv = (planet.yv * planet.mass + asteroid.yv * asteroid.mass) / totalMass;
            planet.x = (planet.x * planet.mass + asteroid.x * asteroid.mass) / totalMass;
            planet.y = (planet.y * planet.mass + asteroid.y * asteroid.mass) / totalMass;
            planet.targetR = Math.sqrt((Math.PI * planet.r * planet.r + Math.PI * asteroid.r * asteroid.r) / Math.PI);
            planet.mass = totalMass;
            asteroid._destroyed = true;
            return;
        }

        const isGiant1 = r1.r >= ASTEROID_MAX_SIZE;
        const isGiant2 = r2.r >= ASTEROID_MAX_SIZE;

        if (isGiant1 && isGiant2) {
            let totalMass = r1.mass + r2.mass;
            let newR = Math.sqrt(r1.r * r1.r + r2.r * r2.r) * 1.05;
            r1.x = (r1.x * r1.mass + r2.x * r2.mass) / totalMass;
            r1.y = (r1.y * r1.mass + r2.y * r2.mass) / totalMass;
            r1.xv = (r1.xv * r1.mass + r2.xv * r2.mass) / totalMass * 0.5;
            r1.yv = (r1.yv * r1.mass + r2.yv * r2.mass) / totalMass * 0.5;
            if (!r1.isPlanet) {
                const currentPlanets = roids.filter(r => r.isPlanet && !r._destroyed).length;
                if (currentPlanets < PLANETS_LIMIT) {
                    r1.r = Math.max(newR, PLANET_THRESHOLD + 10);
                    initializePlanetAttributes(r1);
                    r1.targetR = r1.r; r1.mass = totalMass * 0.05;
                    createExplosion(midVpX, midVpY, 60, '#00ffff', 10, 'spark');
                    addScreenMessage("PLANETARY GENESIS: TWO GIANTS HAVE COALESCED!", "#00ffff");
                    AudioEngine.playPlanetExplosion(midX, midY, r1.z);
                } else { r1.r = newR; r1.targetR = newR; }
            } else { r1.r = newR; r1.targetR = newR; r1.mass = totalMass * 0.05; }
            r2._destroyed = true;
        } else if (isGiant1 || isGiant2) {
            const giant = isGiant1 ? r1 : r2;
            const smaller = isGiant1 ? r2 : r1;
            if (smaller.r <= ASTEROID_MIN_SIZE * 1.2) {
                createExplosion(midVpX, midVpY, 15, '#fff', 2, 'debris');
                AudioEngine.playSoftThud(midX, midY, giant.z);
                smaller._destroyed = true;
            } else {
                [r1, r2].forEach((r) => {
                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_MIN_SIZE) {
                        const off = r.r * (ASTEROID_SPLIT_OFFSET / ASTEROID_MAX_SIZE);
                        const ang = Math.random() * Math.PI * 2;
                        let f1 = createAsteroid(r.x + Math.cos(ang) * off, r.y + Math.sin(ang) * off, newSize);
                        f1.xv = r.xv + Math.cos(ang) * ASTEROID_SPLIT_SPEED; f1.yv = r.yv + Math.sin(ang) * ASTEROID_SPLIT_SPEED; f1.blinkNum = 30;
                        roids.push(f1);
                        let f2 = createAsteroid(r.x - Math.cos(ang) * off, r.y - Math.sin(ang) * off, newSize);
                        f2.xv = r.xv - Math.cos(ang) * ASTEROID_SPLIT_SPEED; f2.yv = r.yv - Math.sin(ang) * ASTEROID_SPLIT_SPEED; f2.blinkNum = 30;
                        roids.push(f2);
                    }
                });
                createExplosion(midVpX, midVpY, 40, '#ffaa00', 3, 'spark');
                AudioEngine.playExplosion('small', midX, midY, r1.z);
                r1._destroyed = true; r2._destroyed = true;
            }
        } else {
            let totalMass = r1.mass + r2.mass;
            r1.x = (r1.x * r1.mass + r2.x * r2.mass) / totalMass;
            r1.y = (r1.y * r1.mass + r2.y * r2.mass) / totalMass;
            r1.xv = (r1.xv * r1.mass + r2.xv * r2.mass) / totalMass;
            r1.yv = (r1.yv * r1.mass + r2.yv * r2.mass) / totalMass;
            r1.targetR = Math.sqrt(r1.r * r1.r + r2.r * r2.r) * 1.05;
            AudioEngine.playSoftThud(midX, midY, r1.z);
            r2._destroyed = true;
        }
    }
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
    requestAnimationFrame(loop);

    // Reset global transformation to prevent accumulation of effects like screen shake
    canvasContext.resetTransform();

    // Sync HUD with game state
    updateHUD();

    // Removed 'if (!gameRunning) return' to keep the background world visible even when not playing.

    // killPlayerShip is handled in hitShip and collision logic.
    // Calling it here every frame causes a recursion bug during Game Over.

    // Decrement player reload timer
    if (playerReloadTime > 0) playerReloadTime--;

    // Handle Tier 12 transformation
    if (playerShip && playerShip.transformationTimer > 0) {
        playerShip.transformationTimer--;



        if (playerShip.transformationTimer % 60 === 0 && playerShip.transformationTimer > 0) {
            const secondsLeft = Math.ceil(playerShip.transformationTimer / 60);
            addScreenMessage(`METAMORPHOSIS: ${secondsLeft} SECONDS REMAINING...`, "#00ffff");
        }

        // COMPLETION
        if (playerShip.transformationTimer === 0) {
            addScreenMessage("THE GODSHIP ACTIVATED", "#00ffff");
            AudioEngine.playExplosion('large', worldOffsetX, worldOffsetY);
            // Flash effect
            canvasContext.fillStyle = "white";
            canvasContext.fillRect(0, 0, width, height);
        }
    }

    // Safety check against NaN/Infinity in velocity/world calculation
    if (isNaN(velocity.x) || isNaN(velocity.y) || !isFinite(velocity.x) || !isFinite(velocity.y)) {
        velocity = { x: 0, y: 0 };
    }
    if (isNaN(worldOffsetX) || isNaN(worldOffsetY) || !isFinite(worldOffsetX) || !isFinite(worldOffsetY)) {
        worldOffsetX = 0; worldOffsetY = 0;
    }

    if (stationSpawnTimer > 0) stationSpawnTimer--;
    if (stationSpawnTimer <= 0 && ships.length < 3) {
        spawnStation();
    }

    const isSafe = (obj) => !isNaN(obj.x) && !isNaN(obj.y) && isFinite(obj.x) && isFinite(obj.y);
    roids = roids.filter(isSafe);
    ships = ships.filter(isSafe);
    playerShipBullets = playerShipBullets.filter(isSafe);
    enemyShipBullets = enemyShipBullets.filter(isSafe);

    // --- Tier 12 Godship Warning System ---
    if (!playerShip.dead && playerShip.tier >= 12) {
        let warningNeeded = false;
        const lethalRange = Math.max(width, height) * 2;

        // Check Home Planet
        if (homePlanetId) {
            const home = roids.find(r => r.id === homePlanetId);
            if (home) {
                const d = Math.hypot(home.x - worldOffsetX, home.y - worldOffsetY);
                if (d < lethalRange + home.r) warningNeeded = true;
            }
        }

        // Check Allies
        if (!warningNeeded) {
            for (let s of ships) {
                if (s.isFriendly && s !== playerShip) {
                    const d = Math.hypot(s.x - worldOffsetX, s.y - worldOffsetY);
                    if (d < lethalRange + 100) {
                        warningNeeded = true;
                        break;
                    }
                }
            }
        }

        if (!victoryState && !playerShip.dead) {
            if (warningNeeded && Date.now() % 1000 < 500) {
                addScreenMessage("WARNING: LETHAL RADIUS OVERLAPS FRIENDS/HOME", "#ffaa00");
            }
        }
    }

    // Clear canvas
    canvasContext.save(); // PUSH 0: Global Frame State
    canvasContext.fillStyle = '#010103'; canvasContext.fillRect(0, 0, width, height);

    // Handle Tier 12 metamorphosis EPIC VISUALS
    if (playerShip && playerShip.transformationTimer > 0) {
        const progress = 1 - (playerShip.transformationTimer / 600);

        // Intensity increases as timer goes down
        if (playerShip.transformationTimer < 300) {
            // Screen shake intensifies
            const shake = 15 * progress;
            canvasContext.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        // Background strobe / flashes
        if (playerShip.transformationTimer < 180 && Math.random() < 0.15) {
            const jitterX = (Math.random() - 0.5) * 800;
            const jitterY = (Math.random() - 0.5) * 800;
            createExplosion(width / 2 + jitterX, height / 2 + jitterY, 30, '#0ff', 5, 'spark');
        }

        // Pulsing white overlay
        if (playerShip.transformationTimer < 120) {
            const flashAlpha = (Math.sin(Date.now() / 50) + 1) * 0.1 * progress;
            canvasContext.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            canvasContext.fillRect(0, 0, width, height);
        }
    }

    // --- Viewport Zoom Calculation ---
    // Priority: Victory/GameOver > Input Mode (Touch/Mouse) > Tier 12 Godship modifier
    const isGameOverOrVictory = (playerShip.dead && playerShip.lives <= 0) || victoryState;
    let targetScale;

    if (isGameOverOrVictory) {
        // Grand cinematic zoom-out to show the universe
        targetScale = Math.max(0.08, Math.min(width, height) / (WORLD_BOUNDS * 0.75));
    } else if (inputMode === 'touch') {
        targetScale = (playerShip.tier >= 12 ? SCALE_IN_TOUCH_MODE / 2 : SCALE_IN_TOUCH_MODE);
    } else {
        targetScale = (playerShip.tier >= 12 ? SCALE_IN_MOUSE_MODE / 2 : SCALE_IN_MOUSE_MODE);
    }

    // Use a slow, smooth factor for cinematic reveals, and a more responsive one for gameplay scaling
    const zoomInterpolationFactor = isGameOverOrVictory ? 0.001 : 0.02;
    viewScale += (targetScale - viewScale) * zoomInterpolationFactor;

    if (viewScale !== 1.0) {
        // Scale and translate to keep (width/2, height/2) at the center
        canvasContext.translate(width / 2 * (1 - viewScale), height / 2 * (1 - viewScale));
        canvasContext.scale(viewScale, viewScale);
    }

    // Win condition check: make this very robust. Directly check the roids array.
    const activeAsteroids = roids.filter(r => !r.isPlanet).length;
    if (gameRunning && !victoryState && activeAsteroids === 0) {
        winGame();
    }

    // HUD Victory Effects (Flashing)
    if (victoryState && Date.now() % 400 < 200) {
        if (asteroidCountDisplay) asteroidCountDisplay.style.color = '#fff';
        if (scoreDisplay) scoreDisplay.style.color = '#fff';
    } else if (victoryState) {
        if (asteroidCountDisplay) asteroidCountDisplay.style.color = '#0ff';
        if (scoreDisplay) scoreDisplay.style.color = '#0ff';
    }

    if (!playerShip.dead) {
        if (inputMode === 'mouse') { // Mouse/Pointer control: rotate towards cursor
            const dx = mouse.x - width / 2; const dy = mouse.y - height / 2;
            playerShip.a = Math.atan2(dy, dx);
        }
        else {
            // Keyboard/Touch swipe control: Arrow keys handle rotation
            if (keys.ArrowLeft) playerShip.a -= 0.1; if (keys.ArrowRight) playerShip.a += 0.1;
        }
        if (inputMode === 'touch') {
            playerShip.thrusting = isTouching && (Date.now() - touchStartTime >= MIN_DURATION_TAP_TO_MOVE);
        } else {
            playerShip.thrusting = keys.ArrowUp;
        }

        let deltaX = 0;
        let deltaY = 0;
        const strafeMultiplier = 0.7; // 70% power for strafing

        if (playerShip.thrusting) {
            deltaX += SHIP_THRUST * Math.cos(playerShip.a);
            deltaY += SHIP_THRUST * Math.sin(playerShip.a);
            if (Math.random() < 0.2) AudioEngine.playThrust(worldOffsetX, worldOffsetY);
        }

        if (keys.KeyA) { // Strafe Left
            const strafeAngle = playerShip.a - Math.PI / 2;
            deltaX += SHIP_THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY += SHIP_THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust(worldOffsetX, worldOffsetY);
        }
        if (keys.KeyD) { // Strafe Right
            const strafeAngle = playerShip.a + Math.PI / 2;
            deltaX += SHIP_THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY += SHIP_THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust(worldOffsetX, worldOffsetY);
        }

        velocity.x += deltaX;
        velocity.y += deltaY;

        // --- NEW: Orbital Capture for Player ---
        // If the player is near a planet and not actively thrusting, they are captured into orbit
        if (!playerShip.thrusting && !keys.ArrowDown && !keys.KeyA && !keys.KeyD && !playerShip.dead && !victoryState) {
            let nearestPlanet = null;
            let minDistSq = Infinity;
            for (const r of roids) {
                if (r.isPlanet && Math.abs(r.z) < 0.5) {
                    const dSq = (r.x - worldOffsetX) ** 2 + (r.y - worldOffsetY) ** 2;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        nearestPlanet = r;
                    }
                }
            }

            if (nearestPlanet) {
                const dist = Math.sqrt(minDistSq);
                const orbitRadius = nearestPlanet.r * 1.8 + playerShip.r;
                const gravityRange = nearestPlanet.r * 8.0;

                if (dist < gravityRange) {
                    const dx = nearestPlanet.x - worldOffsetX;
                    const dy = nearestPlanet.y - worldOffsetY;
                    const angleToPlanet = Math.atan2(dy, dx);
                    const tangentAngle = angleToPlanet + Math.PI / 2;

                    // Desired orbital speed + planet's own movement
                    const theoreticalOrbitSpeed = Math.sqrt((G_CONST * nearestPlanet.mass * 8.0) / Math.max(dist, 10));
                    const targetXV = Math.cos(tangentAngle) * theoreticalOrbitSpeed + (nearestPlanet.xv || 0);
                    const targetYV = Math.sin(tangentAngle) * theoreticalOrbitSpeed + (nearestPlanet.yv || 0);

                    // Blend velocity towards orbital target
                    velocity.x += (targetXV - velocity.x) * 0.05;
                    velocity.y += (targetYV - velocity.y) * 0.05;

                    // Distance correction: maintain orbit height
                    const distError = dist - orbitRadius;
                    const correction = distError * 0.005;
                    velocity.x += (dx / Math.max(dist, 1)) * correction;
                    velocity.y += (dy / Math.max(dist, 1)) * correction;
                }
            }
        }

        // Apply braking/friction
        if (keys.ArrowDown) { velocity.x *= 0.92; velocity.y *= 0.92; }
        else { velocity.x *= FRICTION; velocity.y *= FRICTION; }

        // Limit max speed
        const currentSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (currentSpeed > (playerShip.tier >= 12 ? SHIP_MAX_SPEED * 2 : SHIP_MAX_SPEED)) { const ratio = SHIP_MAX_SPEED / currentSpeed; velocity.x *= ratio; velocity.y *= ratio; }

        // 3. Update Player's World Position (worldOffsetX/Y)
        let nextWorldX = worldOffsetX + velocity.x;
        let nextWorldY = worldOffsetY + velocity.y;

        // 3. Update Player's World Position (worldOffsetX/Y)
        let shadow = [];
        const SHADOW_SIZE = 50; // Size of the inset shadow border

        // X Boundary Check
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
        if (worldOffsetX >= WORLD_BOUNDS - BOUNDARY_TOLERANCE) shadow.push(`${-SHADOW_SIZE}px 0 0 0 ${RED_GLOW} inset`);
        if (worldOffsetX <= -WORLD_BOUNDS + BOUNDARY_TOLERANCE) shadow.push(`${SHADOW_SIZE}px 0 0 0 ${RED_GLOW} inset`);
        if (worldOffsetY >= WORLD_BOUNDS - BOUNDARY_TOLERANCE) shadow.push(`0 ${-SHADOW_SIZE}px 0 0 ${RED_GLOW} inset`);
        if (worldOffsetY <= -WORLD_BOUNDS + BOUNDARY_TOLERANCE) shadow.push(`0 ${SHADOW_SIZE}px 0 0 ${RED_GLOW} inset`);

        if (shadow.length > 0) {
            canvas.style.boxShadow = shadow.join(', ');
        } else {
            canvas.style.boxShadow = 'none';
        }
    } else {
        // --- CINEMATIC CAMERA TRAVEL ---
        // Smoothly move the camera to the Home Planet when dead
        if (homePlanetId) {
            const home = roids.find(r => r.id === homePlanetId);
            if (home) {
                const travelSpeed = 0.02;
                worldOffsetX += (home.x - worldOffsetX) * travelSpeed;
                worldOffsetY += (home.y - worldOffsetY) * travelSpeed;
            }
        }
        // Clear boundary shadow when dead
        canvas.style.boxShadow = 'none';
    }

    // --- Shockwave Update (All in World Coords) ---
    shockwaves.forEach((sw, index) => {
        if (sw.isGodRing) {
            sw.r += 120; // Fast expansion
            sw.alpha -= 0.003;

            // TERMINATE at maxR to prevent global sweep
            if (sw.maxR && sw.r > sw.maxR) {
                shockwaves.splice(index, 1);
                return;
            }
        } else {
            sw.r += 15; sw.alpha -= 0.01;
        }

        if (sw.alpha <= 0) { shockwaves.splice(index, 1); return; }

        // Calculate Viewport Position for drawing
        const vpX = sw.x - worldOffsetX + width / 2;
        const vpY = sw.y - worldOffsetY + height / 2;

        if (sw.isGodRing) {
            // God Ring Visuals (Force Lightning & Sparkles)
            canvasContext.save();
            canvasContext.strokeStyle = `rgba(0, 255, 255, ${Math.min(1, sw.alpha)})`;
            canvasContext.lineWidth = 15;
            canvasContext.shadowBlur = 40;
            canvasContext.shadowColor = '#00FFFF';

            // Neon core ring
            canvasContext.beginPath();
            canvasContext.arc(vpX, vpY, sw.r, 0, Math.PI * 2);
            canvasContext.stroke();

            // Force Lightning Tendrils
            canvasContext.lineWidth = 3;
            canvasContext.strokeStyle = `rgba(200, 255, 255, ${Math.min(1, sw.alpha)})`;
            for (let i = 0; i < 60; i++) {
                const ang = Math.random() * Math.PI * 2;
                const jitter = (Math.random() - 0.5) * 150;
                const lx1 = vpX + Math.cos(ang) * (sw.r - 30);
                const ly1 = vpY + Math.sin(ang) * (sw.r - 30);
                const lx2 = vpX + Math.cos(ang) * (sw.r + 100) + jitter;
                const ly2 = vpY + Math.sin(ang) * (sw.r + 100) + jitter;

                canvasContext.beginPath();
                canvasContext.moveTo(lx1, ly1);
                // Multi-segment jittery lightning path
                let curX = lx1, curY = ly1;
                for (let j = 0; j < 3; j++) {
                    curX += (lx2 - lx1) / 3 + (Math.random() - 0.5) * 80;
                    curY += (ly2 - ly1) / 3 + (Math.random() - 0.5) * 80;
                    canvasContext.lineTo(curX, curY);
                }
                canvasContext.stroke();

                // Static Sparkles
                if (Math.random() < 0.4) {
                    canvasContext.fillStyle = '#FFFFFF';
                    canvasContext.fillRect(lx2 + (Math.random() - 0.5) * 40, ly2 + (Math.random() - 0.5) * 40, 5, 5);
                }
            }
            canvasContext.restore();
        } else {
            canvasContext.beginPath(); canvasContext.arc(vpX, vpY, sw.r, 0, Math.PI * 2);
            canvasContext.strokeStyle = `rgba(255, 200, 50, ${sw.alpha})`; canvasContext.lineWidth = 5; canvasContext.stroke();
        }

        // Apply force/destruction to asteroids, ships, and player (Force is World Units)
        const applyShockwaveEffect = (obj) => {
            let dx = obj.x - sw.x; let dy = obj.y - sw.y; // World Distance Vector
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Detection band
            const bandWidth = sw.isGodRing ? 600 : 30;

            if (Math.abs(dist - sw.r) < bandWidth) {
                if (sw.isGodRing) {
                    // Massive destruction: Indiscriminate except for the dealer
                    if (obj === playerShip) return;

                    if (obj.r !== undefined && !obj.type) { // Asteroid or Planet
                        obj.r = 0; // Marked for instant removal (no split)
                        obj.vaporized = true;

                        // AWARD SCORE for Godship destruction
                        if (obj.isPlanet) {
                            addScreenMessage("PLANET " + obj.name.toUpperCase() + " VAPORIZED", "#ff00ff");
                            createExplosion((obj.x - worldOffsetX + width / 2), (obj.y - worldOffsetY + height / 2), 200, '#00ffff', 10, 'spark');
                            increaseShipScore(playerShip, 1000); // 1000 for planet

                            // Check if player destroyed their own home
                            if (obj.id === homePlanetId) {
                                triggerHomePlanetLost('player');
                            }
                        } else {
                            increaseShipScore(playerShip, ASTEROID_DESTROYED_REWARD);
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
        roids.forEach(applyShockwaveEffect);
        ships.forEach(applyShockwaveEffect);

        // Player knockback (Regular shockwaves only)
        if (!sw.isGodRing) {
            let dx = worldOffsetX - sw.x; let dy = worldOffsetY - sw.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - sw.r) < 30) {
                let angle = Math.atan2(dy, dx);
                let force = sw.strength * (1 - dist / sw.maxR);
                if (force > 0) { velocity.x += Math.cos(angle) * force * 0.05; velocity.y += Math.sin(angle) * force * 0.05; }
            }
        }
    });

    // --- Ambient Fog Drawing ---
    canvasContext.globalCompositeOperation = 'screen';
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

        let g = canvasContext.createRadialGradient(f.x, f.y, f.r * 0.1, f.x, f.y, f.r);
        g.addColorStop(0, `hsla(${f.hue}, 80%, 40%, ${f.alpha})`);
        g.addColorStop(1, 'transparent');
        canvasContext.fillStyle = g; canvasContext.beginPath(); canvasContext.arc(f.x, f.y, f.r, 0, Math.PI * 2); canvasContext.fill();
    }
    canvasContext.globalCompositeOperation = 'source-over'; // Reset blend mode

    // --- Background Parallax Drawing ---
    const moveLayer = (list, factor) => list.forEach(item => {
        // Background items use VIEWPORT coordinates for display, so update with velocity
        item.x -= velocity.x * factor; item.y -= velocity.y * factor;
    });

    canvasContext.globalCompositeOperation = 'screen';
    moveLayer(backgroundLayers.nebulas, 0.05);
    backgroundLayers.nebulas.forEach(n => {
        let g = canvasContext.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 80%, 40%, ${n.alpha})`); g.addColorStop(1, 'transparent');
        canvasContext.fillStyle = g; canvasContext.beginPath(); canvasContext.arc(n.x, n.y, n.r, 0, Math.PI * 2); canvasContext.fill();
    });
    canvasContext.globalCompositeOperation = 'source-over';
    // Draw distant galaxies
    backgroundLayers.galaxies.forEach(g => {
        g.x -= velocity.x * 0.1; g.y -= velocity.y * 0.1;
        g.angle += 0.001;
        canvasContext.save(); canvasContext.translate(g.x, g.y); canvasContext.rotate(g.angle);
        canvasContext.shadowBlur = 30; canvasContext.shadowColor = `rgb(${g.color.r},${g.color.g},${g.color.b})`;
        canvasContext.fillStyle = 'white'; canvasContext.beginPath(); canvasContext.arc(0, 0, 8, 0, Math.PI * 2); canvasContext.fill();
        g.stars.forEach(s => { canvasContext.fillStyle = `rgba(${g.color.r},${g.color.g},${g.color.b}, ${s.alpha})`; canvasContext.beginPath(); canvasContext.arc(s.r * Math.cos(s.theta), s.r * Math.sin(s.theta), s.size, 0, Math.PI * 2); canvasContext.fill(); });
        canvasContext.restore(); canvasContext.shadowBlur = 0;
    });
    // Draw starfield parallax layers
    moveLayer(backgroundLayers.starsFar, 0.1); moveLayer(backgroundLayers.starsMid, 0.4); moveLayer(backgroundLayers.starsNear, 0.8);
    const drawStars = (list, c) => { canvasContext.fillStyle = c; list.forEach(s => canvasContext.fillRect(s.x, s.y, s.size, s.size)); };
    drawStars(backgroundLayers.starsFar, '#555'); drawStars(backgroundLayers.starsMid, '#888'); drawStars(backgroundLayers.starsNear, '#fff');

    updatePhysics(); // Run asteroid merging and gravity simulation (uses World Coords)

    canvasContext.shadowBlur = 10; canvasContext.lineCap = 'round'; canvasContext.lineJoin = 'round';

    // --- Enemy Update and MOVEMENT/AI (Separated from Drawing for Z-order) ---
    let shipsToDraw = [];
    for (let i = ships.length - 1; i >= 0; i--) {
        let ship = ships[i];

        if (ship.vaporized || ship.structureHP <= -1) {
            let vpX = (ship.x - worldOffsetX) + width / 2;
            let vpY = (ship.y - worldOffsetY) + height / 2;
            createExplosion(vpX, vpY, 60, '#00ffff', 5, 'spark');

            // If vaporized, it was the player's God Ring
            const killer = ship.vaporized ? playerShip : null;

            if (ship.type === 'station') onStationDestroyed(ship, killer);
            else onShipDestroyed(ship, killer);
            ships.splice(i, 1);
            AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
            continue;
        }

        const cullRange = WORLD_BOUNDS * 1.5;

        if (ship.blinkNum > 0) ship.blinkNum--;

        // Ships dancing in victory (Refined: Synchronized spiral)
        if (victoryState) {
            const time = Date.now() / 1000;
            const orbitR = 300 + Math.sin(time + i) * 100;
            const destX = worldOffsetX + Math.cos(time * 0.5 + i * 0.5) * orbitR;
            const destY = worldOffsetY + Math.sin(time * 0.5 + i * 0.5) * orbitR;

            ship.xv += (destX - ship.x) * 0.05;
            ship.yv += (destY - ship.y) * 0.05;
            ship.xv *= 0.95; ship.yv *= 0.95;
            ship.a += 0.1;
        }

        let isOrbiting = false;
        if (ship.type === 'station' && ship.hostPlanetId) {
            const host = roids.find(r => r.id === ship.hostPlanetId);
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
                for (let r of roids) {
                    if (r === host) continue; // Don't avoid host
                    if (r.z > 0.5) continue;

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
                    ship.structureHP = STATION_RESISTANCE;
                }
            }
        }

        // --- NEW: Role Assignment and Formation Joining ---
        if (ship.type === 'ship' && !ship.dead && !victoryState) {
            // 1. Assign Defender vs Stray role based on station capacity
            if (ship.homeStation) {
                const alliedShips = ships.filter(s => s.type === 'ship' && s.homeStation === ship.homeStation && !s.dead);
                // Sort by distance to home station to keep the closest ones as defenders
                alliedShips.sort((a, b) => {
                    const da = Math.hypot(a.x - ship.homeStation.x, a.y - ship.homeStation.y);
                    const db = Math.hypot(b.x - ship.homeStation.x, b.y - ship.homeStation.y);
                    return da - db;
                });

                const myIndex = alliedShips.indexOf(ship);
                if (myIndex < 7) {
                    ship.assignment = 'DEFENDER';
                    ship.leaderRef = null; // Defenders don't follow leaders away
                } else {
                    ship.assignment = 'STRAY';
                }
            }

            // 2. Friendly Strays can join Player's formation
            if (ship.isFriendly && ship.assignment === 'STRAY' && !ship.leaderRef && !playerShip.dead && playerShip.squadSlots) {
                const distToPlayer = Math.hypot(ship.x - worldOffsetX, ship.y - worldOffsetY);
                if (distToPlayer < 800) {
                    // Look for an empty slot in player's squad
                    const emptySlot = playerShip.squadSlots.find(slot => !slot.occupant || slot.occupant.dead);
                    if (emptySlot) {
                        ship.leaderRef = playerShip;
                        ship.aiState = 'FORMATION';
                        ship.squadId = playerShip.squadId;
                        emptySlot.occupant = ship;
                    }
                }
            }
        }

        // --- NEW: Orbital Capture for Defenders ---
        // Defenders follow planets specifically, Strays only orbit if they happen to be near one and idling
        let shouldOrbit = false;
        if (ship.aiState !== 'COMBAT' && !ship.dead && ship.type !== 'station' && !victoryState) {
            if (ship.assignment === 'DEFENDER') {
                shouldOrbit = true;
            } else if (ship.assignment === 'STRAY' && !ship.leaderRef) {
                const shipSpeed = Math.hypot(ship.xv, ship.yv);
                if (shipSpeed < 10.0) shouldOrbit = true;
            }
        }

        if (shouldOrbit) {
            let nearestPlanet = null;
            let minDistSq = Infinity;

            // Defenders prioritize their home planet, strays use nearest
            if (ship.assignment === 'DEFENDER' && ship.homeStation && ship.homeStation.hostPlanetId) {
                nearestPlanet = roids.find(r => r.id === ship.homeStation.hostPlanetId);
                if (nearestPlanet) minDistSq = (nearestPlanet.x - ship.x) ** 2 + (nearestPlanet.y - ship.y) ** 2;
            } else {
                for (const r of roids) {
                    if (r.isPlanet && Math.abs(r.z) < 0.5) {
                        const dSq = (r.x - ship.x) ** 2 + (r.y - ship.y) ** 2;
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            nearestPlanet = r;
                        }
                    }
                }
            }

            if (nearestPlanet) {
                const dist = Math.sqrt(minDistSq);
                const orbitRadius = nearestPlanet.r * 1.8 + ship.r;
                const gravityRange = nearestPlanet.r * 8.0;

                if (dist < gravityRange) {
                    const dx = nearestPlanet.x - ship.x;
                    const dy = nearestPlanet.y - ship.y;
                    const angleToPlanet = Math.atan2(dy, dx);
                    const tangentAngle = angleToPlanet + Math.PI / 2;

                    const theoreticalOrbitSpeed = Math.sqrt((G_CONST * nearestPlanet.mass * 8.0) / Math.max(dist, 10));
                    const targetXV = Math.cos(tangentAngle) * theoreticalOrbitSpeed + (nearestPlanet.xv || 0);
                    const targetYV = Math.sin(tangentAngle) * theoreticalOrbitSpeed + (nearestPlanet.yv || 0);

                    ship.xv += (targetXV - ship.xv) * 0.05;
                    ship.yv += (targetYV - ship.yv) * 0.05;

                }
            }
        }

        ship.x += ship.xv;
        ship.y += ship.yv;

        // Calculate Viewport Position for drawing (WITH PARALLAX)
        let depthScale = 1;
        if (ship.z > 0) {
            depthScale = 1 / (1 + ship.z);
        }

        const vpX = (ship.x - worldOffsetX) * depthScale + width / 2;
        const vpY = (ship.y - worldOffsetY) * depthScale + height / 2;

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
                const rVpX = r.x - worldOffsetX + width / 2;
                const rVpY = r.y - worldOffsetY + height / 2;
                createExplosion(rVpX, rVpY, 5, '#aa00ff', 1, 'debris');
                if (ship.structureHP <= 0) {
                    createExplosion(vpX, vpY, 30, '#ffaa00', 3, 'spark');
                    ship.dead = true;
                    ships.splice(i, 1);
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
                const currentShips = ships.filter(en => en.type === 'ship').length;
                if (currentShips <= SHIPS_LIMIT) {
                    spawnShipsSquad(ship);
                }
                ship.spawnTimer = SHIPS_SPAWN_TIME + Math.random() * SHIPS_SPAWN_TIME;
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
            const distToPlayer = Math.hypot(worldOffsetX - ship.x, worldOffsetY - ship.y);

            // 1. STATE TRANSITION
            if (!ship.isFriendly && distToPlayer < SHIP_SIGHT_RANGE && !playerShip.dead) { // Only ships auto-switch to combat by distance
                ship.aiState = 'COMBAT';
            } else if (distToPlayer > SHIP_SIGHT_RANGE * 1.5 && ship.aiState === 'COMBAT') {
                ship.aiState = 'FORMATION';
            }

            // 2. BEHAVIOR EXECUTION
            if (ship.aiState === 'FORMATION') {
                let isRetreating = false;
                if (ship.isFriendly && playerShip.tier >= 12 && homePlanetId) {
                    // WINGMAN RETREAT: Run to home when the player is a Godship to avoid the ring
                    const home = roids.find(r => r.id === homePlanetId);
                    if (home) {
                        const dx = home.x - ship.x;
                        const dy = home.y - ship.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist > 500) {
                            ship.xv += (dx / dist) * 1.5;
                            ship.yv += (dy / dist) * 1.5;
                            ship.a = Math.atan2(ship.yv, ship.xv);
                        }
                        ship.xv *= 0.95; ship.yv *= 0.95;
                        isRetreating = true;
                    }
                }
                proactiveCombatScanner(ship);

                if (!isRetreating && ship.isFriendly && !playerShip.dead && ship.leaderRef === playerShip) {
                    // FRIENDLY: Follow Player in V-Formation
                    const lx = worldOffsetX;
                    const ly = worldOffsetY;
                    const la = playerShip.a;


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
                    const isPlayerActive = Math.abs(velocity.x) > 0.5 || Math.abs(velocity.y) > 0.5 ||
                        keys.KeyA || keys.KeyD || keys.ArrowLeft || keys.ArrowRight ||
                        keys.ArrowUp || keys.KeyW || keys.Space;

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
                        for (let other of ships) {
                            if (other === ship || (other.isFriendly && other.type !== 'station')) continue;
                            let d = Math.hypot(ship.x - other.x, ship.y - other.y);
                            if (d < other.r + ship.r + safetyDist) {
                                obstacle = other; break;
                            }
                        }
                    }

                    if (obstacle && isPlayerActive) ship.isAvoiding = true;
                    else if (!isPlayerActive) ship.isAvoiding = false;

                    let formationForce = 0.05;
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
                        // Normal formation logic
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
                            if (slot.occupant && !slot.occupant.dead && (ships.includes(slot.occupant) || slot.occupant === playerShip)) {
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
                    }

                    // LEADER: Patrol or Defend
                    let targetX, targetY;
                    let targetFound = false;

                    // 1. DEFEND HOME STATION (Priority)
                    if (ship.homeStation && !ship.homeStation.dead) {
                        // Check for asteroids threatening the home station
                        let threateningAst = null;
                        let minAstDist = Infinity;

                        for (let r of roids) {
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
                                ship.patrolTarget.x = (Math.random() - 0.5) * 1.8 * WORLD_BOUNDS;
                                ship.patrolTarget.y = (Math.random() - 0.5) * 1.8 * WORLD_BOUNDS;
                            } else {
                                // Target check: find a rival station?
                                let rival = ships.find(s => s.type === 'station' && !s.isFriendly && s.fleetHue !== ship.fleetHue && !s.dead);
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
                } else if (!isRetreating && ship.role === 'wingman') {
                    if (ship.leaderRef && (ship.leaderRef.dead || (!ships.includes(ship.leaderRef) && ship.leaderRef !== playerShip))) {
                        ship.leaderRef = null;
                        ship.squadId = null;
                    }

                    if (ship.leaderRef) {
                        const lx = ship.leaderRef.x || worldOffsetX; // Fallback for player
                        const ly = ship.leaderRef.y || worldOffsetY;
                        const la = ship.leaderRef.a;

                        const fwdX = Math.cos(la);
                        const fwdY = Math.sin(la); // ships use Screen Down (Positive Screen Y)
                        const rightX = -fwdY;
                        const rightY = fwdX;

                        const targetX = lx + (rightX * ship.formationOffset.x) + (fwdX * ship.formationOffset.y);
                        const targetY = ly + (rightY * ship.formationOffset.x) + (fwdY * ship.formationOffset.y);

                        // Spring Force to Target
                        const dx = targetX - ship.x;
                        const dy = targetY - ship.y;
                        const distToTarget = Math.hypot(dx, dy);

                        const isInVisualSlot = distToTarget < 50;

                        let force = 0.05;
                        let damping = 0.90;

                        if (distToTarget < 200) {
                            const factor = distToTarget / 200;
                            force *= factor;
                            damping = 0.90 + (1 - factor) * 0.05;
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

                        // Separation from other ships (respect SHIPS_SEPARATION_DISTANCE)
                        let sepX = 0;
                        let sepY = 0;
                        let sepCount = 0;

                        for (let other of ships) {
                            if (other === ship || other.type !== 'ship') continue;
                            // Separate from same fleet OR friendly ships (everyone avoids bumping)
                            const isTeammate = (ship.isFriendly && other.isFriendly) || (ship.fleetHue === other.fleetHue);

                            if (isTeammate) {
                                let distToOther = Math.hypot(ship.x - other.x, ship.y - other.y);
                                const requiredDist = SHIPS_SEPARATION_DISTANCE + (ship.r + other.r) * 0.5; // Ensure padding
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
                                    const bullets = ship.isFriendly ? playerShipBullets : enemyShipBullets;
                                    fireEntityWeapon(ship, bullets, !ship.isFriendly);
                                    ship.reloadTime = 20 + Math.random() * 30;
                                }
                            }
                        } else {
                            // No danger - reset tracking
                            ship.asteroidDangerTimer = 0;
                            ship.lastDangerousAsteroid = null;

                            // Normal rotation logic: friendly ships only match rotation when following player
                            // Enemy ships and independent friendly ships rotate toward movement
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
                        const JOIN_RANGE = 300; // Must be very close ("near or over him")

                        // 1. CHECK PLAYER FIRST (Priority)
                        if (ship.isFriendly && !playerShip.dead && !playerShip.loneWolf) {
                            const distToPlayer = Math.hypot(worldOffsetX - ship.x, worldOffsetY - ship.y);
                            if (distToPlayer < JOIN_RANGE && playerShip.squadSlots) {
                                // Find open slot
                                const openSlot = playerShip.squadSlots.find(s => !s.occupant || s.occupant.dead || !ships.includes(s.occupant));
                                if (openSlot) {
                                    foundLeader = playerShip;
                                    foundSlot = openSlot;
                                }
                            }
                        }

                        // 2. CHECK NPC LEADERS (If not joined player)
                        if (!foundLeader) {
                            for (let other of ships) {
                                if (other.dead || other === ship || other.type !== 'ship') continue;
                                if (other.role === 'leader' && other.fleetHue === ship.fleetHue) {
                                    const dist = Math.hypot(other.x - ship.x, other.y - ship.y);
                                    if (dist < JOIN_RANGE && other.squadSlots) {
                                        const openSlot = other.squadSlots.find(s => !s.occupant || s.occupant.dead || !ships.includes(s.occupant));
                                        if (openSlot) {
                                            foundLeader = other;
                                            foundSlot = openSlot;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        if (foundLeader && foundSlot) {
                            ship.leaderRef = foundLeader;
                            ship.formationOffset = { x: foundSlot.x, y: foundSlot.y };
                            foundSlot.occupant = ship;
                        } else {
                            // BECOME FREE / INDEPENDENT
                            // Act like a mini-leader (patrol/hunt)
                            proactiveCombatScanner(ship);

                            // Wander behavior
                            if (!ship.patrolTarget) ship.patrolTarget = { x: ship.x, y: ship.y };
                            const distToPatrol = Math.hypot(ship.x - ship.patrolTarget.x, ship.y - ship.patrolTarget.y);
                            if (distToPatrol < 100) {
                                ship.patrolTarget.x = (Math.random() - 0.5) * 1.5 * WORLD_BOUNDS;
                                ship.patrolTarget.y = (Math.random() - 0.5) * 1.5 * WORLD_BOUNDS;
                            }
                            const tx = ship.patrolTarget.x;
                            const ty = ship.patrolTarget.y;
                            const ang = Math.atan2(ty - ship.y, tx - ship.x);

                            ship.xv += Math.cos(ang) * 0.5;
                            ship.yv += Math.sin(ang) * 0.5;

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

                // Enemy ships can target alive player IF CLOSE ENOUGH
                // This logic ensures they don't hunt across the map
                if (!ship.isFriendly && !playerShip.dead && distToPlayer < SHIP_SIGHT_RANGE * 1.5) {
                    target = { x: worldOffsetX, y: worldOffsetY, isRival: false, r: 0 };
                    minDist = distToPlayer;
                }

                // Search for rivals
                for (let other of ships) {
                    if (other === ship) continue;

                    let isRival = false;
                    if (ship.isFriendly) {
                        if (!other.isFriendly) isRival = true;
                    } else {
                        // Enemy ships target different fleets AND friendly ships
                        if (other.isFriendly || other.fleetHue !== ship.fleetHue) isRival = true;
                    }

                    if (isRival && (other.type === 'ship' || other.type === 'station')) {
                        let d = Math.hypot(other.x - ship.x, other.y - ship.y);
                        // Aggro if closer than player or player is dead/far or ship is patroling
                        // Modified: Enemy ships will attack everything they find on their path
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

                // Friendly squad ships point the same way as player
                if (ship.isFriendly && ship.role === 'wingman' && ship.leaderRef === playerShip) {
                    targetAngle = playerShip.a;
                }

                let angleDiff = targetAngle - ship.a;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

                // Smoother elegant rotation (Reduced from 0.1 to 0.04)
                ship.a += angleDiff * 0.04;

                // 1. Radial Force (Push/Pull) - Proportional smooth spring
                // Instead of hard ±0.8, we scale by distance diff
                const distError = d - SHIPS_COMBAT_ORBIT_DISTANCE;
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

                for (let other of ships) {
                    if (other === ship || other.type !== 'ship') continue;
                    // Simple distance check
                    let distToOther = Math.hypot(ship.x - other.x, ship.y - other.y);
                    if (distToOther < SHIPS_SEPARATION_DISTANCE) {
                        // Push away relative to other
                        let ang = Math.atan2(ship.y - other.y, ship.x - other.x);
                        // Force stronger the closer they are
                        let force = (SHIPS_SEPARATION_DISTANCE - distToOther) * 0.01;
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
                if (currentSpeed > (ship.tier >= 12 ? SHIP_MAX_SPEED * 2 : SHIP_MAX_SPEED)) {
                    let scale = (ship.tier >= 12 ? SHIP_MAX_SPEED * 2 : SHIP_MAX_SPEED) / currentSpeed;
                    ship.xv *= scale;
                    ship.yv *= scale;
                }

                // Shoot if lined up (slightly wider angle for smoother shooting feel)
                if (ship.reloadTime <= 0 && Math.abs(angleDiff) < 0.4) {
                    const bullets = ship.isFriendly ? playerShipBullets : enemyShipBullets;
                    fireEntityWeapon(ship, bullets, !ship.isFriendly);
                    ship.reloadTime = 30 + Math.random() * 50;
                }

                // Also shoot at nearby asteroids while in combat
                if (ship.reloadTime <= 0) {
                    for (let r of roids) {
                        if (r.z > 0.5 || r.isPlanet) continue;
                        const distToRoid = Math.hypot(r.x - ship.x, r.y - ship.y);
                        if (distToRoid < 1000) {
                            const roidAngle = Math.atan2(r.y - ship.y, r.x - ship.x);
                            let roidAngleDiff = roidAngle - ship.a;
                            while (roidAngleDiff > Math.PI) roidAngleDiff -= 2 * Math.PI;
                            while (roidAngleDiff <= -Math.PI) roidAngleDiff += 2 * Math.PI;
                            if (Math.abs(roidAngleDiff) < 0.5) {
                                const bullets = ship.isFriendly ? playerShipBullets : enemyShipBullets;
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
        if (!playerShip.dead && (!ship.z || ship.z < 0.5)) {
            let distToPlayer = Math.hypot(worldOffsetX - ship.x, worldOffsetY - ship.y);
            let collisionThreshold = (playerShip.effectiveR || playerShip.r) + ship.r + 10;
            if (distToPlayer < collisionThreshold) {
                if (ship.isFriendly) {
                    shipsToDraw.push(ship);
                    continue; // Skip collision response but keep alive
                }

                if (ship.structureHP > 0) {
                    ship.structureHP--;
                    ship.shieldHitTimer = 10;
                    createExplosion(vpX, vpY, 20, '#ff0055', 2, 'spark');
                    if (playerShip.tier < 12) {
                        hitPlayerShip(1);
                    }
                    AudioEngine.playSoftThud(ship.x, ship.y, ship.z);
                    let ang = Math.atan2(ship.y - worldOffsetY, ship.x - worldOffsetX);
                    ship.x += Math.cos(ang) * 60; ship.y += Math.sin(ang) * 60;
                } else {
                    ships.splice(i, 1); i--;
                    AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                    continue; // Ship is gone, don't draw
                }

                if (ship.structureHP <= 0) {
                    let debrisColor = ship.type === 'station' ? `hsl(${ship.fleetHue}, 100%, 50%)` : `hsl(${ship.fleetHue}, 100%, 40%)`;
                    createExplosion(vpX, vpY, 40, '#ffaa00', 3, 'spark'); createExplosion(vpX, vpY, 20, debrisColor, 4, 'debris');
                    if (ship.type === 'station') { onStationDestroyed(ship, playerShip); }
                    else { onShipDestroyed(ship, playerShip); }
                    ships.splice(i, 1); i--; AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                    continue; // Ship is gone, don't draw
                }
            }
        }

        shipsToDraw.push(ship);

    }
    // --- End Enemy Update/AI ---

    canvasContext.shadowColor = '#ffffff'; canvasContext.strokeStyle = 'white'; canvasContext.lineWidth = 1.5;

    // Sort asteroids from Near to Far (Small Z to Large Z) with safety
    roids.sort((a, b) => {
        const za = (isNaN(a.z) || !isFinite(a.z)) ? 0 : a.z;
        const zb = (isNaN(b.z) || !isFinite(b.z)) ? 0 : b.z;
        return za - zb;
    });

    // --- Asteroid/Planet DRAWING (Order 1: Behind ships) ---
    for (let i = roids.length - 1; i >= 0; i--) {
        let r = roids[i];

        // GOD RING VAPORIZATION
        if (r.r <= 0 || r.vaporized) {
            let vpX = (r.x - worldOffsetX) + width / 2;
            let vpY = (r.y - worldOffsetY) + height / 2;
            createExplosion(vpX, vpY, r.isPlanet ? 200 : 40, '#00ffff', r.isPlanet ? 15 : 4, 'spark');
            roids.splice(i, 1);
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

            vpX = (r.x - worldOffsetX) * depthScale + width / 2;
            vpY = (r.y - worldOffsetY) * depthScale + height / 2;
        } else {
            // Standard asteroid: 1:1 scale
            vpX = r.x - worldOffsetX + width / 2;
            vpY = r.y - worldOffsetY + height / 2;
        }

        // Apply transformations for depth
        canvasContext.save();
        canvasContext.translate(vpX, vpY); // Translate to Viewport Position
        canvasContext.scale(depthScale, depthScale);

        // Apply calculated depth alpha
        canvasContext.globalAlpha = depthAlpha;

        // Draw asteroid blinking if newly created
        if (r.blinkNum % 2 !== 0) { canvasContext.globalAlpha *= 0.3; }


        if (r.isPlanet) {

            // === DRAW PLANET RINGS (BACK HALF) ===
            if (r.rings) {
                drawRings(canvasContext, r.rings, r.r, depthScale);
            }

            // Draw planet texture and name
            canvasContext.shadowBlur = 30; canvasContext.shadowColor = r.textureData.atmosphereColor;
            drawPlanetTexture(canvasContext, 0, 0, r.r, r.textureData); // Draw relative to translated origin

            // === DRAW PLANET RINGS (FRONT HALF) ===
            if (r.rings) {
                canvasContext.save();
                canvasContext.rotate(r.rings.tilt);
                r.rings.bands.forEach(band => {
                    const bandRadius = r.r * band.rRatio;
                    const bandWidth = r.r * band.wRatio;
                    const outerRadius = bandRadius * depthScale;

                    canvasContext.lineWidth = bandWidth * depthScale;
                    canvasContext.strokeStyle = band.color;
                    canvasContext.globalAlpha = band.alpha * depthAlpha;
                    canvasContext.shadowBlur = 0;

                    canvasContext.beginPath();
                    canvasContext.ellipse(0, 0, outerRadius, outerRadius * 0.15, 0, Math.PI, Math.PI * 2, false);
                    canvasContext.stroke();
                });
                canvasContext.restore();
            }

            // Draw Name
            canvasContext.globalAlpha = depthAlpha;
            canvasContext.fillStyle = 'white';
            canvasContext.font = `${14 / depthScale}px Courier New`;
            canvasContext.textAlign = 'center';
            canvasContext.fillText(r.name, 0, r.r + (30 / depthScale));

        } else {
            // Draw standard asteroid shape
            if (r.isHot) {
                canvasContext.shadowBlur = 20;
                canvasContext.shadowColor = '#ff6600';
                canvasContext.strokeStyle = '#ffcc00';
            } else {
                canvasContext.shadowBlur = 10;
                canvasContext.shadowColor = 'white';
                canvasContext.strokeStyle = 'white';
            }
            canvasContext.fillStyle = r.color; // Dark gray fill
            canvasContext.beginPath();
            for (let j = 0; j < r.vert; j++) {
                const px = r.r * r.offs[j] * Math.cos(r.a + j * Math.PI * 2 / r.vert);
                const py = r.r * r.offs[j] * Math.sin(r.a + j * Math.PI * 2 / r.vert);
                if (j === 0) canvasContext.moveTo(px, py); else canvasContext.lineTo(px, py);
            }
            canvasContext.closePath();
            canvasContext.fill();
            canvasContext.stroke();

            // Draw lava veins if hot
            if (r.isHot) {
                canvasContext.globalAlpha = 0.6;
                canvasContext.strokeStyle = '#ff3300';
                canvasContext.lineWidth = 2;
                canvasContext.beginPath();
                for (let j = 0; j < r.vert; j += 2) {
                    const px = r.r * 0.5 * r.offs[j] * Math.cos(r.a + j * Math.PI * 2 / r.vert);
                    const py = r.r * 0.5 * r.offs[j] * Math.sin(r.a + j * Math.PI * 2 / r.vert);
                    if (j === 0) canvasContext.moveTo(px, py); else canvasContext.lineTo(px, py);
                }
                canvasContext.stroke();
                canvasContext.globalAlpha = 1;
            }
        }
        canvasContext.restore(); // Restore context

        // Check collision with player (World Coords)
        if (r.z < 0.5 && !playerShip.dead) {
            let distToPlayer = Math.hypot(r.x - worldOffsetX, r.y - worldOffsetY);
            if (distToPlayer < (playerShip.effectiveR || playerShip.r) + r.r * depthScale) {

                const isNearPlanetCollision = r.isPlanet && r.z < 0.5;

                // Go through planets.
                if (r.isPlanet) {
                    continue;
                }

                // ASTEROID COLLISION: Player takes 1 hit, asteroid is destroyed.
                if (r.blinkNum === 0) {
                    if (playerShip.tier < 12) {
                        hitPlayerShip(1, isNearPlanetCollision);
                    }
                    AudioEngine.playSoftThud(r.x, r.y, r.z);

                    // Create explosions
                    createExplosion(vpX, vpY, 15, '#0ff', 2, 'spark');
                    createExplosion(vpX, vpY, 8, '#fff', 1, 'debris');

                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_MIN_SIZE) {
                        const dynamicOffset = r.r * (ASTEROID_SPLIT_OFFSET / ASTEROID_MAX_SIZE);
                        // West asteroid
                        let westAst = createAsteroid(r.x - dynamicOffset, r.y, newSize);
                        westAst.xv = r.xv - ASTEROID_SPLIT_SPEED;
                        westAst.yv = r.yv;
                        westAst.blinkNum = 30;
                        roids.push(westAst);

                        // East asteroid
                        let eastAst = createAsteroid(r.x + dynamicOffset, r.y, newSize);
                        eastAst.xv = r.xv + ASTEROID_SPLIT_SPEED;
                        eastAst.yv = r.yv;
                        eastAst.blinkNum = 30;
                        roids.push(eastAst);
                        updateAsteroidCounter();
                    }

                    if (playerShip.tier >= 12) increaseShipScore(playerShip, ASTEROID_DESTROYED_REWARD);
                    roids.splice(i, 1);
                    updateAsteroidCounter();

                    let ang = Math.atan2(r.y - worldOffsetY, r.x - worldOffsetX); // World Angle
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

        const vpX = (shipToDraw.x - worldOffsetX) * depthScale + width / 2;
        const vpY = (shipToDraw.y - worldOffsetY) * depthScale + height / 2;

        // Drawing enemy
        canvasContext.shadowBlur = 15;

        // Proximity fading for friends
        let alpha = depthAlpha;
        if (shipToDraw.isFriendly) {
            const distToPlayer = Math.hypot(worldOffsetX - shipToDraw.x, worldOffsetY - shipToDraw.y);
            const fadeStart = 300;
            const fadeEnd = 50;
            if (distToPlayer < fadeStart) {
                const ratio = Math.max(0, (distToPlayer - fadeEnd) / (fadeStart - fadeEnd));
                alpha *= 0.4 + 0.6 * ratio; // Fades to 40% alpha (more visible)
            }
        }

        // If blinking, reduce opacity (for invulnerability feedback)
        if (shipToDraw.blinkNum % 2 !== 0) { canvasContext.globalAlpha = 0.5; }
        else { canvasContext.globalAlpha = alpha; } // Apply fading/depth alpha

        canvasContext.save();
        canvasContext.translate(vpX, vpY); // Translate to Viewport Position
        canvasContext.scale(depthScale, depthScale); // Apply depth scaling
        canvasContext.rotate(shipToDraw.a); // Standard rotation (CW positive)

        if (shipToDraw.type === 'ship') {

            // Individual evolution: ships match their OWN score visuals
            const tier = Math.floor((shipToDraw.score || 0) / SHIP_EVOLUTION_SCORE_STEP);
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

                canvasContext.shadowBlur = 20; canvasContext.shadowColor = THRUST_COLOR;
                canvasContext.beginPath();
                canvasContext.moveTo(r * 1.6 * norm, 0);
                canvasContext.lineTo(r * 0.5 * norm, r * 1.5 * norm); canvasContext.lineTo(-r * 1.2 * norm, r * 0.8 * norm);
                canvasContext.lineTo(-r * 1.8 * norm, r * 0.4 * norm); canvasContext.lineTo(-r * 1.8 * norm, -r * 0.4 * norm);
                canvasContext.lineTo(-r * 1.2 * norm, -r * 0.8 * norm); canvasContext.lineTo(r * 0.5 * norm, -r * 1.5 * norm);
                canvasContext.closePath();
                canvasContext.fillStyle = HULL_COLOR_D; canvasContext.fill();
                canvasContext.lineWidth = 2; canvasContext.strokeStyle = HULL_BORDER_D; canvasContext.stroke();

                // Details
                canvasContext.shadowBlur = 0; canvasContext.fillStyle = DETAIL_GRAY_D;
                canvasContext.beginPath(); canvasContext.moveTo(r * 1.6 * norm, 0); canvasContext.lineTo(r * 1.4 * norm, r * 0.1 * norm); canvasContext.lineTo(r * 1.4 * norm, -r * 0.1 * norm); canvasContext.closePath(); canvasContext.fill();
                canvasContext.fillStyle = DETAIL_GRAY_D;
                canvasContext.fillRect(r * 0.2 * norm, r * 0.5 * norm, r * 0.3 * norm, r * 0.2 * norm); canvasContext.fillRect(r * 0.2 * norm, -r * 0.7 * norm, r * 0.3 * norm, r * 0.2 * norm);

                // Accent Engine/Core
                canvasContext.fillStyle = ACCENT_COLOR; canvasContext.beginPath(); canvasContext.arc(-r * 0.5 * norm, 0, r * 0.2 * norm, 0, Math.PI * 2); canvasContext.fill();

                // Thrust
                canvasContext.shadowBlur = 30; canvasContext.shadowColor = THRUST_COLOR;
                const EXHAUST_H = r * 0.7 * norm; const EXHAUST_X = -r * 1.8 * norm;
                canvasContext.fillStyle = HULL_BORDER_D; canvasContext.fillRect(EXHAUST_X, -EXHAUST_H / 2, 5, EXHAUST_H);

                // Always thrusting slightly for visual effect
                canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 60%, ${0.5 + Math.random() * 0.5})`;
                canvasContext.beginPath(); canvasContext.moveTo(EXHAUST_X + 5, -EXHAUST_H / 2); canvasContext.lineTo(EXHAUST_X + 5, EXHAUST_H / 2);
                canvasContext.lineTo(EXHAUST_X - 25 * norm * (0.8 + Math.random() * 0.4), 0); canvasContext.closePath(); canvasContext.fill();
                canvasContext.shadowBlur = 0;


            } else {
                // MODERN TRIANGULAR SHIP DESIGN (Tiers 0-7)
                // Sleek, sharp geometry with glowing edges inspired by tactical diagram

                // Base triangle size scales with tier
                const baseSize = r * (1 + tier * 0.08);

                // === MAIN HULL (Sharp Triangle) ===
                canvasContext.shadowBlur = 25;
                canvasContext.shadowColor = DETAIL_COLOR;

                // Main triangle body
                canvasContext.beginPath();
                canvasContext.moveTo(baseSize * 1.2, 0);  // Nose (front)
                canvasContext.lineTo(-baseSize * 0.6, baseSize * 0.8);  // Bottom left
                canvasContext.lineTo(-baseSize * 0.6, -baseSize * 0.8); // Top left
                canvasContext.closePath();

                // Gradient fill from bright center to darker edges
                let hullGrad = canvasContext.createLinearGradient(baseSize * 0.6, 0, -baseSize * 0.6, 0);
                hullGrad.addColorStop(0, DETAIL_COLOR);
                hullGrad.addColorStop(0.5, HULL_COLOR);
                hullGrad.addColorStop(1, `hsl(${shipToDraw.fleetHue}, 40%, 15%)`);

                canvasContext.fillStyle = hullGrad;
                canvasContext.fill();

                // Bright glowing outline
                canvasContext.lineWidth = 3;
                canvasContext.strokeStyle = DETAIL_COLOR;
                canvasContext.stroke();

                // === INTERNAL DETAIL LINES ===
                canvasContext.shadowBlur = 10;
                canvasContext.lineWidth = 1.5;
                canvasContext.strokeStyle = `hsl(${shipToDraw.fleetHue}, 100%, 70%)`;

                // Center line
                canvasContext.beginPath();
                canvasContext.moveTo(baseSize * 0.8, 0);
                canvasContext.lineTo(-baseSize * 0.4, 0);
                canvasContext.stroke();

                // Diagonal detail lines
                canvasContext.beginPath();
                canvasContext.moveTo(baseSize * 0.4, 0);
                canvasContext.lineTo(-baseSize * 0.2, baseSize * 0.4);
                canvasContext.moveTo(baseSize * 0.4, 0);
                canvasContext.lineTo(-baseSize * 0.2, -baseSize * 0.4);
                canvasContext.stroke();

                // === WING ACCENTS ===
                canvasContext.shadowBlur = 15;
                canvasContext.fillStyle = `hsl(${shipToDraw.fleetHue}, 80%, 40%)`;

                // Top wing accent
                canvasContext.beginPath();
                canvasContext.moveTo(baseSize * 0.2, -baseSize * 0.3);
                canvasContext.lineTo(-baseSize * 0.3, -baseSize * 0.6);
                canvasContext.lineTo(-baseSize * 0.4, -baseSize * 0.5);
                canvasContext.lineTo(baseSize * 0.1, -baseSize * 0.25);
                canvasContext.closePath();
                canvasContext.fill();

                // Bottom wing accent
                canvasContext.beginPath();
                canvasContext.moveTo(baseSize * 0.2, baseSize * 0.3);
                canvasContext.lineTo(-baseSize * 0.3, baseSize * 0.6);
                canvasContext.lineTo(-baseSize * 0.4, baseSize * 0.5);
                canvasContext.lineTo(baseSize * 0.1, baseSize * 0.25);
                canvasContext.closePath();
                canvasContext.fill();

                // === COCKPIT (Glowing center) ===
                canvasContext.shadowBlur = 20;
                canvasContext.shadowColor = COCKPIT_GRAD_1;

                let cockpitGrad = canvasContext.createRadialGradient(baseSize * 0.5, 0, 0, baseSize * 0.5, 0, baseSize * 0.15);
                cockpitGrad.addColorStop(0, COCKPIT_GRAD_1);
                cockpitGrad.addColorStop(0.7, COCKPIT_GRAD_2);
                cockpitGrad.addColorStop(1, HULL_COLOR);

                canvasContext.fillStyle = cockpitGrad;
                canvasContext.beginPath();
                canvasContext.arc(baseSize * 0.5, 0, baseSize * 0.15, 0, Math.PI * 2);
                canvasContext.fill();

                // Cockpit bright rim
                canvasContext.strokeStyle = COCKPIT_GRAD_1;
                canvasContext.lineWidth = 2;
                canvasContext.stroke();

                // === ENGINE PORTS ===
                canvasContext.shadowBlur = 15;
                canvasContext.shadowColor = ACCENT_COLOR;

                // Top engine
                canvasContext.fillStyle = ACCENT_COLOR;
                canvasContext.beginPath();
                canvasContext.arc(-baseSize * 0.45, -baseSize * 0.35, baseSize * 0.08, 0, Math.PI * 2);
                canvasContext.fill();

                // Bottom engine
                canvasContext.beginPath();
                canvasContext.arc(-baseSize * 0.45, baseSize * 0.35, baseSize * 0.08, 0, Math.PI * 2);
                canvasContext.fill();

                // === ENGINE THRUST (Animated) ===
                canvasContext.shadowBlur = 30;
                canvasContext.shadowColor = THRUST_COLOR;

                const thrustLength = 20 + Math.random() * 15;
                const thrustFlicker = 0.6 + Math.random() * 0.4;

                // Top thrust
                canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 70%, ${thrustFlicker})`;
                canvasContext.beginPath();
                canvasContext.moveTo(-baseSize * 0.5, -baseSize * 0.35);
                canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, -baseSize * 0.4);
                canvasContext.lineTo(-baseSize * 0.5 - thrustLength, -baseSize * 0.35);
                canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, -baseSize * 0.3);
                canvasContext.closePath();
                canvasContext.fill();

                // Bottom thrust
                canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 70%, ${thrustFlicker})`;
                canvasContext.beginPath();
                canvasContext.moveTo(-baseSize * 0.5, baseSize * 0.35);
                canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, baseSize * 0.4);
                canvasContext.lineTo(-baseSize * 0.5 - thrustLength, baseSize * 0.35);
                canvasContext.lineTo(-baseSize * 0.5 - thrustLength * 0.8, baseSize * 0.3);
                canvasContext.closePath();
                canvasContext.fill();

                // === TIER INDICATORS (Small dots along the hull) ===
                if (tier > 0) {
                    canvasContext.shadowBlur = 8;
                    canvasContext.fillStyle = `hsl(${shipToDraw.fleetHue}, 100%, 80%)`;

                    for (let t = 0; t < Math.min(tier, 7); t++) {
                        const dotX = baseSize * 0.3 - (t * baseSize * 0.12);
                        const dotY = (t % 2 === 0) ? baseSize * 0.15 : -baseSize * 0.15;

                        canvasContext.beginPath();
                        canvasContext.arc(dotX, dotY, baseSize * 0.04, 0, Math.PI * 2);
                        canvasContext.fill();
                    }
                }

                canvasContext.shadowBlur = 0;
            }
            // DRAW HEART FOR FRIENDS
            if (shipToDraw.isFriendly) {
                drawHeart(canvasContext, 0, -5, 8);
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
            canvasContext.shadowBlur = 25;
            canvasContext.shadowColor = haloColor;

            // Draw hexagon
            canvasContext.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI / 3) + shipToDraw.a;
                const x = Math.cos(angle) * stationR * 1.1;
                const y = Math.sin(angle) * stationR * 1.1;
                if (i === 0) canvasContext.moveTo(x, y);
                else canvasContext.lineTo(x, y);
            }
            canvasContext.closePath();

            // Hexagon fill with gradient
            let hexGrad = canvasContext.createRadialGradient(0, 0, 0, 0, 0, stationR * 1.1);
            hexGrad.addColorStop(0, `hsl(${shipToDraw.fleetHue}, 60%, 40%)`);
            hexGrad.addColorStop(0.7, `hsl(${shipToDraw.fleetHue}, 70%, 25%)`);
            hexGrad.addColorStop(1, `hsl(${shipToDraw.fleetHue}, 50%, 15%)`);

            canvasContext.fillStyle = hexGrad;
            canvasContext.fill();

            // Glowing hexagon outline
            canvasContext.lineWidth = 4;
            canvasContext.strokeStyle = haloColor;
            canvasContext.stroke();

            // === ROTATING ENERGY RINGS ===
            canvasContext.shadowBlur = 20;

            // Outer ring
            canvasContext.lineWidth = 3;
            canvasContext.strokeStyle = accentColor;
            canvasContext.beginPath();
            canvasContext.arc(0, 0, stationR * 0.9, 0, Math.PI * 2);
            canvasContext.stroke();

            // Middle ring (slightly rotated)
            canvasContext.lineWidth = 2;
            canvasContext.strokeStyle = bodyColor;
            canvasContext.beginPath();
            canvasContext.arc(0, 0, stationR * 0.7, 0, Math.PI * 2);
            canvasContext.stroke();

            // === CONNECTING SPOKES (6 spokes to match hexagon) ===
            canvasContext.shadowBlur = 15;
            canvasContext.lineWidth = 2;
            canvasContext.strokeStyle = accentColor;

            for (let k = 0; k < 6; k++) {
                const angle = (k * Math.PI / 3) + shipToDraw.a;
                const rInner = stationR * 0.4;
                const rOuter = stationR * 0.95;

                canvasContext.beginPath();
                canvasContext.moveTo(Math.cos(angle) * rInner, Math.sin(angle) * rInner);
                canvasContext.lineTo(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter);
                canvasContext.stroke();

                // Small nodes at spoke ends
                canvasContext.fillStyle = haloColor;
                canvasContext.beginPath();
                canvasContext.arc(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter, stationR * 0.06, 0, Math.PI * 2);
                canvasContext.fill();
            }

            // === PULSING CORE ===
            canvasContext.shadowBlur = 30;
            canvasContext.shadowColor = coreColor;

            // Pulsing effect
            const pulsePhase = (Date.now() % 2000) / 2000; // 0 to 1 over 2 seconds
            const pulseSize = 0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.05;

            // Core gradient
            let coreGrad = canvasContext.createRadialGradient(0, 0, 0, 0, 0, stationR * pulseSize);
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.3, coreColor);
            coreGrad.addColorStop(1, bodyColor);

            canvasContext.fillStyle = coreGrad;
            canvasContext.beginPath();
            canvasContext.arc(0, 0, stationR * pulseSize, 0, Math.PI * 2);
            canvasContext.fill();

            // Core bright outline
            canvasContext.strokeStyle = '#ffffff';
            canvasContext.lineWidth = 2;
            canvasContext.stroke();

            // === ENERGY PARTICLES (Small glowing dots around the station) ===
            canvasContext.shadowBlur = 10;
            for (let p = 0; p < 8; p++) {
                const particleAngle = (p * Math.PI / 4) + (Date.now() / 1000) + shipToDraw.a;
                const particleR = stationR * (0.8 + Math.sin((Date.now() / 500) + p) * 0.1);
                const px = Math.cos(particleAngle) * particleR;
                const py = Math.sin(particleAngle) * particleR;

                canvasContext.fillStyle = `hsla(${shipToDraw.fleetHue}, 100%, 80%, ${0.6 + Math.random() * 0.4})`;
                canvasContext.beginPath();
                canvasContext.arc(px, py, stationR * 0.03, 0, Math.PI * 2);
                canvasContext.fill();
            }

            canvasContext.shadowBlur = 0;

            // DRAW HEART FOR FRIENDLY STATIONS
            if (shipToDraw.isFriendly) {
                drawHeart(canvasContext, 0, -shipToDraw.r * 0.1, shipToDraw.r * 0.2);
            }
        }

        canvasContext.restore();
        canvasContext.globalAlpha = 1;

        let currentHP = shipToDraw.structureHP;
        let maxHP = shipToDraw.type === 'station' ? STATION_RESISTANCE : SHIP_RESISTANCE;
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
            if (currentHP >= STATION_RESISTANCE * 2 / 3) { // Phase 1: Green/Blue - High Shield
                r = 0; g = 255; b = 255; // Cian
                shieldOpacity = 1.0;
            } else if (currentHP >= STATION_RESISTANCE / 2) { // Phase 2: Yellow/Orange - Mid Shield/Warning
                r = 255; g = 165; b = 0;
                shieldOpacity = 0.7;
            } else { // Phase 3: Red - Critical Structure
                r = 255; g = 0; b = 0;
                shieldOpacity = 0.5;
            }
        }

        canvasContext.lineWidth = 2;
        if (shieldOpacity > 0) {
            if (shipToDraw.shieldHitTimer > 0) {
                canvasContext.shadowColor = '#fff';
                canvasContext.strokeStyle = `rgba(255,255,255,${shieldOpacity})`;
                shipToDraw.shieldHitTimer--;
            }
            else {
                canvasContext.shadowColor = `rgb(${r},${g},${b})`;
                canvasContext.strokeStyle = `rgba(${r},${g},${b},${shieldOpacity})`;
            }
            canvasContext.beginPath(); canvasContext.arc(vpX, vpY, shipToDraw.r + 10, 0, Math.PI * 2); canvasContext.stroke();
        }
    });

    canvasContext.shadowBlur = 10; canvasContext.lineCap = 'round'; canvasContext.lineJoin = 'round'; canvasContext.globalAlpha = 1;

    if (!playerShip.dead) {
        canvasContext.save(); // PUSH 1: Isolate entire player ship rendering block

        // Regeneration is now solely for visual/Tesla effect, as structureHP manages hits
        if (playerShip.shield < playerShip.maxShield) playerShip.shield += 0.05;

        let isTesla = playerShip.maxShield > SHIP_BASE_MAX_SHIELD;

        const tier = playerShip.tier;

        const BASE_SHIP_RADIUS = SHIP_SIZE / 2;
        const MAX_TIER_RADIUS = BASE_SHIP_RADIUS + (7 * 2); // Tier 7 size
        if (tier >= 8) playerShip.effectiveR = MAX_TIER_RADIUS;
        else playerShip.effectiveR = BASE_SHIP_RADIUS + (tier * 2);

        const centerX = width / 2; const centerY = height / 2;
        const r = playerShip.effectiveR;

        if (playerShip.blinkNum % 2 === 0) { // Invulnerability blink effect

            let shieldAlpha = 0;
            let strokeWidth = 1;
            let shieldRadius = playerShip.effectiveR + 10;

            const EPIC_SHIELD_FACTOR = 1.7;

            if (tier >= 8) {
                shieldRadius = playerShip.effectiveR * EPIC_SHIELD_FACTOR;
            }

            if (playerShip.structureHP === SHIP_RESISTANCE) {
                shieldAlpha = isTesla ? (0.5 + Math.random() * 0.2) : 0.5;
                strokeWidth = isTesla ? 1.5 : 1;
            }

            if (shieldAlpha > 0) {

                canvasContext.lineWidth = strokeWidth;

                let baseColor, shadowColor;

                if (playerShip.structureHP <= SHIP_RESISTANCE && tier < 8) {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                } else if (playerShip.structureHP >= 7) {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                } else if (playerShip.structureHP >= 4) {
                    baseColor = '#ffaa00'; shadowColor = 'rgba(255, 170, 0, 0.7)';
                } else {
                    baseColor = '#0ff'; shadowColor = 'rgba(0, 255, 255, 0.7)';
                }

                canvasContext.shadowColor = shadowColor;
                canvasContext.strokeStyle = `rgba(0, 255, 255, ${shieldAlpha})`;

                canvasContext.beginPath();
                canvasContext.arc(centerX, centerY, shieldRadius, 0, Math.PI * 2);
                canvasContext.stroke();
            }

            canvasContext.save();
            canvasContext.translate(centerX, centerY);
            canvasContext.rotate(playerShip.a);

            canvasContext.globalAlpha = 1;

            // --- Drawing logic for Ship Tiers ---
            const PLAYER_HUE = SHIP_FRIENDLY_BLUE_HUE; // 210 (cyan/blue)
            if (tier >= 12) {
                // THE GODSHIP: Massive, glowing, advanced
                let norm = 1.2; // Adjusted target size (Reduced from 1.5)
                let transformationProgress = 1.0;

                // Gradually grow during transformation
                if (playerShip && playerShip.transformationTimer > 0) {
                    transformationProgress = 1 - (playerShip.transformationTimer / 600);
                    norm = 1.0 + (norm - 1.0) * transformationProgress;

                    // DRAW TIER 11 FORM (Fading out)
                    canvasContext.save();
                    canvasContext.globalAlpha = 1 - transformationProgress;
                    let sides = 3 + 11; // Tier 11
                    canvasContext.beginPath();
                    for (let i = 0; i <= sides; i++) {
                        let ang = i * (2 * Math.PI / sides);
                        if (i === 0) canvasContext.moveTo(r * Math.cos(ang), -r * Math.sin(ang));
                        else canvasContext.lineTo(r * Math.cos(ang), -r * Math.sin(ang));
                    }
                    canvasContext.closePath();
                    let chassisGrad = canvasContext.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                    chassisGrad.addColorStop(0, '#0055aa'); chassisGrad.addColorStop(1, '#002244');
                    canvasContext.fillStyle = chassisGrad; canvasContext.fill();
                    canvasContext.lineWidth = 2; canvasContext.strokeStyle = '#0088ff'; canvasContext.stroke();
                    canvasContext.restore();
                }

                canvasContext.globalAlpha = transformationProgress;
                const HULL_COLOR = '#050505';
                const BORDER_COLOR = '#00FFFF';
                const CORE_COLOR = '#FFFFFF';

                canvasContext.shadowBlur = 40;
                canvasContext.shadowColor = BORDER_COLOR;

                // Advanced Chassis Design - Wide and multi-segmented
                canvasContext.beginPath();
                canvasContext.moveTo(r * 2.5 * norm, 0); // Front
                canvasContext.lineTo(r * 1.5 * norm, r * 1.2 * norm);
                canvasContext.lineTo(0, r * 1.8 * norm);
                canvasContext.lineTo(-r * 1.5 * norm, r * 1.2 * norm);
                canvasContext.lineTo(-r * 2.5 * norm, r * 1.5 * norm);
                canvasContext.lineTo(-r * 3 * norm, r * 0.5 * norm);
                canvasContext.lineTo(-r * 3 * norm, -r * 0.5 * norm);
                canvasContext.lineTo(-r * 2.5 * norm, -r * 1.5 * norm);
                canvasContext.lineTo(-r * 1.5 * norm, -r * 1.2 * norm);
                canvasContext.lineTo(0, -r * 1.8 * norm);
                canvasContext.lineTo(r * 1.5 * norm, -r * 1.2 * norm);
                canvasContext.closePath();

                canvasContext.fillStyle = HULL_COLOR;
                canvasContext.fill();
                canvasContext.lineWidth = 4;
                canvasContext.strokeStyle = BORDER_COLOR;
                canvasContext.stroke();

                // Tech Overlay (Inner hull patterns)
                canvasContext.shadowBlur = 15;
                canvasContext.beginPath();
                canvasContext.moveTo(r * 2 * norm, 0);
                canvasContext.lineTo(-r * 1.5 * norm, r * 0.8 * norm);
                canvasContext.moveTo(r * 2 * norm, 0);
                canvasContext.lineTo(-r * 1.5 * norm, -r * 0.8 * norm);
                canvasContext.stroke();

                // Pulsing Energy Core
                const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
                canvasContext.shadowBlur = 50 * pulse;
                canvasContext.fillStyle = CORE_COLOR;
                canvasContext.beginPath();
                canvasContext.arc(0, 0, r * norm * 0.6 * pulse, 0, Math.PI * 2);
                canvasContext.fill();

                // Heavy Thrusters
                const EXHAUST_X = -r * 3 * norm;
                if (playerShip.thrusting) {
                    canvasContext.shadowBlur = 80;
                    canvasContext.fillStyle = `rgba(0, 255, 255, ${0.4 + Math.random() * 0.6})`;
                    canvasContext.beginPath();
                    canvasContext.moveTo(EXHAUST_X, -r * 1.2 * norm);
                    canvasContext.lineTo(EXHAUST_X, r * 1.2 * norm);
                    canvasContext.lineTo(EXHAUST_X - r * 12 * norm * (0.8 + Math.random() * 0.4), 0);
                    canvasContext.closePath();
                    canvasContext.fill();
                }
                canvasContext.shadowBlur = 0;



            } else if (tier === 11) { // THE HYPERION - "The Celestial Dreadnought"
                // Transition design: Sharp mechanical edges with divine energy
                canvasContext.shadowBlur = 25; canvasContext.shadowColor = '#00ffff';
                canvasContext.lineWidth = 3;

                // 1. REINFORCED CHASSIS (Sleeker but heavier than Titan)
                canvasContext.fillStyle = '#0a0a0a'; canvasContext.strokeStyle = '#0088ff';
                canvasContext.beginPath();
                canvasContext.moveTo(r * 2.0, 0);               // Front Nose
                canvasContext.lineTo(r * 0.5, r * 0.8);          // Top Outer corner
                canvasContext.lineTo(-r * 1.2, r * 0.6);         // Top Back
                canvasContext.lineTo(-r * 1.5, 0);               // Rear Center
                canvasContext.lineTo(-r * 1.2, -r * 0.6);        // Bottom Back
                canvasContext.lineTo(r * 0.5, -r * 0.8);         // Bottom Outer corner
                canvasContext.closePath();
                canvasContext.fill(); canvasContext.stroke();

                // 2. ENERGY WINGS (Floating but close to hull)
                const pulse = 0.8 + Math.sin(Date.now() / 300) * 0.2;
                canvasContext.fillStyle = `rgba(0, 150, 255, ${0.4 * pulse})`;
                canvasContext.strokeStyle = `rgba(0, 255, 255, ${0.6 * pulse})`;

                // Top Wing
                canvasContext.beginPath();
                canvasContext.moveTo(r * 0.2, -r * 0.9);
                canvasContext.lineTo(r * 1.2, -r * 1.4);
                canvasContext.lineTo(r * 0.8, -r * 0.8);
                canvasContext.closePath();
                canvasContext.fill(); canvasContext.stroke();

                // Bottom Wing
                canvasContext.beginPath();
                canvasContext.moveTo(r * 0.2, r * 0.9);
                canvasContext.lineTo(r * 1.2, r * 1.4);
                canvasContext.lineTo(r * 0.8, r * 0.8);
                canvasContext.closePath();
                canvasContext.fill(); canvasContext.stroke();

                // 3. CELESTIAL CORE (Divine aspect)
                canvasContext.shadowBlur = 40; canvasContext.shadowColor = '#fff';
                canvasContext.fillStyle = '#fff';
                canvasContext.beginPath();
                canvasContext.arc(0, 0, r * 0.5, 0, Math.PI * 2);
                canvasContext.fill();

                // 4. ENERGY CHANNELS (Connecting mechanical to divine)
                canvasContext.shadowBlur = 0;
                canvasContext.strokeStyle = '#00ffff'; canvasContext.lineWidth = 1;
                canvasContext.beginPath();
                canvasContext.moveTo(r * 2.0, 0); canvasContext.lineTo(r * 0.5, 0); // Core to nose
                canvasContext.stroke();

            } else if (tier === 10) { // THE TITAN - Heavy Dreadnought
                canvasContext.shadowBlur = 20; canvasContext.shadowColor = '#ff5500';
                canvasContext.fillStyle = '#221100'; canvasContext.strokeStyle = '#ffaa00'; canvasContext.lineWidth = 4;

                // Main Block (Long along X)
                canvasContext.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
                canvasContext.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);

                // Side Armor (Top and Bottom)
                canvasContext.fillStyle = '#331100';
                canvasContext.fillRect(-r * 0.5, -r * 1.2, r * 1.5, r * 0.6);
                canvasContext.strokeRect(-r * 0.5, -r * 1.2, r * 1.5, r * 0.6);
                canvasContext.fillRect(-r * 0.5, r * 0.6, r * 1.5, r * 0.6);
                canvasContext.strokeRect(-r * 0.5, r * 0.6, r * 1.5, r * 0.6);

            } else if (tier === 9) { // THE CELESTIAL - Radiant Star
                canvasContext.shadowBlur = 25; canvasContext.shadowColor = '#ffffaa';
                canvasContext.fillStyle = '#ffffcc'; canvasContext.strokeStyle = '#ffffff'; canvasContext.lineWidth = 2;

                // 4-Pointed Star
                canvasContext.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = i * Math.PI / 4;
                    const rad = (i % 2 === 0) ? r * 1.5 : r * 0.4;
                    const px = Math.cos(angle) * rad; const py = Math.sin(angle) * rad;
                    if (i === 0) canvasContext.moveTo(px, py); else canvasContext.lineTo(px, py);
                }
                canvasContext.closePath();
                canvasContext.fill(); canvasContext.stroke();

                // Inner Spin
                canvasContext.strokeStyle = '#ffaa00';
                canvasContext.beginPath(); canvasContext.arc(0, 0, r * 0.5, 0, Math.PI * 2); canvasContext.stroke();

            } else if (tier === 8) { // THE SPHERE - Energy Orb
                canvasContext.shadowBlur = 20; canvasContext.shadowColor = '#00ff88';
                let grad = canvasContext.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#00ff88'); grad.addColorStop(1, '#004422');
                canvasContext.fillStyle = grad;
                canvasContext.strokeStyle = '#00ff88'; canvasContext.lineWidth = 2;

                canvasContext.beginPath(); canvasContext.arc(0, 0, r, 0, Math.PI * 2); canvasContext.fill(); canvasContext.stroke();

                // Rotating Ring
                canvasContext.save(); canvasContext.rotate(Date.now() / 500);
                canvasContext.strokeStyle = '#fff'; canvasContext.lineWidth = 1;
                canvasContext.beginPath(); canvasContext.ellipse(0, 0, r * 1.4, r * 0.3, 0, 0, Math.PI * 2); canvasContext.stroke();
                canvasContext.restore();

            } else if (tier >= 1 && tier <= 7) {
                // GEOMETRIC SHAPES (1-7)
                const sides = tier + 3; // 1=Square(4), 2=Pent(5)...
                canvasContext.shadowBlur = 15; canvasContext.shadowColor = `hsl(${PLAYER_HUE}, 100%, 60%)`;
                canvasContext.fillStyle = `hsla(${PLAYER_HUE}, 60%, 20%, 0.8)`;
                canvasContext.strokeStyle = `hsl(${PLAYER_HUE}, 100%, 70%)`; canvasContext.lineWidth = 3;

                // Polygon Body
                canvasContext.beginPath();
                for (let i = 0; i < sides; i++) {
                    // Rotate so flat side is usually at bottom or point at top depending on preference.
                    // -Math.PI/2 puts a vertex at the top.
                    const angle = i * (Math.PI * 2 / sides) - Math.PI / 2;
                    const px = Math.cos(angle) * r; const py = Math.sin(angle) * r;
                    if (i === 0) canvasContext.moveTo(px, py); else canvasContext.lineTo(px, py);
                }
                canvasContext.closePath();
                canvasContext.fill(); canvasContext.stroke();

                // Internal "Cool" Details based on shape
                canvasContext.lineWidth = 1.5; canvasContext.strokeStyle = `hsl(${PLAYER_HUE}, 100%, 90%)`;
                canvasContext.beginPath();
                if (tier === 1) { // SQUARE: Cross Bracing
                    canvasContext.moveTo(-r * 0.7, -r * 0.7); canvasContext.lineTo(r * 0.7, r * 0.7);
                    canvasContext.moveTo(r * 0.7, -r * 0.7); canvasContext.lineTo(-r * 0.7, r * 0.7);
                } else if (tier === 2) { // PENTAGON: Star
                    for (let i = 0; i < 5; i++) {
                        const a1 = i * (Math.PI * 2 / 5) - Math.PI / 2;
                        const a2 = (i + 2) * (Math.PI * 2 / 5) - Math.PI / 2;
                        canvasContext.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
                        canvasContext.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
                    }
                } else if (tier === 3) { // HEXAGON: Cube/Tri-split
                    canvasContext.moveTo(0, 0); canvasContext.lineTo(0, -r);
                    canvasContext.moveTo(0, 0); canvasContext.lineTo(Math.cos(Math.PI / 6) * r, Math.sin(Math.PI / 6) * r);
                    canvasContext.moveTo(0, 0); canvasContext.lineTo(Math.cos(Math.PI * 5 / 6) * r, Math.sin(Math.PI * 5 / 6) * r);
                } else { // HEPTAGON+ : Concentric shapes
                    const innerR = r * 0.5;
                    for (let i = 0; i < sides; i++) {
                        const angle = i * (Math.PI * 2 / sides) - Math.PI / 2;
                        const px = Math.cos(angle) * innerR; const py = Math.sin(angle) * innerR;
                        if (i === 0) canvasContext.moveTo(px, py); else canvasContext.lineTo(px, py);
                    }
                    canvasContext.closePath();
                }
                canvasContext.stroke();

            } else {
                // TIER 0: TRIANGLE (Classic Modern)
                // Base size logic
                const baseSize = r;
                const noseLength = 1.3;
                const wingSpan = 0.8;

                canvasContext.shadowBlur = 15; canvasContext.shadowColor = `hsl(${PLAYER_HUE}, 100%, 70%)`;

                // Triangle
                canvasContext.beginPath();
                canvasContext.moveTo(baseSize * noseLength, 0);
                canvasContext.lineTo(-baseSize * 0.6, baseSize * wingSpan);
                canvasContext.lineTo(-baseSize * 0.6, -baseSize * wingSpan);
                canvasContext.closePath();

                let hullGrad = canvasContext.createLinearGradient(baseSize * 0.6, 0, -baseSize * 0.6, 0);
                hullGrad.addColorStop(0, `hsl(${PLAYER_HUE}, 100%, 70%)`);
                hullGrad.addColorStop(1, `hsl(${PLAYER_HUE}, 40%, 15%)`);
                canvasContext.fillStyle = hullGrad;
                canvasContext.fill();

                canvasContext.lineWidth = 2;
                canvasContext.strokeStyle = `hsl(${PLAYER_HUE}, 80%, 60%)`;
                canvasContext.stroke();

                // Detail
                canvasContext.beginPath(); canvasContext.moveTo(r * 0.5, 0); canvasContext.lineTo(-r * 0.2, 0); canvasContext.stroke();
            }

            // === COMMON THRUSTER LOGIC (Adapted for all models) ===
            if (playerShip.thrusting) {
                canvasContext.shadowBlur = 25; canvasContext.shadowColor = '#ffaa00';
                canvasContext.fillStyle = `rgba(255, 170, 0, ${0.5 + Math.random() * 0.5})`;
                const thrustL = 30 + Math.random() * 10;

                // Single central thrust for most, specialized for heavy tiers
                if (tier === 10) { // Titan: Dual Thrusters on rear ends
                    [-r * 0.9, r * 0.9].forEach(yPos => {
                        canvasContext.beginPath();
                        canvasContext.moveTo(-r, yPos - 5); canvasContext.lineTo(-r - thrustL, yPos); canvasContext.lineTo(-r, yPos + 5);
                        canvasContext.fill();
                    });
                } else if (tier === 11) { // Hyperion: Celestial Thrust
                    canvasContext.beginPath();
                    canvasContext.moveTo(-r * 1.5, -r * 0.3);
                    canvasContext.lineTo(-r * 1.5 - thrustL * 1.5, 0); // Slightly longer thrust
                    canvasContext.lineTo(-r * 1.5, r * 0.3);
                    canvasContext.fill();
                } else {
                    canvasContext.beginPath();
                    canvasContext.moveTo(-r * 0.7, -r * 0.2);
                    canvasContext.lineTo(-r * 0.7 - thrustL, 0);
                    canvasContext.lineTo(-r * 0.7, r * 0.2);
                    canvasContext.fill();
                }
                canvasContext.shadowBlur = 0;
            }
        }
        canvasContext.restore();
    }
    if (playerShip.blinkNum > 0) playerShip.blinkNum--;
    canvasContext.restore(); // POP 1: Restore state after ship block

    canvasContext.shadowColor = '#ff0000'; canvasContext.fillStyle = '#ff0000';
    for (let i = enemyShipBullets.length - 1; i >= 0; i--) {
        let enemyShipBullet = enemyShipBullets[i];

        // Gravity (World Coords)
        for (let r of roids) {
            if (r.isPlanet && r.z < 0.5) { // Near planet
                let dx = r.x - enemyShipBullet.x; let dy = r.y - enemyShipBullet.y; // World Distance Vector
                let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);
                let force = (G_CONST * r.mass) / Math.max(distSq, 1000);
                if (dist < r.r * 8 && dist > 1) {
                    enemyShipBullet.xv += (dx / dist) * force * SHIP_BULLET_GRAVITY_FACTOR;
                    enemyShipBullet.yv += (dy / dist) * force * SHIP_BULLET_GRAVITY_FACTOR;
                }
            }
        }

        enemyShipBullet.x += enemyShipBullet.xv; enemyShipBullet.y += enemyShipBullet.yv;
        enemyShipBullet.life--;

        if (enemyShipBullet.life <= 0 || Math.hypot(worldOffsetX - enemyShipBullet.x, worldOffsetY - enemyShipBullet.y) > WORLD_BOUNDS * 1.5) {
            enemyShipBullets.splice(i, 1); continue;
        }

        const vpX = enemyShipBullet.x - worldOffsetX + width / 2;
        const vpY = enemyShipBullet.y - worldOffsetY + height / 2;

        let alpha = 1.0;
        if (enemyShipBullet.life < SHIP_BULLET_FADE_FRAMES) {
            alpha = enemyShipBullet.life / SHIP_BULLET_FADE_FRAMES;
        }
        canvasContext.globalAlpha = alpha;

        // TIERED ENEMY BULLET RENDERING (Synchronized with Player)
        const tier = enemyShipBullet.tier || 0;
        const hue = enemyShipBullet.hue || 0; // Faction Color

        // Colors derived from faction hue
        const mainColor = `hsl(${hue}, 100%, 70%)`;
        const glowColor = `hsl(${hue}, 100%, 50%)`;
        const coreColor = '#ffffff';

        if (tier >= 8) { // Ultimate Beam-like (Enemy)
            canvasContext.shadowBlur = 15; canvasContext.shadowColor = glowColor; canvasContext.fillStyle = mainColor;
            canvasContext.beginPath();
            let ang = Math.atan2(enemyShipBullet.yv, enemyShipBullet.xv);
            canvasContext.ellipse(vpX, vpY, enemyShipBullet.size * 4, enemyShipBullet.size * 0.8, ang, 0, Math.PI * 2);
            canvasContext.fill();
            canvasContext.fillStyle = coreColor;
            canvasContext.beginPath(); canvasContext.arc(vpX, vpY, enemyShipBullet.size / 2, 0, Math.PI * 2); canvasContext.fill();
        } else {
            // GEOMETRIC SHAPES (Tier 0-7) matching Ship Hull
            let sides = 3 + tier;
            canvasContext.shadowBlur = 5; canvasContext.shadowColor = glowColor; canvasContext.fillStyle = mainColor;

            canvasContext.save();
            canvasContext.translate(vpX, vpY);
            // Spin effect based on life
            canvasContext.rotate(enemyShipBullet.life * 0.2);

            canvasContext.beginPath();
            for (let k = 0; k < sides; k++) {
                let ang = k * (2 * Math.PI / sides);
                let r = enemyShipBullet.size * (1 + tier * 0.1); // Slightly larger for higher tiers
                if (k === 0) canvasContext.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                else canvasContext.lineTo(r * Math.cos(ang), r * Math.sin(ang));
            }
            canvasContext.closePath();
            canvasContext.fill();

            // Core
            canvasContext.fillStyle = coreColor;
            canvasContext.beginPath(); canvasContext.arc(0, 0, enemyShipBullet.size * 0.4, 0, Math.PI * 2); canvasContext.fill();

            canvasContext.restore();
        }

        canvasContext.globalAlpha = 1; // Reset alpha

        let hit = false;
        // Collision with player (World Coords)
        if (!playerShip.dead && !enemyShipBullet.isFriendly && Math.hypot(worldOffsetX - enemyShipBullet.x, worldOffsetY - enemyShipBullet.y) < (playerShip.effectiveR || playerShip.r) + 5) {
            hitPlayerShip(1);

            // INDIVIDUAL EVOLUTION: Gain score for hitting/killing player
            if (enemyShipBullet.owner && ships.includes(enemyShipBullet.owner)) {
                enemyShipBullet.owner.score += SHIP_KILLED_REWARD;
            }

            enemyShipBullets.splice(i, 1);
            hit = true;
        }
        if (hit) continue;

        // NEW: Collision with RIVAL SHIPS (Faction War)
        for (let k = ships.length - 1; k >= 0; k--) {
            let e = ships[k];
            if (e.z > 0.5) continue; // Ignore background ships

            // Basic collision check
            if (Math.hypot(enemyShipBullet.x - e.x, enemyShipBullet.y - e.y) < e.r + enemyShipBullet.size) {
                // Friendly fire exclusion
                if (enemyShipBullet.isFriendly && e.isFriendly) continue;
                if (!enemyShipBullet.isFriendly && !e.isFriendly && enemyShipBullet.hue === e.fleetHue) continue; // Same fleet enemy ships

                e.structureHP--;
                e.shieldHitTimer = 10;
                createExplosion(enemyShipBullet.x - worldOffsetX + width / 2, enemyShipBullet.y - worldOffsetY + height / 2, 5, '#ff0055', 1, 'spark');

                if (e.structureHP <= 0) {
                    let debrisColor = e.type === 'station' ? `hsl(${e.fleetHue}, 100%, 50%)` : `hsl(${e.fleetHue}, 100%, 40%)`;
                    createExplosion(e.x - worldOffsetX + width / 2, e.y - worldOffsetY + height / 2, 40, debrisColor, 4, 'debris');
                    if (e.type === 'station') { onStationDestroyed(e, enemyShipBullet.owner); }
                    else { onShipDestroyed(e, enemyShipBullet.owner); }

                    // INDIVIDUAL EVOLUTION: Gain score for killing rival
                    if (enemyShipBullet.owner && ships.includes(enemyShipBullet.owner)) {
                        enemyShipBullet.owner.score += (e.type === 'station') ? STATION_KILLED_REWARD : SHIP_KILLED_REWARD;
                    }

                    ships.splice(k, 1);
                    AudioEngine.playExplosion('large', e.x, e.y, e.z);
                }

                enemyShipBullets.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;

        // Collision with asteroids (World Coords)
        for (let j = roids.length - 1; j >= 0; j--) {
            let r = roids[j];
            if (r.z > 0.5) continue;
            if (Math.hypot(enemyShipBullet.x - r.x, enemyShipBullet.y - r.y) < r.r) {
                const rVpX = r.x - worldOffsetX + width / 2;
                const rVpY = r.y - worldOffsetY + height / 2;

                if (r.isPlanet) {
                    createExplosion(vpX, vpY, 3, '#fff', 1); // Bullet destroyed by planet shield
                }
                else {
                    createExplosion(rVpX, rVpY, 10, '#aa00ff', 1, 'debris');

                    // INDIVIDUAL EVOLUTION: Gain score for destroying asteroids
                    if (enemyShipBullet.owner && ships.includes(enemyShipBullet.owner)) {
                        enemyShipBullet.owner.score += ASTEROID_DESTROYED_REWARD;
                    }

                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_MIN_SIZE) {
                        const bulletAngle = Math.atan2(enemyShipBullet.yv, enemyShipBullet.xv);
                        const perpAngle1 = bulletAngle + Math.PI / 2;
                        const perpAngle2 = bulletAngle - Math.PI / 2;
                        const dynamicOffset = r.r * (ASTEROID_SPLIT_OFFSET / ASTEROID_MAX_SIZE);

                        let frag1 = createAsteroid(r.x + Math.cos(perpAngle1) * dynamicOffset, r.y + Math.sin(perpAngle1) * dynamicOffset, newSize);
                        frag1.xv = r.xv + Math.cos(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.yv = r.yv + Math.sin(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.blinkNum = 30;
                        roids.push(frag1);

                        let frag2 = createAsteroid(r.x + Math.cos(perpAngle2) * dynamicOffset, r.y + Math.sin(perpAngle2) * dynamicOffset, newSize);
                        frag2.xv = r.xv + Math.cos(perpAngle2) * ASTEROID_SPLIT_SPEED;
                        frag2.yv = r.yv + Math.sin(perpAngle2) * ASTEROID_SPLIT_SPEED;
                        frag2.blinkNum = 30;
                        roids.push(frag2);

                        updateAsteroidCounter();
                    }
                    roids.splice(j, 1);
                    updateAsteroidCounter();
                    AudioEngine.playExplosion('small', r.x, r.y, r.z); // Added for asteroid destruction by enemy
                }
                enemyShipBullets.splice(i, 1); hit = true; break;
            }
        }
    }

    // --- Player Bullet Logic (All in World Coords) ---
    canvasContext.shadowColor = '#ff0055'; canvasContext.fillStyle = '#ff0055';
    for (let i = playerShipBullets.length - 1; i >= 0; i--) {
        let playerShipBullet = playerShipBullets[i];

        for (let r of roids) {
            if (r.isPlanet && r.z < 0.5) {
                let dx = r.x - playerShipBullet.x; let dy = r.y - playerShipBullet.y;
                let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);
                let force = (G_CONST * r.mass) / Math.max(distSq, 1000);
                if (dist < r.r * 8 && dist > 1) {
                    playerShipBullet.xv += (dx / dist) * force * SHIP_BULLET_GRAVITY_FACTOR;
                    playerShipBullet.yv += (dy / dist) * force * SHIP_BULLET_GRAVITY_FACTOR;
                }
            }
        }

        playerShipBullet.x += playerShipBullet.xv; playerShipBullet.y += playerShipBullet.yv;
        playerShipBullet.life--;

        if (playerShipBullet.life <= 0 || Math.hypot(worldOffsetX - playerShipBullet.x, worldOffsetY - playerShipBullet.y) > WORLD_BOUNDS * 1.5) {
            playerShipBullets.splice(i, 1); continue;
        }

        const vpX = playerShipBullet.x - worldOffsetX + width / 2;
        const vpY = playerShipBullet.y - worldOffsetY + height / 2;

        // NEW: Bullet Fade Effect
        let alpha = 1.0;
        if (playerShipBullet.life < SHIP_BULLET_FADE_FRAMES) {
            alpha = playerShipBullet.life / SHIP_BULLET_FADE_FRAMES;
        }
        canvasContext.globalAlpha = alpha;

        canvasContext.globalAlpha = alpha;

        // TIERED BULLET RENDERING
        const tier = playerShipBullet.tier || 0;

        if (tier >= 8) { // Ultimate Beam-like
            canvasContext.shadowBlur = 15; canvasContext.shadowColor = '#00ffff'; canvasContext.fillStyle = '#ffffff';
            canvasContext.beginPath();
            // Draw elongated bolt
            let ang = Math.atan2(playerShipBullet.yv, playerShipBullet.xv); // Use velocity for orientation
            canvasContext.ellipse(vpX, vpY, playerShipBullet.size * 4, playerShipBullet.size * 0.8, ang, 0, Math.PI * 2);
            canvasContext.fill();
            // Core
            canvasContext.fillStyle = '#ccffff';
            canvasContext.beginPath(); canvasContext.arc(vpX, vpY, playerShipBullet.size / 2, 0, Math.PI * 2); canvasContext.fill();
        } else {
            // GEOMETRIC SHAPES (Tier 0-7)
            let sides = 3 + tier;

            // Colors logic
            let pColor = '#ff0055'; let pGlow = '#ff0055';
            if (tier >= 4) { pColor = '#ffff00'; pGlow = '#ffff00'; }
            else if (tier >= 1) { pColor = '#ffaa00'; pGlow = '#ffaa00'; }

            canvasContext.shadowBlur = 5; canvasContext.shadowColor = pGlow; canvasContext.fillStyle = pColor;

            canvasContext.save();
            canvasContext.translate(vpX, vpY);
            canvasContext.rotate(playerShipBullet.life * 0.2);

            canvasContext.beginPath();
            for (let k = 0; k < sides; k++) {
                let ang = k * (2 * Math.PI / sides);
                let r = playerShipBullet.size; // Size already accounts for tier boost in createBullet
                if (k === 0) canvasContext.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                else canvasContext.lineTo(r * Math.cos(ang), r * Math.sin(ang));
            }
            canvasContext.closePath();
            canvasContext.fill();

            // Core
            canvasContext.fillStyle = '#ffffff';
            canvasContext.beginPath(); canvasContext.arc(0, 0, playerShipBullet.size * 0.4, 0, Math.PI * 2); canvasContext.fill();

            canvasContext.restore();
        }

        canvasContext.globalAlpha = 1; // Reset alpha
        let hit = false;

        // Collision with asteroids/planets (World Coords)
        for (let j = roids.length - 1; j >= 0; j--) {
            let r = roids[j];
            if (r.z > 0.5) continue;

            // Use bullet size for effective collision radius
            if (Math.hypot(playerShipBullet.x - r.x, playerShipBullet.y - r.y) < r.r + playerShipBullet.size) {
                const rVpX = r.x - worldOffsetX + width / 2;
                const rVpY = r.y - worldOffsetY + height / 2;

                if (r.isPlanet) {
                    if (r.blinkNum === 0) {
                        let planet = r;
                        let asteroidMass = playerShipBullet.size * 10;
                        let asteroidR = playerShipBullet.size * 2;

                        let area1 = Math.PI * planet.r * planet.r;
                        let area2 = Math.PI * asteroidR * asteroidR;
                        let totalArea = area1 + area2;
                        let newR = Math.sqrt(totalArea / Math.PI);

                        let totalMass = planet.mass + asteroidMass;

                        planet.targetR = newR;
                        planet.mass = totalMass * 0.05;

                        createExplosion(vpX, vpY, 10, '#00ffff', 2);
                    }

                    playerShipBullets.splice(i, 1); hit = true; break;
                } else {
                    if (r.blinkNum > 0) {
                        playerShipBullets.splice(i, 1); hit = true; break;
                    }
                    createExplosion(rVpX, rVpY, 15, '#ff0055', 1, 'spark');
                    createExplosion(rVpX, rVpY, 5, '#888', 2, 'debris');

                    const newSize = r.r * 0.5;
                    if (newSize >= ASTEROID_MIN_SIZE) {
                        const bulletAngle = Math.atan2(playerShipBullet.yv, playerShipBullet.xv);
                        const perpAngle1 = bulletAngle + Math.PI / 2;
                        const perpAngle2 = bulletAngle - Math.PI / 2;
                        const dynamicOffset = r.r * (ASTEROID_SPLIT_OFFSET / ASTEROID_MAX_SIZE);

                        let frag1 = createAsteroid(r.x + Math.cos(perpAngle1) * dynamicOffset, r.y + Math.sin(perpAngle1) * dynamicOffset, newSize);
                        frag1.xv = r.xv + Math.cos(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.yv = r.yv + Math.sin(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.blinkNum = 30;
                        roids.push(frag1);

                        let frag2 = createAsteroid(r.x + Math.cos(perpAngle2) * dynamicOffset, r.y + Math.sin(perpAngle2) * dynamicOffset, newSize);
                        frag2.xv = r.xv + Math.cos(perpAngle2) * ASTEROID_SPLIT_SPEED;
                        frag2.yv = r.yv + Math.sin(perpAngle2) * ASTEROID_SPLIT_SPEED;
                        frag2.blinkNum = 30;
                        roids.push(frag2);

                        updateAsteroidCounter();
                    }

                    roids.splice(j, 1);
                    updateAsteroidCounter();
                    AudioEngine.playExplosion('small', r.x, r.y, r.z);
                }
                if (!r.isPlanet) {
                    increaseShipScore(playerShip, ASTEROID_DESTROYED_REWARD);
                }
                playerShipBullets.splice(i, 1); hit = true; break;
            }
        }
        if (hit) continue;

        // Collision with ships (World Coords)
        for (let j = ships.length - 1; j >= 0; j--) {
            let ship = ships[j];

            // If we are NOT a lone wolf, hitting friends triggers a warning
            if (ship.isFriendly && !playerShip.loneWolf && !victoryState && !playerShip.dead) {
                if (Math.hypot(playerShipBullet.x - ship.x, playerShipBullet.y - ship.y) < ship.r + playerShipBullet.size) {
                    addScreenMessage("⚠ WARNING: CEASE FIRE ON ALLIES!", "#ffcc00");
                    ship.structureHP -= 1.0;
                    ship.shieldHitTimer = 5;
                    playerShipBullets.splice(i, 1);
                    hit = true;

                    if (ship.structureHP <= 0) {
                        const eVpX = ship.x - worldOffsetX + width / 2;
                        const eVpY = ship.y - worldOffsetY + height / 2;
                        let debrisColor = ship.type === 'station' ? `hsl(${ship.fleetHue}, 100%, 50%)` : `hsl(${ship.fleetHue}, 100%, 40%)`;
                        createExplosion(eVpX, eVpY, 40, '#ffaa00', 3, 'spark');
                        createExplosion(eVpX, eVpY, 20, debrisColor, 4, 'debris');

                        if (ship.type === 'station') {
                            onStationDestroyed(ship, playerShip);
                        } else {
                            onShipDestroyed(ship, playerShip);
                        }

                        ships.splice(j, 1);
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
                playerShipBullets.splice(i, 1);
                hit = true;

                const eVpX = ship.x - worldOffsetX + width / 2;
                const eVpY = ship.y - worldOffsetY + height / 2;

                if (ship.structureHP <= 0) {
                    let debrisColor = ship.type === 'station' ? `hsl(${ship.fleetHue}, 100%, 50%)` : `hsl(${ship.fleetHue}, 100%, 40%)`;
                    createExplosion(eVpX, eVpY, 40, '#ffaa00', 3, 'spark'); createExplosion(eVpX, eVpY, 20, debrisColor, 4, 'debris');
                    if (ship.type === 'station') { onStationDestroyed(ship, playerShipBullet.owner); }
                    else { onShipDestroyed(ship, playerShipBullet.owner); }
                    ships.splice(j, 1);
                    AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                }
                break;
            } else if (ship.blinkNum > 0 && Math.hypot(playerShipBullet.x - ship.x, playerShipBullet.y - ship.y) < ship.r + playerShipBullet.size) {
                playerShipBullets.splice(i, 1); hit = true; break;
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

        if (p.type === 'flame') {
            canvasContext.globalAlpha = p.life / 60;
            canvasContext.shadowBlur = 15;
            canvasContext.shadowColor = p.color;
            canvasContext.fillStyle = p.color;
            canvasContext.beginPath();
            // Flames pulsate and grow slightly then shrink
            const flameSize = p.size * (1 + Math.sin(p.life * 0.2) * 0.3);
            canvasContext.arc(vpX, vpY, flameSize, 0, Math.PI * 2);
            canvasContext.fill();
        } else if (p.type === 'smoke') {
            canvasContext.globalAlpha = (p.life / 100) * 0.4;
            canvasContext.fillStyle = p.color;
            canvasContext.beginPath();
            canvasContext.arc(vpX, vpY, p.size * (1 + (100 - p.life) * 0.05), 0, Math.PI * 2);
            canvasContext.fill();
        } else {
            canvasContext.shadowColor = p.color; canvasContext.fillStyle = p.color; canvasContext.globalAlpha = p.life / 60;
            canvasContext.beginPath();
            if (p.type === 'debris') canvasContext.fillRect(vpX, vpY, p.size, p.size); else canvasContext.arc(vpX, vpY, p.size, 0, Math.PI * 2);
            canvasContext.fill();
        }
        canvasContext.globalAlpha = 1;
        canvasContext.shadowBlur = 0;

        p.life--; if (p.life <= 0) particles.splice(i, 1);
    }

    // Auto-spawn asteroid if count is too low
    /* DISABLED: Victory is based on cleaning the map
    if (roids.length < 5 + level && !victoryState) {
        let x, y, d;
        // Spawning logic (off-screen in World Coords)
        const spawnRadius = WORLD_BOUNDS * 0.9;
        do { x = (Math.random() - 0.5) * spawnRadius * 2; y = (Math.random() - 0.5) * spawnRadius * 2; d = Math.sqrt(x ** 2 + y ** 2); } while (d < 300);
        roids.push(createAsteroid(x, y, 60));
        updateAsteroidCounter();
    }
    */

    drawRadar();

    canvasContext.restore();
    canvasContext.shadowBlur = 0;

    // --- Off-Screen Enemy Indicators ---
    // Show red dots at screen borders for ships that are approaching but not visible
    // Draw in screen space (unscaled) to work correctly in touch mode
    if (!(playerShip.dead && playerShip.lives <= 0)) {
        canvasContext.save();
        canvasContext.resetTransform(); // Draw in screen space, not affected by viewport scaling
        const INDICATOR_SIZE = 8;
        const BORDER_PADDING = 20;
        const DETECTION_RANGE = 3000; // How far off-screen to detect ships

        ships.forEach(e => {
            if (e.isFriendly || e.z > 0.5) return; // Skip friendly ships and far-away ships

            // Calculate viewport position (in world viewport space)
            const depthScale = 1 / (1 + e.z);
            const worldVpX = (e.x - worldOffsetX) * depthScale + width / 2;
            const worldVpY = (e.y - worldOffsetY) * depthScale + height / 2;

            // Apply viewScale transformation to get screen position
            const vpX = worldVpX * viewScale + width / 2 * (1 - viewScale);
            const vpY = worldVpY * viewScale + height / 2 * (1 - viewScale);

            const screenLeft = 0;
            const screenRight = width;
            const screenTop = 0;
            const screenBottom = height;

            // Check if enemy is off-screen but within detection range
            const isOffScreen = vpX < screenLeft || vpX > screenRight || vpY < screenTop || vpY > screenBottom;
            const distToPlayer = Math.hypot(e.x - worldOffsetX, e.y - worldOffsetY);

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
                canvasContext.globalAlpha = pulseAlpha;
                canvasContext.fillStyle = '#FF0000';
                canvasContext.shadowColor = '#FF0000';
                canvasContext.shadowBlur = 10;

                // Draw arrow pointing towards enemy
                const angleToEnemy = Math.atan2(vpY - indicatorY, vpX - indicatorX);
                canvasContext.save();
                canvasContext.translate(indicatorX, indicatorY);
                canvasContext.rotate(angleToEnemy);

                // Draw triangle arrow
                canvasContext.beginPath();
                canvasContext.moveTo(INDICATOR_SIZE, 0);
                canvasContext.lineTo(-INDICATOR_SIZE / 2, -INDICATOR_SIZE / 2);
                canvasContext.lineTo(-INDICATOR_SIZE / 2, INDICATOR_SIZE / 2);
                canvasContext.closePath();
                canvasContext.fill();

                canvasContext.restore();
                canvasContext.globalAlpha = 1;
            }
        });

        // --- Off-Screen Asteroid Indicators ---
        // Show gray indicators at screen borders for asteroids that are approaching but not visible
        roids.forEach(r => {
            if (r.isPlanet || r.z > 0.5) return; // Skip planets and far-away asteroids

            // Calculate viewport position (in world viewport space)
            const depthScale = 1 / (1 + r.z);
            const worldVpX = (r.x - worldOffsetX) * depthScale + width / 2;
            const worldVpY = (r.y - worldOffsetY) * depthScale + height / 2;

            // Apply viewScale transformation to get screen position
            const vpX = worldVpX * viewScale + width / 2 * (1 - viewScale);
            const vpY = worldVpY * viewScale + height / 2 * (1 - viewScale);

            const screenLeft = 0;
            const screenRight = width;
            const screenTop = 0;
            const screenBottom = height;

            // Check if asteroid is off-screen but within detection range
            const isOffScreen = vpX < screenLeft || vpX > screenRight || vpY < screenTop || vpY > screenBottom;
            const distToPlayer = Math.hypot(r.x - worldOffsetX, r.y - worldOffsetY);

            if (isOffScreen && distToPlayer < DETECTION_RANGE) {
                // Calculate indicator position at screen border
                let indicatorX = vpX;
                let indicatorY = vpY;

                // Clamp to screen borders with padding
                if (vpX < screenLeft) indicatorX = screenLeft + BORDER_PADDING;
                else if (vpX > screenRight) indicatorX = screenRight - BORDER_PADDING;

                if (vpY < screenTop) indicatorY = screenTop + BORDER_PADDING;
                else if (vpY > screenBottom) indicatorY = screenBottom - BORDER_PADDING;

                // Draw subtle gray indicator
                const pulseAlpha = 0.4 + Math.sin(Date.now() / 250) * 0.2;
                canvasContext.globalAlpha = pulseAlpha;
                canvasContext.fillStyle = '#AAAAAA';
                canvasContext.shadowColor = '#AAAAAA';
                canvasContext.shadowBlur = 8;

                // Draw arrow pointing towards asteroid
                const angleToAsteroid = Math.atan2(vpY - indicatorY, vpX - indicatorX);
                canvasContext.save();
                canvasContext.translate(indicatorX, indicatorY);
                canvasContext.rotate(angleToAsteroid);

                // Draw triangle arrow (slightly smaller than enemy indicators)
                const asteroidIndicatorSize = INDICATOR_SIZE * 0.75;
                canvasContext.beginPath();
                canvasContext.moveTo(asteroidIndicatorSize, 0);
                canvasContext.lineTo(-asteroidIndicatorSize / 2, -asteroidIndicatorSize / 2);
                canvasContext.lineTo(-asteroidIndicatorSize / 2, asteroidIndicatorSize / 2);
                canvasContext.closePath();
                canvasContext.fill();

                canvasContext.restore();
                canvasContext.globalAlpha = 1;
            }
        });

        canvasContext.restore();
        canvasContext.shadowBlur = 0;

        // --- Render Screen Messages ---
        if (screenMessages.length > 0) {
            canvasContext.save();
            canvasContext.resetTransform(); // Draw in screen space
            canvasContext.textAlign = 'center';

            // Responsive font size based on screen width
            const baseFontSize = 24;
            const fontSize = Math.max(14, Math.min(baseFontSize, width / 30)); // Scale between 14px and 24px
            canvasContext.font = `bold ${fontSize}px Courier New`;

            for (let i = screenMessages.length - 1; i >= 0; i--) {
                const m = screenMessages[i];
                const alpha = Math.min(1, m.life / 30);
                canvasContext.globalAlpha = alpha;
                canvasContext.fillStyle = m.color;
                canvasContext.shadowBlur = 10;
                canvasContext.shadowColor = m.color;

                // Draw relative to center, offset by message index
                const yPos = height * 0.3 + (i * (fontSize + 16));

                // Use maxWidth to prevent text overflow (90% of screen width)
                const maxWidth = width * 0.9;
                canvasContext.fillText(m.text, width / 2, yPos, maxWidth);

                m.life--;
                if (m.life <= 0) screenMessages.splice(i, 1);
            }
            canvasContext.restore();
        }

        // Victory Fireworks
        if (victoryState && Math.random() < 0.05) {
            const fx = (Math.random() - 0.5) * width;
            const fy = (Math.random() - 0.5) * height;
            const hue = Math.floor(Math.random() * 360);
            createExplosion(width / 2 + fx, height / 2 + fy, 40, `hsl(${hue}, 100%, 50%)`, 3, 'spark');
        }
    }
}

function startGame() {
    // Stop menu music
    AudioEngine.stopMusic();
    AudioEngine.setTrack('game');

    // Hide start/restart button in order to gradually show it again in the game over screen.
    startBtn.style.display = 'none';

    // RESTORE HUD
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'flex';

    startScreen.style.display = 'none';
    startScreen.classList.remove('game-over', 'game-over-bg', 'victory', 'fade-out');
    startScreen.removeEventListener('click', audioStopper);

    level = 0;
    homePlanetId = null;
    screenMessages = [];
    victoryState = false;
    viewScale = 1.0;

    fadeOverlay.style.background = 'rgba(0, 0, 0, 0)';

    velocity = { x: 0, y: 0 };
    worldOffsetX = 0;
    worldOffsetY = 0;
    stationSpawnTimer = STATIONS_SPAWN_TIMER;
    stationsDestroyedCount = 0;
    playerReloadTime = 0; // Reset reload timer

    particles = [];
    ambientFogs = [];
    playerShipBullets = [];
    enemyShipBullets = [];
    shockwaves = [];
    ships = []; // NEW: Reset ships here, safely before adding player and stations

    playerShip = newPlayerShip();
    increaseShipScore(playerShip, 0);
    ships.push(playerShip);

    if (playerShip.lives <= 0) {
        killPlayerShip();
        return;
    }

    initBackground();
    createLevel();

    // NEW: Spawn player at Home Planet if it exists
    if (homePlanetId) {
        const home = roids.find(r => r.id === homePlanetId);
        if (home) {
            worldOffsetX = home.x;
            worldOffsetY = home.y;
        }
    }

    drawLives();
    updateAsteroidCounter(); // Sync score/count immediately
    gameRunning = true;

    // Reset radar zoom to default (2500)
    currentZoomIndex = 2;
    RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex];
    // radarRangeEl.innerText = RADAR_RANGE; // REMOVED

    // Determine initial input mode based on device
    if (window.matchMedia("(pointer: coarse)").matches) { inputMode = 'touch'; }
    else { inputMode = 'mouse'; }

    if (!loopStarted) {
        loopStarted = true;
        loop();
    }
}

resize();

function createExplosionDebris(cx, cy, count, isHot = false) {
    for (let i = 0; i < count; i++) {
        // Start from center
        const x = cx;
        const y = cy;
        const r = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);

        // Use the existing factory
        const roid = createAsteroid(x, y, r);

        if (isHot) {
            roid.isHot = true;
            roid.color = `hsl(${20 + Math.random() * 30}, 80%, 30%)`; // Reddish/Orange base
        }

        // Project outwards in random direction
        const angle = Math.random() * Math.PI * 2;
        // Random speed, but capped at limit. If hot, make them potentially faster (lava ejection)
        const speedBase = isHot ? ASTEROID_SPEED_LIMIT * 2.0 : ASTEROID_SPEED_LIMIT;
        const speed = Math.random() * speedBase;

        roid.xv = Math.cos(angle) * speed;
        roid.yv = Math.sin(angle) * speed;

        // Add some random rotation speed
        roid.rotSpeed = (Math.random() - 0.5) * 0.2;

        roids.push(roid);
    }
}


