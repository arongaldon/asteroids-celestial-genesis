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

    // Add listener to start audio on the first interaction
    startScreen.addEventListener('click', audioStarter);

    showInfoLEDText("The Classic, reimagined by Aron Galdon. Have a safe trip!")
}

// Function to handle zoom change (used by Z key and Mouse Wheel)
function changeRadarZoom(direction) {
    if (!gameRunning) return;

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

    if (e.code === 'KeyZ' && gameRunning) {
        changeRadarZoom(1); // Zoom Out (next level)
    }

    if (e.code === 'KeyX' && gameRunning) {
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

document.addEventListener('touchstart', (e) => {
    if (!gameRunning) return; // Allow interaction with start screen
    if (e.target.closest('.btn') || e.target.closest('.start-btn')) return;

    inputMode = 'touch';
    isTouching = true;

    // Joystick Anchor
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();

    // Rotate ship to face the tap immediately
    const dx = touchStartX - width / 2;
    const dy = touchStartY - height / 2;
    playerShip.a = Math.atan2(-dy, dx);

    e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (!isTouching || !gameRunning || playerShip.dead) return;
    e.preventDefault();

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
        // Note: dy is screen coordinates (down is positive), but ship angle 0 is Right.
        // We negate dy to match the mathematical atan2 (positive y is up).
        let targetAngle = Math.atan2(-dy, dx);

        // Smooth rotate towards target
        let angleDiff = targetAngle - playerShip.a;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

        playerShip.a += angleDiff * 0.2; // Responsiveness
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!gameRunning) return;
    if (e.target.closest('.btn') || e.target.closest('.start-btn')) return;
    isTouching = false;

    // Short tap => shoot still
    const duration = Date.now() - touchStartTime;
    if (duration < MIN_DURATION_TAP_TO_MOVE) {
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
                r: 35,
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

function fireEntityWeapon(ship, bulletList, isEnemy = true) {
    const isPlayer = (ship === playerShip);
    const tier = isPlayer ? ship.tier : Math.floor(ship.score / SHIP_EVOLUTION_SCORE_STEP);
    const hue = ship.fleetHue !== undefined ? ship.fleetHue : 200;
    const a = isPlayer ? playerShip.a : ship.a;

    const pushBullet = (angleOffset, isPrimary = true) => {
        const shootAngle = a + angleOffset;

        // Strictly force bullet origin to be at the ship's nose (front vertex)
        const visualScale = 1 + (tier * 0.1);
        const spawnRadius = ((ship.effectiveR || ship.r) * visualScale) + 20;

        const fwdX = Math.cos(a);
        const fwdY = Math.sin(a);

        const startX = (isPlayer ? worldOffsetX : ship.x) + (fwdX * spawnRadius);
        const startY = (isPlayer ? worldOffsetY : ship.y) + (fwdY * spawnRadius);

        // Velocity dictates the spread direction
        // Ensure defaults if properties are missing (e.g. legacy saves or weird states)
        const bSpeed = ship.bulletSpeed || 20;
        const bLife = ship.bulletLife || (isPrimary ? SHIP_BULLET1_LIFETIME : SHIP_BULLET2_LIFETIME);
        const bSize = ship.bulletSize || 6;

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

    if (tier >= 12) { // THE GODSHIP: Omni-Destruction
        pushBullet(0, true);
        pushBullet(-0.05, true); pushBullet(0.05, true);
        pushBullet(-0.1, true); pushBullet(0.1, true);
        pushBullet(-0.15, true); pushBullet(0.15, true);
        pushBullet(-0.2, true); pushBullet(0.2, true);
        pushBullet(-0.25, true); pushBullet(0.25, true);
        pushBullet(-0.3, true); pushBullet(0.3, true);
        pushBullet(-0.4, true); pushBullet(0.4, true);
        pushBullet(-0.5, false); pushBullet(0.5, false);
        // Rear guns
        pushBullet(Math.PI, false);
        pushBullet(Math.PI - 0.2, false); pushBullet(Math.PI + 0.2, false);
        pushBullet(Math.PI - 0.1, false); pushBullet(Math.PI + 0.1, false);
    } else if (tier >= 11) { // THE HYPERION: Heavy Front + Rear Guard
        pushBullet(0, true);
        pushBullet(-0.1, false); pushBullet(0.1, false);
        pushBullet(-0.2, false); pushBullet(0.2, false);
        pushBullet(-0.4, false); pushBullet(0.4, false);
        // Rear guns
        pushBullet(Math.PI, false);
        pushBullet(Math.PI - 0.2, false);
        pushBullet(Math.PI + 0.2, false);
    } else if (tier >= 10) { // THE TITAN: Dense Frontal Barrage
        pushBullet(0, true);
        pushBullet(-0.05, false); pushBullet(0.05, false);
        pushBullet(-0.15, false); pushBullet(0.15, false);
        pushBullet(-0.25, false); pushBullet(0.25, false);
        pushBullet(-0.35, false); pushBullet(0.35, false);
    } else if (tier >= 9) { // THE CELESTIAL: Wide Scatter
        pushBullet(0, true);
        pushBullet(-0.1, false);
        pushBullet(0.1, false);
        pushBullet(-0.25, false); // Wider
        pushBullet(0.25, false);
        pushBullet(-0.4, false); // Even Wider
        pushBullet(0.4, false);
    } else if (tier >= 8) { // THE SPHERE
        pushBullet(0, true);
        pushBullet(-0.1, false);
        pushBullet(0.1, false);
        pushBullet(-0.2, false);
        pushBullet(0.2, false);
    } else if (tier >= 4) {
        pushBullet(0, true);
        pushBullet(-0.05, false);
        pushBullet(0.05, false);
    } else if (tier >= 2) {
        pushBullet(0, true);
        pushBullet(0, true);
    } else {
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

    // 2. SCAN FOR ASTEROIDS
    for (let r of roids) {
        if (r.z > 0.5 || r.isPlanet) continue; // Skip distant roids and planets
        const dist = Math.hypot(r.x - e.x, r.y - e.y);
        if (dist < 1500) {
            enemyShoot(e, r.x, r.y);
            if (e.reloadTime > 0) return; // Shot fired
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
    const rW = canvasRadar.width; const rH = canvasRadar.height;
    const cX = rW / 2; const cY = rH / 2;
    canvasRadarContext.clearRect(0, 0, rW, rH);

    const radarRadius = rW / 2;
    const scale = radarRadius / RADAR_RANGE;

    const drawBlip = (worldX, worldY, type, color, size, z = 0) => {
        if (isNaN(worldX) || isNaN(worldY)) return;

        let dx = worldX - worldOffsetX;
        let dy = worldY - worldOffsetY;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > RADAR_RANGE) return;

        let angle = Math.atan2(dy, dx);
        let radarDist = dist * scale;
        let radarSize = (size * scale) / (1 + z);

        // Ensure elements are visible on the radar regardless of zoom
        if (type === 'planet') radarSize = Math.max(4, radarSize);
        else if (type === 'asteroid') radarSize = Math.max(1.5, radarSize);
        else radarSize = Math.max(2, radarSize); // Default minimum for ships/etc

        if (radarDist > radarRadius - radarSize) {
            radarDist = radarRadius - radarSize - 1;
        }

        let rx = cX + radarDist * Math.cos(angle);
        let ry = cY + radarDist * Math.sin(angle);

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

function updateAsteroidCounter() {
    asteroidCount = roids.filter(r => !r.isPlanet).length;
    if (asteroidCountDisplay) {
        asteroidCountDisplay.innerText = asteroidCount;
    }
}

function createAsteroidBelt(cx, cy, innerRadius, outerRadius, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const r = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);
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

    createAsteroidBelt(0, 0, ASTEROID_BELT_INNER_RADIUS, ASTEROID_BELT_OUTER_RADIUS, ASTEROIDS_PER_BELT);

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

function killPlayerShip() {
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
    }, 1500);
    else {
        // HIDE HUD DURING GAME OVER
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'none';

        setTimeout(() => {
            startScreen.style.display = 'flex';
            showInfoLEDText("Rest in eternity.");
            AudioEngine.playGameOverMusic();
            startScreen.addEventListener('click', audioStopper);

            // Reset opacity before fading out during game over
            startScreen.classList.remove('fade-out');
            startScreen.classList.add('game-over');

            setTimeout(() => {
                startScreen.classList.add('fade-out');
                startBtn.style.display = 'block';
                startBtn.innerText = 'RESTART';
                startBtn.onclick = () => {
                    // SHOW HUD FOR RESTART
                    const uiLayer = document.getElementById('ui-layer');
                    if (uiLayer) uiLayer.style.display = 'flex';
                    startScreen.removeEventListener('click', audioStopper);
                    startGame();
                };
            }, 3000);
        }, 3000);

        // Reset loopStarted to allow startGame to re-call loop() if it somehow stopped.
    }
}

const handleVictoryInteraction = () => {
    if (!victoryState) return;

    // Show Congratulations
    showInfoLEDText("CONGRATULATIONS: YOUR PLANET WILL LOVE YOU FOREVER.");
    addScreenMessage("MISSION ACCOMPLISHED!", "#00ff00");
    addScreenMessage("YOU HAVE CLEANED THE SYSTEM.", "#ffff00");

    startScreen.style.display = 'flex';
    startScreen.classList.add('victory');
    startScreen.addEventListener('click', audioStopper); // Allow stopping music
    startBtn.style.display = 'block';
    startBtn.innerText = 'PLAY AGAIN';
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

    // No text or buttons until click/tap
    // Wait a short bit to avoid capturing the click that destroyed the last asteroid
    setTimeout(() => {
        window.addEventListener('mousedown', handleVictoryInteraction);
        window.addEventListener('touchstart', handleVictoryInteraction);
    }, 1000);
}

function updatePhysics() {
    let nearbyGravity = false;

    for (let i = 0; i < roids.length; i++) {
        let r1 = roids[i];
        if (isNaN(r1.x) || isNaN(r1.y)) { roids.splice(i, 1); updateAsteroidCounter(); i--; continue; }

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
            if (r1.zWait > 0) {
                r1.zWait--;
            } else {
                // Movimiento oscilatorio Z
                const previousZ = r1.z;
                r1.z += r1.zSpeed;

                // CHECK FOR STATION RESPAWN ON ARRIVAL (Z near 0)
                // We check if it crossed 0 or is very close and moving towards camera (decreasing Z? No, Z oscillates 0..5)
                // Actually, simple check: If z < 0.1 and we just came from > 0.1? Or just check if z < 0.1 and cooldown.
                // Let's use a flag or simple check.
                if (r1.z < 0.2 && !r1.hasSpawnedStationThisCycle) {
                    // Check if station exists
                    const hasStation = ships.some(e => e.type === 'station' && e.hostPlanetId === r1.id);
                    if (!hasStation) {
                        spawnStation(r1);
                    }
                    r1.hasSpawnedStationThisCycle = true;
                }
                if (r1.z > 1.0) {
                    r1.hasSpawnedStationThisCycle = false; // Reset when far away
                }

                if (r1.z > MAX_Z_DEPTH) r1.zSpeed *= -1;
                if (r1.z < 0) {
                    r1.z = 0;
                    r1.zSpeed = Math.abs(r1.zSpeed);
                    // Stay 3 times more time in default z than in other z distances
                    // Travel time = 2 * MAX_Z_DEPTH / abs(zSpeed)
                    r1.zWait = Math.floor(3 * (2 * MAX_Z_DEPTH / r1.zSpeed));
                }
            }

            // --- PLANET ORBITAL MECHANICS ---
            // Planets move smoothly in continuous orbit sizes over the map.
            // APPLY BUBBLE FRICTION (expands slower and slower)
            if (r1.isBubbleDebris) {
                r1.xv *= r1.bubbleFriction;
                r1.yv *= r1.bubbleFriction;
                if (Math.hypot(r1.xv, r1.yv) < 0.1) r1.isBubbleDebris = false; // Stop bubble effect if too slow
            }

            // The farthest they are in z, the slower they move.

            if (r1.orbitRadius && r1.orbitSpeed) {
                // Calculate speed modifier based on Z depth
                // 1.0 at Z=0, smaller as Z increases. e.g. at Z=4, speed is 1/5.
                const zSpeedModifier = 1 / (1 + r1.z);

                const effectiveSpeed = r1.orbitSpeed * zSpeedModifier;

                // Calculate new position relative to center (0,0)
                const nextAngle = r1.orbitAngle + effectiveSpeed;
                const newX = Math.cos(nextAngle) * r1.orbitRadius;
                const newY = Math.sin(nextAngle) * r1.orbitRadius;

                // Update velocity to take us exactly to newX/newY in the next step
                r1.xv = newX - r1.x;
                r1.yv = newY - r1.y;

                // We update the angle for the next frame
                r1.orbitAngle = nextAngle;
            }
        }

        // Decrease asteroid invulnerability frames
        if (r1.blinkNum > 0) r1.blinkNum--;

        // Decrease asteroid invulnerability frames
        if (r1.blinkNum > 0) r1.blinkNum--;

        // --- NEW: Asteroid Attraction to Nearest Planet & Orbit Logic ---
        // Asteroids (r1) feel attraction to the nearest planet in the "default z" (approx z < 1.0)
        // If they get too close, they start orbiting instead of crashing.
        if (!r1.isPlanet) {
            let nearestPlanet = null;
            let minDistSq = Infinity;

            // Find nearest planet with valid Z
            for (const other of roids) {
                if (other.isPlanet && Math.abs(other.z) < 1.0) {
                    const dSq = (other.x - r1.x) ** 2 + (other.y - r1.y) ** 2;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        nearestPlanet = other;
                    }
                }
            }

            if (nearestPlanet) {
                const dist = Math.sqrt(minDistSq);
                const dx = nearestPlanet.x - r1.x;
                const dy = nearestPlanet.y - r1.y;

                // Define Orbit Parameters
                const orbitRadius = nearestPlanet.r * 1.5 + r1.r; // Distance to orbit at
                const gravityRange = nearestPlanet.r * 8.0; // Range where gravity starts pulling

                if (dist < gravityRange) {
                    if (dist > orbitRadius) {
                        // GRAVITY PULL: Pull towards planet
                        // F = G * M / r^2
                        const forceMagnitude = (G_CONST * nearestPlanet.mass * 8.0) / Math.max(minDistSq, 100);
                        r1.xv += (dx / dist) * forceMagnitude;
                        r1.yv += (dy / dist) * forceMagnitude;
                    } else {
                        // ORBIT CAPTURE: Force velocity to be tangential to create orbit
                        // 1. Calculate tangent direction (perpendicular to radius vector)
                        //    (dx, dy) -> (-dy, dx) is 90 deg rotation
                        const angleToPlanet = Math.atan2(dy, dx);
                        const tangentAngle = angleToPlanet + Math.PI / 2;

                        // 2. Calculate desired orbital speed: v = sqrt(G*M / r)
                        // Boosting G slightly for stability and visual effect
                        const orbitSpeed = Math.sqrt((G_CONST * nearestPlanet.mass * 8.0) / dist);

                        const targetXV = Math.cos(tangentAngle) * orbitSpeed;
                        const targetYV = Math.sin(tangentAngle) * orbitSpeed;

                        // 3. Smoothly blend current velocity towards target orbital velocity (Steering)
                        //    0.1 blending factor gives it some inertia but strong guidance
                        r1.xv += (targetXV - r1.xv) * 0.1;
                        r1.yv += (targetYV - r1.yv) * 0.1;

                        // 4. Distance Correction: Gently push/pull to maintain 'orbitRadius'
                        //    This prevents spiraling in or drifting away too much
                        const distError = dist - orbitRadius;
                        // If dist < orbitRadius (too close), push out (negative error * factor) -> add to pos? No, add to vel away
                        // We want to apply force along radius vector (dx, dy)
                        // If too close (distError < 0), we want force AWAY (-dx, -dy)
                        // If too far (distError > 0), we want force TOWARDS (dx, dy)
                        const correctionForce = distError * 0.005;
                        r1.xv += (dx / dist) * correctionForce;
                        r1.yv += (dy / dist) * correctionForce;
                    }
                }
            }
        }

        // --- Gravity Check on Player (Feathering near center) ---
        if (r1.isPlanet && r1.z < 0.5) { // Solo si el planeta está en el plano cercano
            // dx, dy are the vector from the Planet to the Player (in World Units)
            let dx = worldOffsetX - r1.x;
            let dy = worldOffsetY - r1.y;
            let distSq = dx * dx + dy * dy;
            let dist = Math.sqrt(distSq);

            // Gravedad solo activa en la zona de influencia y fuera del radio de la nave (para evitar atascos)
            if (dist < r1.r * 8 && dist > playerShip.r) {
                nearbyGravity = true;

                // Inverse square law for gravity: F = G * M / D^2
                let clampedDistSq = Math.max(distSq, 100);

                // Feathering factor to smoothly drop force to zero at the ship's center
                let effectiveDist = Math.max(0, dist - playerShip.r);
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
            if (isNaN(r2.x) || isNaN(r2.y)) { roids.splice(j, 1); updateAsteroidCounter(); j--; continue; }

            // Skip collision check if either asteroid is blinking (newly created by player)
            if (r1.blinkNum > 0 || r2.blinkNum > 0) continue;

            let dx = r2.x - r1.x; let dy = r2.y - r1.y; // World Distance Vector
            let distSq = dx * dx + dy * dy; let dist = Math.sqrt(distSq);

            // Gravitational attraction between asteroids when close (for natural merging)
            const attractionRange = (r1.r + r2.r) * 3; // 3x combined radii
            if (dist < attractionRange && dist > 1) {
                // Calculate gravitational force (stronger for larger mass difference)
                const force = (G_CONST * r1.mass * r2.mass) / Math.max(distSq, 100);
                const forceX = (dx / dist) * force * 0.5; // Reduced strength for smooth approach
                const forceY = (dy / dist) * force * 0.5;

                // Apply force to both asteroids (smaller accelerates more toward larger)
                r1.xv += forceX / r1.mass;
                r1.yv += forceY / r1.mass;
                r2.xv -= forceX / r2.mass;
                r2.yv -= forceY / r2.mass;
            }

            // If the distance is less than the sum of the radius, a collision has occurred.
            if (dist < r1.r + r2.r) {
                // Midpoint of the collision
                const midX = (r1.x + r2.x) / 2;
                const midY = (r1.y + r2.y) / 2;

                // Midpoint in Viewport Coords
                const midVpX = midX - worldOffsetX + width / 2;
                const midVpY = midY - worldOffsetY + height / 2;

                // 1. Planet-Planet Collision
                if (r1.isPlanet && r2.isPlanet) {
                    // Only if both are in the same z level
                    if (r1.z == r2.z) {
                        createExplosion(midVpX, midVpY, 80, '#ffaa00', 5, 'spark');
                        createExplosion(midVpX, midVpY, 40, '#ff0000', 8, 'debris');
                        AudioEngine.playPlanetExplosion(midX, midY, r1.z); // Strong sound if visible

                        // many asteroids created
                        const manyAsteroids = ASTEROIDS_PER_BELT; // 1500 asteroids!
                        createExplosionDebris(midX, midY, manyAsteroids);
                        createShockwave(midX, midY);
                        updateAsteroidCounter(); // New asteroids created!

                        // Destroy both planets' stations
                        for (let k = ships.length - 1; k >= 0; k--) {
                            if (ships[k].hostPlanet === r1 || ships[k].hostPlanet === r2) {
                                ships.splice(k, 1);
                            }
                        }

                        roids.splice(j, 1);
                        roids.splice(i, 1);
                        updateAsteroidCounter();
                        i--; break; // Exit j-loop
                    }
                }
                // 2. Planet-Asteroid and Asteroid-Asteroid collisions (only on near Z plane)
                else if (Math.abs(r1.z) < 0.5 && Math.abs(r2.z) < 0.5) {
                    // Planet-Asteroid Coalescence
                    if (r1.isPlanet !== r2.isPlanet) {
                        let planet, asteroid, asteroidIndex;
                        // Determine which is the planet and which is the asteroid
                        if (r1.isPlanet) {
                            planet = r1;
                            asteroid = r2;
                            asteroidIndex = j;
                        } else {
                            planet = r2;
                            asteroid = r1;
                            asteroidIndex = i;
                        }

                        // NEW: "Small asteroids won't crash planets anymore"
                        // Instead of merging, if it's a small asteroid effectively in orbit range, we ignore collision merge.
                        // We define "small" as standard non-planet asteroid sizes.
                        // Planets only consume if they are effectively "Planet Candidates" (huge asteroids)
                        // Standard asteroids allow orbit logic (handled above) to dominate.
                        // We use a safe overlap threshold: if they are DEEP inside, maybe pop them out?
                        // For now, just skip merge.

                        const isSmallAsteroid = asteroid.r < PLANET_THRESHOLD; // Standard asteroids are < 50-60 usually

                        if (isSmallAsteroid) {
                            // SKIP MERGE.
                            // Optional: Push asteroid out if it's literally inside the planet to prevent visual glitching
                            // but the orbit logic tries to keep them at r*1.5. 
                            // If they slam in high speed, bounce them?
                            const angle = Math.atan2(asteroid.y - planet.y, asteroid.x - planet.x);
                            const minDist = planet.r + asteroid.r + 5;
                            asteroid.x = planet.x + Math.cos(angle) * minDist;
                            asteroid.y = planet.y + Math.sin(angle) * minDist;

                            // Reflect velocity (Bounce) to save it from getting stuck
                            asteroid.xv += Math.cos(angle) * 1.0;
                            asteroid.yv += Math.sin(angle) * 1.0;

                            continue; // Skip the rest of the merge block
                        }

                        let area1 = Math.PI * planet.r * planet.r;
                        let area2 = Math.PI * asteroid.r * asteroid.r;
                        let totalArea = area1 + area2;
                        let newR = Math.sqrt(totalArea / Math.PI);

                        // Physics: Transfer momentum and mass
                        let totalMass = planet.mass + asteroid.mass;
                        planet.xv = (planet.xv * planet.mass + asteroid.xv * asteroid.mass) / totalMass;
                        planet.yv = (planet.yv * planet.mass + asteroid.yv * asteroid.mass) / totalMass;
                        planet.x = (planet.x * planet.mass + asteroid.x * asteroid.mass) / totalMass;
                        planet.y = (planet.y * planet.mass + asteroid.y * asteroid.mass) / totalMass;

                        // Smoothly grow to new size
                        planet.targetR = newR;
                        planet.mass = totalMass; // Update mass immediately for gravity

                        roids.splice(asteroidIndex, 1);
                        updateAsteroidCounter();
                        // If we removed the item at 'i', we must adjust 'i' and break
                        if (asteroidIndex === i) {
                            i--;
                            break;
                        } else {
                            // If we removed 'j', just break the j-loop and continue with 'i'
                            break;
                        }
                    }
                    // Asteroid-Asteroid Merge
                    else {
                        let totalMass = r1.mass + r2.mass;
                        let newVX = (r1.xv * r1.mass + r2.xv * r2.mass) / totalMass;
                        let newVY = (r1.yv * r1.mass + r2.yv * r2.mass) / totalMass;
                        let newR = Math.sqrt(r1.r * r1.r + r2.r * r2.r) * 1.05;

                        // Max size for planet growth
                        if (newR > PLANET_MAX_SIZE) newR = PLANET_MAX_SIZE;

                        const DAMPENING_FACTOR = 0.5;
                        if (newR > PLANET_THRESHOLD) { newVX *= DAMPENING_FACTOR; newVY *= DAMPENING_FACTOR; }

                        let newX = (r1.x * r1.mass + r2.x * r2.mass) / totalMass;
                        let newY = (r1.y * r1.mass + r2.y * r2.mass) / totalMass;

                        r1.x = newX; r1.y = newY;
                        r1.xv = newVX; r1.yv = newVY;
                        r1.targetR = newR;

                        if (newR > PLANET_THRESHOLD && !r1.isPlanet) {
                            const currentPlanets = roids.filter(r => r.isPlanet).length;
                            if (currentPlanets < PLANETS_LIMIT) {
                                r1.r = newR;
                                initializePlanetAttributes(r1);
                                r1.targetR = newR;
                                createExplosion(midVpX, midVpY, 30, '#fff', 5);
                            } else {
                                r1.r = newR;
                                r1.targetR = newR;
                            }
                        } else if (r1.isPlanet) {
                            r1.r = newR;
                            r1.mass = totalMass * 0.05;
                        }

                        // NEW: Audio feedback for asteroid fusion
                        if (newR <= PLANET_THRESHOLD) {
                            AudioEngine.playSoftThud(midX, midY, r1.z); // Soft sound for merge
                        }

                        roids.splice(j, 1); j--;
                        updateAsteroidCounter();
                        continue;
                    }
                }
            }

            // --- Gravitational Attraction between Roids/Planets (World Coords) ---
            if (r1.blinkNum === 0 && r2.blinkNum === 0 && dist > 10) {
                let force = 0;
                let G = G_CONST;

                // SPECIAL: Planet acting on Asteroid
                if (r1.isPlanet || r2.isPlanet) {
                    // Generic planet-planet or deep-z gravity (weaker)
                    // (Legacy code for distant planets)
                    force = (G * r1.mass * r2.mass) / Math.max(distSq, 500);
                    let fx = (dx / dist) * force;
                    let fy = (dy / dist) * force;
                    // Planets are on rails, so we generally ignore this for them, 
                    // but it might affect calculations if we ever un-rail them.
                } else {
                    // Asteroid-Asteroid Gravity
                    // Gravedad más fuerte y rango cercano más agresivo (in previous turn, maintained)
                    let G_ROIDS = 0.08;
                    force = (G_ROIDS * r1.mass * r2.mass) / Math.max(distSq, 400);

                    let fx = (dx / dist) * force;
                    let fy = (dy / dist) * force;

                    if (!isNaN(fx) && !isNaN(fy)) {
                        r1.xv += fx / r1.mass;
                        r1.yv += fy / r1.mass;
                        r2.xv -= fx / r2.mass;
                        r2.yv -= fy / r2.mass;
                    }
                }
            } // End of r2 loop
        } // End of interaction section

        // --- Speed Limit and Boundary Correction ---
        const speed = Math.hypot(r1.xv, r1.yv);
        if (speed > ASTEROID_SPEED_LIMIT) {
            const ratio = ASTEROID_SPEED_LIMIT / speed;
            r1.xv *= ratio;
            r1.yv *= ratio;
        }

        // Steer back to center if near boundary
        if (Math.abs(r1.x) > WORLD_BOUNDS - BOUNDARY_TOLERANCE_ROIDS) {
            r1.xv -= Math.sign(r1.x) * BOUNDARY_CORRECTION_FORCE;
        }
        if (Math.abs(r1.y) > WORLD_BOUNDS - BOUNDARY_TOLERANCE_ROIDS) {
            r1.yv -= Math.sign(r1.y) * BOUNDARY_CORRECTION_FORCE;
        }

        // Basic Avoidance for fast objects
        for (let j = 0; j < roids.length; j++) {
            if (i === j) continue;
            const r2 = roids[j];
            const dx = r2.x - r1.x;
            const dy = r2.y - r1.y;
            const distSq = dx * dx + dy * dy;
            const combinedR = r1.r + r2.r;
            if (distSq < (combinedR * 2) ** 2) {
                const speed2 = Math.hypot(r2.xv, r2.yv);
                if (speed2 > ASTEROID_SPEED_LIMIT * 0.8) {
                    const dist = Math.sqrt(distSq);
                    const force = 0.1;
                    r1.xv -= (dx / dist) * force;
                    r1.yv -= (dy / dist) * force;
                }
            }
        }
    } // End of r1 loop
} // End of updatePhysics function

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
    if (!gameRunning) return;

    // killPlayerShip is handled in hitShip and collision logic.
    // Calling it here every frame causes a recursion bug during Game Over.

    // Decrement player reload timer
    if (playerReloadTime > 0) playerReloadTime--;

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

    // Clear canvas
    canvasContext.fillStyle = '#010103'; canvasContext.fillRect(0, 0, width, height);
    canvasContext.save();

    // In touch mode, zoom out to see more of the world
    // Also zoom out during game over and victory to show ~50% of map
    let targetScale = SCALE_IN_MOUSE_MODE;

    if (inputMode === 'touch') {
        targetScale = SCALE_IN_TOUCH_MODE;
    } else if ((playerShip.dead && playerShip.lives <= 0) || victoryState) {
        // Zoom out to show ~75% of the map during game over/victory
        targetScale = Math.max(0.08, Math.min(width, height) / (WORLD_BOUNDS * 0.75));
    }

    viewScale += (targetScale - viewScale) * 0.001;

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

        // Apply braking/friction
        if (keys.ArrowDown) { velocity.x *= 0.92; velocity.y *= 0.92; }
        else { velocity.x *= FRICTION; velocity.y *= FRICTION; }

        // Limit max speed
        const currentSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (currentSpeed > SHIP_MAX_SPEED) { const ratio = SHIP_MAX_SPEED / currentSpeed; velocity.x *= ratio; velocity.y *= ratio; }

        // 3. Update Player's World Position (worldOffsetX/Y)
        let nextWorldX = worldOffsetX + velocity.x;
        let nextWorldY = worldOffsetY + velocity.y;

        let shadow = [];
        const SHADOW_SIZE = 50; // Size of the inset shadow border

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
    }

    // --- Shockwave Update (All in World Coords) ---
    shockwaves.forEach((sw, index) => {
        sw.r += 15; sw.alpha -= 0.01;
        if (sw.alpha <= 0) { shockwaves.splice(index, 1); return; }

        // Calculate Viewport Position for drawing
        const vpX = sw.x - worldOffsetX + width / 2;
        const vpY = sw.y - worldOffsetY + height / 2;

        canvasContext.beginPath(); canvasContext.arc(vpX, vpY, sw.r, 0, Math.PI * 2);
        canvasContext.strokeStyle = `rgba(255, 200, 50, ${sw.alpha})`; canvasContext.lineWidth = 5; canvasContext.stroke();

        // Apply force to asteroids, ships, and player (Force is World Units)
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
        ships.forEach(applyShockwaveForce);

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

        const cullRange = WORLD_BOUNDS * 1.5;
        // CULLING: Only cull ships, NOT stations
        if (ship.type !== 'station' && Math.hypot(ship.x - worldOffsetX, ship.y - worldOffsetY) > cullRange) {
            ships.splice(i, 1);
            continue;
        }

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

        ship.x += ship.xv;
        ship.y += ship.yv;

        // Calculate Viewport Position for drawing (WITH PARALLAX)
        let depthScale = 1;
        if (ship.z > 0) {
            depthScale = 1 / (1 + ship.z);
        }

        const vpX = (ship.x - worldOffsetX) * depthScale + width / 2;
        const vpY = (ship.y - worldOffsetY) * depthScale + height / 2;

        for (let k = 0; k < roids.length; k++) {
            let r = roids[k];
            if (r.z > 0.5) continue;

            if ((ship.type === 'station' && ship.hostPlanetId && r.id === ship.hostPlanetId) || ship.blinkNum > 0) {
                continue; // Skip collision check for the orbital anchor or if blinking
            }

            let dx = ship.x - r.x; let dy = ship.y - r.y; // World Distance Vector
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = ship.r + r.r;

            if (dist < minDist) {
                // COLLISION CHECK Z-FILTER: Ignore if station/enemy is far away
                if (ship.z > 0.5) continue;

                // Ships (and player) pass through planets
                if (r.isPlanet) continue;

                let angle = Math.atan2(dy, dx);
                let overlap = minDist - dist;

                ship.x += Math.cos(angle) * overlap;
                ship.y += Math.sin(angle) * overlap;

                ship.xv += Math.cos(angle) * 2;
                ship.yv += Math.sin(angle) * 2;

                // Collision Effects
                ship.structureHP--;
                ship.shieldHitTimer = 10;
                const rVpX = r.x - worldOffsetX + width / 2;
                const rVpY = r.y - worldOffsetY + height / 2;
                createExplosion(rVpX, rVpY, 5, '#aa00ff', 1, 'debris');
                if (ship.structureHP <= 0) {
                    createExplosion(vpX, vpY, 30, '#ffaa00', 3, 'spark');
                    ship.dead = true; // Mark as dead so references know
                    ships.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
        if (i < 0) continue;

        let threat = null; let minThreatDist = Infinity;
        // Don't set player as threat if dead
        // (threat will remain null if player is dead and no asteroids are close)

        // Check for closer asteroid threats (avoidance), but prioritize player if somewhat close?
        for (let r of roids) {
            if (r.z > 0.5) continue;
            let d = Math.hypot(ship.x - r.x, r.y - r.y);
            // Only switch threat to asteroid if it is REALLY close (imminent danger)
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
                for (let r of roids) {
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
                proactiveCombatScanner(ship);

                if (ship.isFriendly && !playerShip.dead && ship.leaderRef === playerShip) {
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
                    for (let r of roids) {
                        if (r.z > 0.5 || r.isPlanet) continue; // Planets are ignored (fly through/over)
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
                } else if (ship.role === 'leader') {
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
                } else if (ship.role === 'wingman') {
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

                            // DISSOLVE SQUAD LOGIC:
                            // DISABLED per user request: "Only too near asteroids... would make necessary to leave a squad."
                            // We still keep the separation force to prevent total overlapping, but we don't break the squad link.
                            /*
                            if (sepCount > 2 && !isInVisualSlot) {
                                if (ship.leaderRef) { ... }
                                ship.leaderRef = null;
                                ship.role = 'free';
                                ship.xv += (Math.random() - 0.5) * 5;
                                ship.yv += (Math.random() - 0.5) * 5;
                            }
                            */
                        }

                        // Rotation logic: friendly ships only match rotation when following player
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
                if (currentSpeed > SHIP_MAX_SPEED) {
                    let scale = SHIP_MAX_SPEED / currentSpeed;
                    ship.xv *= scale;
                    ship.yv *= scale;
                }

                // Shoot if lined up (slightly wider angle for smoother shooting feel)
                if (ship.reloadTime <= 0 && Math.abs(angleDiff) < 0.4) {
                    fireEntityWeapon(ship, enemyShipBullets, true);
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
                                fireEntityWeapon(ship, enemyShipBullets, true);
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
                    if (ship.type === 'station') { onStationDestroyed(ship); }
                    else { onShipDestroyed(ship); }
                    ships.splice(i, 1); i--; AudioEngine.playExplosion('large', ship.x, ship.y, ship.z);
                    continue; // Ship is gone, don't draw
                }
            }
        }

        shipsToDraw.push(ship);

    }
    // --- End Enemy Update/AI ---

    canvasContext.shadowColor = '#ffffff'; canvasContext.strokeStyle = 'white'; canvasContext.lineWidth = 1.5;

    // Ordenar los asteroides de Cercano a Lejano (Z baja a Z alta)
    roids.sort((a, b) => a.z - b.z);

    // --- Asteroid/Planet DRAWING (Order 1: Behind ships) ---
    for (let i = roids.length - 1; i >= 0; i--) {
        let r = roids[i];

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

        // CULLING LOGIC: Remove object if far from player
        // REMOVED: Asteroids and planets won't disappear from the map.
        /*
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
        */

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
            canvasContext.shadowBlur = 10; canvasContext.shadowColor = 'white'; canvasContext.strokeStyle = 'white';
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

                    const newSize = r.r * 0.6;
                    if (newSize > ASTEROID_MIN_SIZE) {

                        // West asteroid
                        let westAst = createAsteroid(r.x - ASTEROID_SPLIT_OFFSET, r.y, newSize);
                        westAst.xv = r.xv - ASTEROID_SPLIT_SPEED;
                        westAst.yv = r.yv;
                        westAst.blinkNum = 30;
                        roids.push(westAst);

                        // East asteroid
                        let eastAst = createAsteroid(r.x + ASTEROID_SPLIT_OFFSET, r.y, newSize);
                        eastAst.xv = r.xv + ASTEROID_SPLIT_SPEED;
                        eastAst.yv = r.yv;
                        eastAst.blinkNum = 30;
                        roids.push(eastAst);
                        updateAsteroidCounter();
                    }

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

                // Normalization scale to match hit radius
                const norm = 0.6;

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
                // STANDARD EVOLVING SHIP (Tiers 0-7)
                // Shape evolves with individual score (Triangle -> Square -> ...)
                let sides = 3 + tier;
                canvasContext.beginPath();
                for (let i = 0; i <= sides; i++) {
                    let ang = i * (2 * Math.PI / sides);
                    let rad = r * (1 + tier * 0.1);
                    if (i === 0) canvasContext.moveTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                    else canvasContext.lineTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                }
                canvasContext.closePath();

                let chassisGrad = canvasContext.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                chassisGrad.addColorStop(0, DETAIL_COLOR);
                chassisGrad.addColorStop(1, HULL_COLOR);

                canvasContext.fillStyle = chassisGrad; canvasContext.fill();
                canvasContext.lineWidth = 2; canvasContext.strokeStyle = HULL_BORDER; canvasContext.stroke();

                // Side Detail
                canvasContext.fillStyle = `hsl(${shipToDraw.fleetHue}, 60%, 20%)`; // Darker detail
                canvasContext.fillRect(-r * 0.5, -r * 0.2, r * 0.3, r * 0.4);

                // Wing/Stripe
                canvasContext.strokeStyle = DETAIL_COLOR; canvasContext.lineWidth = 1.5;
                canvasContext.beginPath();
                canvasContext.moveTo(-r * 0.6, -r * 0.3); canvasContext.bezierCurveTo(-r * 0.2, 0, 0, r * 0.2, r * 0.4, r * 0.3); canvasContext.stroke();

                // Engine Node
                canvasContext.beginPath();
                canvasContext.arc(-r * 0.2, r * 0.3, r * 0.1, 0, Math.PI * 2);
                canvasContext.fillStyle = `hsl(${shipToDraw.fleetHue}, 40%, 20%)`; canvasContext.fill(); canvasContext.strokeStyle = HULL_BORDER; canvasContext.stroke();

                // Cockpit
                let cockpitGrad = canvasContext.createRadialGradient(r * 0.4, 0, 2, r * 0.4, 0, r * 0.25);
                cockpitGrad.addColorStop(0, COCKPIT_GRAD_1); cockpitGrad.addColorStop(1, COCKPIT_GRAD_2);
                canvasContext.fillStyle = cockpitGrad;
                canvasContext.beginPath(); canvasContext.ellipse(r * 0.4, 0, r * 0.2, r * 0.12, 0, 0, Math.PI * 2); canvasContext.fill();

                // Thrust
                canvasContext.shadowColor = THRUST_COLOR; canvasContext.strokeStyle = THRUST_COLOR; canvasContext.lineWidth = 2;
                canvasContext.beginPath();
                const rX = -r; const rY = 0;
                canvasContext.moveTo(rX, rY);
                // Engine flicker
                canvasContext.lineTo(rX - 20 * Math.cos((Math.random() - 0.5) * 0.5), rY + 20 * Math.sin((Math.random() - 0.5) * 0.5));
                canvasContext.stroke();
                canvasContext.fillStyle = THRUST_COLOR;
                canvasContext.beginPath(); canvasContext.arc(rX - 5, 0, 5, 0, Math.PI * 2); canvasContext.fill();
            }
            // DRAW HEART FOR FRIENDS
            if (shipToDraw.isFriendly) {
                drawHeart(canvasContext, 0, -5, 8);
            }
        }
        else {
            const haloColor = `hsl(${shipToDraw.fleetHue}, 100%, 70%)`;
            const bodyColor = `hsl(${shipToDraw.fleetHue}, 80%, 50%)`;
            const coreColor = `hsl(${(shipToDraw.fleetHue + 120) % 360}, 100%, 60%)`;

            canvasContext.shadowColor = haloColor;
            canvasContext.lineWidth = 3;

            // Outer Ring (Halo)
            canvasContext.strokeStyle = haloColor;
            canvasContext.beginPath();
            canvasContext.arc(0, 0, shipToDraw.r * 1.1, 0, Math.PI * 2);
            canvasContext.stroke();

            // Inner Ring (Torus Body)
            canvasContext.lineWidth = 5;
            canvasContext.strokeStyle = bodyColor;
            canvasContext.beginPath();
            canvasContext.arc(0, 0, shipToDraw.r * 0.8, 0, Math.PI * 2);
            canvasContext.stroke();

            // Center Core/Hub
            canvasContext.fillStyle = coreColor;
            canvasContext.beginPath();
            canvasContext.arc(0, 0, shipToDraw.r * 0.3, 0, Math.PI * 2);
            canvasContext.fill();

            // DRAW HEART FOR FRIENDLY STATIONS
            if (shipToDraw.isFriendly) {
                drawHeart(canvasContext, 0, -shipToDraw.r * 0.1, shipToDraw.r * 0.2);
            }

            // Connecting Spokes
            canvasContext.lineWidth = 1;
            canvasContext.strokeStyle = '#00ffff';
            for (let k = 0; k < 4; k++) {
                const angle = k * (Math.PI / 2) + shipToDraw.a;
                const rInner = shipToDraw.r * 0.35;
                const rOuter = shipToDraw.r * 0.75;
                canvasContext.beginPath();
                canvasContext.moveTo(rInner * Math.cos(angle), rInner * Math.sin(angle));
                canvasContext.lineTo(rOuter * Math.cos(angle), rOuter * Math.sin(angle));
                canvasContext.stroke();
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

            // --- Drawing logic for Ship Tiers (unchanged) ---
            if (tier >= 8) {
                const HULL_COLOR = '#1A1A1A'; const HULL_BORDER = '#333333';
                const DETAIL_GRAY = '#666666'; const ACCENT_RED = '#FF4444';
                const THRUST_COLOR = '#0088FF';

                // Normalization scale to match Tier 7 visual radius (approx 1/1.7)
                const norm = 0.6;

                canvasContext.shadowBlur = 20; canvasContext.shadowColor = THRUST_COLOR;
                canvasContext.beginPath();
                canvasContext.moveTo(r * 1.6 * norm, 0);
                canvasContext.lineTo(r * 0.5 * norm, r * 1.5 * norm); canvasContext.lineTo(-r * 1.2 * norm, r * 0.8 * norm);
                canvasContext.lineTo(-r * 1.8 * norm, r * 0.4 * norm); canvasContext.lineTo(-r * 1.8 * norm, -r * 0.4 * norm);
                canvasContext.lineTo(-r * 1.2 * norm, -r * 0.8 * norm); canvasContext.lineTo(r * 0.5 * norm, -r * 1.5 * norm);
                canvasContext.closePath();
                canvasContext.fillStyle = HULL_COLOR; canvasContext.fill();
                canvasContext.lineWidth = 2; canvasContext.strokeStyle = HULL_BORDER; canvasContext.stroke();
                canvasContext.shadowBlur = 0; canvasContext.fillStyle = DETAIL_GRAY;
                canvasContext.beginPath(); canvasContext.moveTo(r * 1.6 * norm, 0); canvasContext.lineTo(r * 1.4 * norm, r * 0.1 * norm); canvasContext.lineTo(r * 1.4 * norm, -r * 0.1 * norm); canvasContext.closePath(); canvasContext.fill();
                canvasContext.fillStyle = DETAIL_GRAY;
                canvasContext.fillRect(r * 0.2 * norm, r * 0.5 * norm, r * 0.3 * norm, r * 0.2 * norm); canvasContext.fillRect(r * 0.2 * norm, -r * 0.7 * norm, r * 0.3 * norm, r * 0.2 * norm);
                canvasContext.fillStyle = ACCENT_RED; canvasContext.beginPath(); canvasContext.arc(-r * 0.5 * norm, 0, r * 0.2 * norm, 0, Math.PI * 2); canvasContext.fill();
                canvasContext.shadowBlur = 30; canvasContext.shadowColor = THRUST_COLOR;
                const EXHAUST_H = r * 0.7 * norm; const EXHAUST_X = -r * 1.8 * norm;
                canvasContext.fillStyle = HULL_BORDER; canvasContext.fillRect(EXHAUST_X, -EXHAUST_H / 2, 5, EXHAUST_H);
                if (playerShip.thrusting) {
                    canvasContext.fillStyle = `rgba(0, 136, 255, ${0.5 + Math.random() * 0.5})`;
                    canvasContext.beginPath(); canvasContext.moveTo(EXHAUST_X + 5, -EXHAUST_H / 2); canvasContext.lineTo(EXHAUST_X + 5, EXHAUST_H / 2);
                    canvasContext.lineTo(EXHAUST_X - 25 * norm * (0.8 + Math.random() * 0.4), 0); canvasContext.closePath(); canvasContext.fill();
                }
                canvasContext.shadowBlur = 0;
            } else {
                let sides = 3 + tier;
                canvasContext.beginPath();
                for (let i = 0; i <= sides; i++) {
                    let ang = i * (2 * Math.PI / sides);
                    let rad = r;
                    if (i === 0) canvasContext.moveTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                    else canvasContext.lineTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                }
                canvasContext.closePath();
                let chassisGrad = canvasContext.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                chassisGrad.addColorStop(0, '#0055aa');
                chassisGrad.addColorStop(1, '#002244');
                canvasContext.fillStyle = chassisGrad; canvasContext.fill();
                canvasContext.lineWidth = 2; canvasContext.strokeStyle = '#0088ff'; canvasContext.stroke();
                canvasContext.fillStyle = '#003366';
                canvasContext.fillRect(-r * 0.5, -r * 0.2, r * 0.3, r * 0.4);
                canvasContext.strokeStyle = '#004488'; canvasContext.lineWidth = 1.5;
                canvasContext.beginPath();
                canvasContext.moveTo(-r * 0.6, -r * 0.3); canvasContext.bezierCurveTo(-r * 0.2, 0, 0, r * 0.2, r * 0.4, r * 0.3); canvasContext.stroke();
                canvasContext.beginPath();
                canvasContext.arc(-r * 0.2, r * 0.3, r * 0.1, 0, Math.PI * 2);
                canvasContext.fillStyle = '#002233'; canvasContext.fill(); canvasContext.strokeStyle = '#005577'; canvasContext.stroke();
                let cockpitGrad = canvasContext.createRadialGradient(r * 0.4, 0, 2, r * 0.4, 0, r * 0.25);
                cockpitGrad.addColorStop(0, '#aaffff'); cockpitGrad.addColorStop(1, '#00ffff');
                canvasContext.fillStyle = cockpitGrad;
                canvasContext.beginPath(); canvasContext.ellipse(r * 0.4, 0, r * 0.2, r * 0.12, 0, 0, Math.PI * 2); canvasContext.fill();
                if (playerShip.thrusting) {
                    canvasContext.shadowColor = '#ffaa00'; canvasContext.strokeStyle = '#ffaa00'; canvasContext.lineWidth = 2;
                    canvasContext.beginPath();
                    const rX = -r; const rY = 0;
                    canvasContext.moveTo(rX, rY);
                    canvasContext.lineTo(rX - 20 * Math.cos((Math.random() - 0.5) * 0.5), rY + 20 * Math.sin((Math.random() - 0.5) * 0.5));
                    canvasContext.stroke();
                    canvasContext.fillStyle = '#ff5500';
                    canvasContext.beginPath(); canvasContext.arc(rX - 5, 0, 5, 0, Math.PI * 2); canvasContext.fill();
                }
            }
            canvasContext.restore();
        }
        if (playerShip.blinkNum > 0) playerShip.blinkNum--;
        canvasContext.restore(); // POP 1: Restore state after ship block
    }

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

                    const newSize = r.r * 0.6;
                    if (newSize > ASTEROID_MIN_SIZE) {
                        const bulletAngle = Math.atan2(enemyShipBullet.yv, enemyShipBullet.xv);
                        const perpAngle1 = bulletAngle + Math.PI / 2;
                        const perpAngle2 = bulletAngle - Math.PI / 2;

                        let frag1 = createAsteroid(r.x + Math.cos(perpAngle1) * ASTEROID_SPLIT_OFFSET, r.y + Math.sin(perpAngle1) * ASTEROID_SPLIT_OFFSET, newSize);
                        frag1.xv = r.xv + Math.cos(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.yv = r.yv + Math.sin(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.blinkNum = 30;
                        roids.push(frag1);

                        let frag2 = createAsteroid(r.x + Math.cos(perpAngle2) * ASTEROID_SPLIT_OFFSET, r.y + Math.sin(perpAngle2) * ASTEROID_SPLIT_OFFSET, newSize);
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

                    const newSize = r.r * 0.6;
                    if (newSize > ASTEROID_MIN_SIZE) {
                        const bulletAngle = Math.atan2(playerShipBullet.yv, playerShipBullet.xv);
                        const perpAngle1 = bulletAngle + Math.PI / 2;
                        const perpAngle2 = bulletAngle - Math.PI / 2;

                        let frag1 = createAsteroid(r.x + Math.cos(perpAngle1) * ASTEROID_SPLIT_OFFSET, r.y + Math.sin(perpAngle1) * ASTEROID_SPLIT_OFFSET, newSize);
                        frag1.xv = r.xv + Math.cos(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.yv = r.yv + Math.sin(perpAngle1) * ASTEROID_SPLIT_SPEED;
                        frag1.blinkNum = 30;
                        roids.push(frag1);

                        let frag2 = createAsteroid(r.x + Math.cos(perpAngle2) * ASTEROID_SPLIT_OFFSET, r.y + Math.sin(perpAngle2) * ASTEROID_SPLIT_OFFSET, newSize);
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
            if (ship.isFriendly && !playerShip.loneWolf) {
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

        canvasContext.shadowColor = p.color; canvasContext.fillStyle = p.color; canvasContext.globalAlpha = p.life / 60;
        canvasContext.beginPath();
        if (p.type === 'debris') canvasContext.fillRect(vpX, vpY, p.size, p.size); else canvasContext.arc(vpX, vpY, p.size, 0, Math.PI * 2);
        canvasContext.fill(); canvasContext.globalAlpha = 1;

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

    startScreen.style.display = 'none'; level = 0; homePlanetId = null; screenMessages = [];

    // startScreen.classList.remove('game-over-bg');
    fadeOverlay.style.background = 'rgba(0, 0, 0, 0)';

    velocity = { x: 0, y: 0 };
    worldOffsetX = 0; // NEW: Reset world position on start
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

    drawLives(); // NEW: Initial draw
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

function createExplosionDebris(cx, cy, count) {
    for (let i = 0; i < count; i++) {
        // Start from center
        const x = cx;
        const y = cy;
        const r = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);

        // Use the existing factory
        const roid = createAsteroid(x, y, r);

        // Project outwards in random direction
        const angle = Math.random() * Math.PI * 2;
        // Random speed, but capped at limit
        const speed = Math.random() * ASTEROID_SPEED_LIMIT;

        roid.xv = Math.cos(angle) * speed;
        roid.yv = Math.sin(angle) * speed;

        // Add some random rotation speed
        roid.rotSpeed = (Math.random() - 0.5) * 0.1;

        roids.push(roid);
    }
}
