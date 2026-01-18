/* =========================================
   GAME INITIALIZATION & CALLBACKS
   ========================================= */

function onStationDestroyed(station) {
    ship.shield = ship.maxShield; // Restore shield
    score += 500;
    stationsDestroyedCount++;
    lives++; // Always grant life
    drawLives();

    // Reward: Full Repair
    const tier = getShipTier();
    ship.structureHP = tier >= 8 ? MAX_TIER_HP : STANDARD_SHIP_HP;
    ship.shield = ship.maxShield;

    // Initial reward logic (score, etc) kept below, removing duplicate lives logic from here 
    // since we do it every time now? Or user said "Each time I destroy a station".
    // So yes, every time.


    // Spawn 4 minimum size asteroids in 4 directions
    if (station) {
        const directions = [
            { xv: 0, yv: -20 }, // North
            { xv: 20, yv: 0 },  // East
            { xv: 0, yv: 20 },  // South
            { xv: -20, yv: 0 }  // West
        ];

        directions.forEach(dir => {
            const offset = 100; // Spawn offset distance
            const roid = createAsteroid(
                station.x + (dir.xv !== 0 ? Math.sign(dir.xv) * offset : 0),
                station.y + (dir.yv !== 0 ? Math.sign(dir.yv) * offset : 0),
                50
            );
            roid.xv = dir.xv;
            roid.yv = dir.yv;
            roids.push(roid);
        });
    }
}



/* =========================================
   GAME CODE
   ========================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

const scoreEl = document.getElementById('scoreEl');
const livesDisplay = document.getElementById('lives-display');
const startScreen = document.getElementById('start-screen');
const audioPrompt = document.getElementById('audio-prompt');
const gestureHint = document.getElementById('gesture-hint');
const gravityAlert = document.getElementById('gravity-alert');
const startBtn = document.getElementById('start-btn');
const boundaryAlertEl = document.getElementById('boundary-alert');
const fadeOverlay = document.getElementById('fade-overlay');

/* Game state is initialized in core.js */

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

/* animateLedText moved to core.js */


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

    // Hide gesture hint if keyboard is used on desktop
    if (inputMode === 'mouse' && window.innerWidth > 768) { gestureHint.style.opacity = '0'; }
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
    if (gameRunning) { gestureHint.innerText = ""; }
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


// Button setup removed
// setupBtn('btn-thrust', 'ArrowUp'); setupBtn('btn-brake', 'ArrowDown');

let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchStartTime = 0;

document.addEventListener('touchstart', (e) => {
    // Virtual Joystick & Tap to Shoot
    if (e.target.closest('.btn')) return;

    inputMode = 'touch';
    isTouching = true;

    // Joystick Anchor
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();

    // Start Accelerating immediately
    keys.ArrowUp = true;

    gestureHint.style.opacity = '1';
    gestureHint.innerText = "MOVE FINGER TO STEER / RELEASE TO SHOOT";
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (!isTouching || !gameRunning || ship.dead) return;
    e.preventDefault();

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;

    // Deadzone to prevent jitter
    if (Math.hypot(dx, dy) > 10) {
        // Steer towards the drag vector
        // Note: dy is screen coordinates (down is Is positive), but ship angle 0 is Right.
        // If I drag UP (negative dy), atan2 gives negative angle -> Correct for screen.
        let targetAngle = Math.atan2(dy, dx);

        // Smooth rotate towards target
        let angleDiff = targetAngle - ship.a;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

        ship.a += angleDiff * 0.2; // Responsiveness
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    isTouching = false;
    keys.ArrowUp = false; // Stop Accelerating

    // Tap Detection (Short press + no big movement)
    // We didn't track total movement, but if touches list is empty, we can assume tap if short time?
    const duration = Date.now() - touchStartTime;
    if (duration < 200) {
        shootLaser();
    }
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

/* Ship factories moved to core.js */

function spawnStation(hostPlanet = null) {
    if (!hostPlanet) {
        const nearbyPlanets = roids.filter(r => r.isPlanet);
        if (nearbyPlanets.length === 0) {
            console.log("No near planets available for station spawn. Retrying soon.");
            stationSpawnTimer = 300;
            return;
        }
        // Select a random planet to host the station
        hostPlanet = nearbyPlanets[Math.floor(Math.random() * nearbyPlanets.length)];
    }

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
        z: 0, // Always at default Z-depth for radar visibility
        hostPlanetId: hostPlanet.id // Store ID instead of reference
    });
    stationSpawnTimer = 600 + Math.random() * 300;
    console.log(`Station spawned at planet ${hostPlanet.name}`);
}

function spawnEnemySquad(station) {
    // Spawns a V-formation squad: 1 Leader + 6 Wingmen relative to station
    const squadId = Math.random(); // Unique ID for this squad

    // Define V-Formation Offsets (Relative to Leader's rotation)
    // { x, y } where x is sideways (right+), y is backwards (back+)
    const formationData = [
        { role: 'leader', x: 0, y: 0 },
        { role: 'wingman', x: -40, y: -40 }, { role: 'wingman', x: 40, y: -40 },
        { role: 'wingman', x: -80, y: -80 }, { role: 'wingman', x: 80, y: -80 },
        { role: 'wingman', x: -120, y: -120 }, { role: 'wingman', x: 120, y: -120 }
    ];

    const spawnDist = station.r * 2.0;
    const spawnAngle = Math.random() * Math.PI * 2;
    // Initial Squad Position
    const squadX = station.x + Math.cos(spawnAngle) * spawnDist;
    const squadY = station.y + Math.sin(spawnAngle) * spawnDist;

    let leader = null;

    formationData.forEach(slot => {
        let e = {
            type: 'ship',
            role: slot.role,
            squadId: squadId,
            formationOffset: { x: slot.x, y: slot.y },
            leaderRef: null, // Wingmen will hold reference to leader
            x: squadX + slot.x, // Initial placement (simplified)
            y: squadY + slot.y,
            xv: station.xv,
            yv: station.yv,
            r: 35,
            a: spawnAngle + Math.PI, // Face away from station initially
            structureHP: STANDARD_SHIP_HP,
            shieldHitTimer: 0,
            reloadTime: 100 + Math.random() * 100,
            mass: 30,
            fleetHue: station.fleetHue,
            blinkNum: 30,
            z: 0,
            aiState: 'FORMATION', // Valid states: 'FORMATION', 'COMBAT'

            // INDIVIDUAL EVOLUTION
            score: 0 // Earn points to evolve
        };

        if (slot.role === 'leader') {
            leader = e;
        } else {
            e.leaderRef = leader;
        }

        enemies.push(e);
    });
}

/* Entity factories moved to core.js */

function shootLaser() {
    if (!gameRunning || ship.dead) return;

    // 1. Cooldown Check
    if (playerReloadTime > 0) {
        return;
    }
    playerReloadTime = PLAYER_RELOAD_TIME_MAX; // Set cooldown

    const tier = getShipTier();
    AudioEngine.playLaser(worldOffsetX, worldOffsetY, tier); // SFX SHOOT, pass tier

    // Pass tier to bullet creation for visuals/logic
    if (tier >= 8) {
        bullets.push(createBullet(0, 0, 0, true, tier)); // Center
        bullets.push(createBullet(-0.1, -15, -5, false, tier)); // Left
        bullets.push(createBullet(0.1, 15, -5, false, tier)); // Right
        bullets.push(createBullet(-0.2, -30, -10, false, tier)); // Far Left
        bullets.push(createBullet(0.2, 30, -10, false, tier)); // Far Right
    } else if (tier >= 4) {
        bullets.push(createBullet(0, 0, 0, true, tier));
        bullets.push(createBullet(-0.05, -10, 0, false, tier));
        bullets.push(createBullet(0.05, 10, 0, false, tier));
    } else if (tier >= 2) {
        bullets.push(createBullet(0, 5, 0, true, tier));
        bullets.push(createBullet(0, -5, 0, true, tier));
    } else {
        bullets.push(createBullet(0, 0, 0, true, tier));
    }

    // --- ASTEROID EXPULSION LOGIC REMOVED ---
}

function enemyShoot(e, tx, ty) {
    // e.x, e.y, tx, ty are ABSOLUTE WORLD COORDINATES

    if (tx === undefined) tx = worldOffsetX;
    if (ty === undefined) ty = worldOffsetY;

    let trajectoryAngle = Math.atan2(ty - e.y, tx - e.x); // Correct angle in world space

    let angleDiff = trajectoryAngle - e.a;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

    const FIRE_CONE = Math.PI / 12; // 15 grados en radianes

    if (Math.abs(angleDiff) > FIRE_CONE) {
        // El objetivo está fuera del cono frontal de fuego, NO DISPARAR.
        return;
    }

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

/* Explosion and Shockwave moved to core.js */

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
        // RADAR FILTER: Only show default Z level
        if (e.z > 0.1) return;

        if (e.type === 'station') {
            drawBlip(e.x, e.y, 'station', '#FF0000', 0);
        } else {
            drawBlip(e.x, e.y, 'ship', '#FF0000', 2);
        }
    });

    // Dibuja asteroides y planetas (Objetos)
    roids.forEach(r => {
        // RADAR FILTER: Only show default Z level (ignore non-planets in far-z, filter all by z)
        if (r.z > 0.1) return;

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
    livesDisplay.innerText = `LIVES: ${lives}`;
    livesDisplay.style.color = '#0ff'; // Ensure consistency
    livesDisplay.style.marginTop = '5px'; // Minor align adjustment
}

function createAsteroidCluster(cx, cy, clusterRadius, count) {
    const clusterDriftVx = (Math.random() - 0.5) * 0.5;
    const clusterDriftVy = (Math.random() - 0.5) * 0.5;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * clusterRadius;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const r = 50 + Math.random() * 40; // larger roids in clusters
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
        const r = 50 + Math.random() * 50;
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
    roids.push(createAsteroid(planetX, planetY, PLANET_THRESHOLD * 3.5 + Math.random() * 400, 0)); // Host planet at z=0
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
        createBinaryAsteroid(binaryX, binaryY, 50 + Math.random() * 30, 50 + Math.random() * 30, 100 + Math.random() * 50, 0.5 + Math.random());
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

        r = 50 + Math.random() * 100;

        // One more planet further out
        if (!planetSpawned || (i === Math.floor(roidCount / 2) && Math.random() < 0.3)) {
            if (d > 25000) {
                r = PLANET_THRESHOLD + 200 + Math.random() * 200;
                planetSpawned = true;
                const pZ = Math.random() * MAX_Z_DEPTH; // Random depth for secondary planets
                roids.push(createAsteroid(x, y, r, pZ));
                console.log(`Outer Planet spawned at: (${x.toFixed(0)}, ${y.toFixed(0)}) with radius ${r} at z=${pZ.toFixed(1)}`);
                continue;
            }
        }

        roids.push(createAsteroid(x, y, r));
    }

    // Fallback: If no planet was created (very unlikely)
    if (roids.filter(r => r.isPlanet).length === 0) {
        let x = WORLD_BOUNDS / 2; let y = WORLD_BOUNDS / 2;
        roids.push(createAsteroid(x, y, PLANET_THRESHOLD + 150));
        console.log("Fallback planet spawned.");
    }

    // ALL PLANETS HAVE 1 OR 2 STATIONS
    roids.filter(r => r.isPlanet).forEach(planet => {
        const stationCount = Math.floor(Math.random() * 2) + 1; // 1 or 2
        for (let i = 0; i < stationCount; i++) {
            spawnStation(planet);
        }
    });
}

// REFRACTORIZADO: Función para manejar el daño al jugador (basado en structureHP)
function hitShip(damageAmount, sourceIsNearPlanet = false) {
    if (ship.blinkNum > 0 || ship.dead) return;

    // Reducir estructura (un golpe = una capa de defensa)
    ship.structureHP--;

    // Visual/Audio Feedback
    const vpX = width / 2; const vpY = height / 2;
    createExplosion(vpX, vpY, 10, '#0ff', 2);
    // AudioEngine.playExplosion('small'); REMOVED

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
    AudioEngine.playExplosion('large', worldOffsetX, worldOffsetY);
    ship.dead = true;

    lives--;
    drawLives();

    // --- ENEMY EVOLUTION ON PLAYER DEATH ---
    enemies.forEach(e => {
        if (e.type === 'ship' || e.type === 'station') {
            e.structureHP = Math.min(e.structureHP + 2, MAX_TIER_HP); // Heal/Buff HP
            e.reloadTime *= 0.9; // Fire faster
            e.fleetHue = (e.fleetHue + 30) % 360; // Visual feedback
            e.r *= 1.1; // Grow slightly
        }
    });
    console.log("ENEMIES EVOLVED!");

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
            startBtn.onclick = () => startGame(); // Direct restart without reload
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
                    const hasStation = enemies.some(e => e.type === 'station' && e.hostPlanetId === r1.id);
                    if (!hasStation) {
                        spawnStation(r1);
                        console.log(`Station respawned on ${r1.name} (Return trip)`);
                    }
                    r1.hasSpawnedStationThisCycle = true;
                }
                if (r1.z > 1.0) {
                    r1.hasSpawnedStationThisCycle = false; // Reset when far away
                }

                // REVERTIR MOVIMIENTO Z AL LLEGAR AL LÍMITE REDUCIDO
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

            if (dist < r1.r + r2.r) {
                const midX = (r1.x + r2.x) / 2;
                const midY = (r1.y + r2.y) / 2;
                const midVpX = midX - worldOffsetX + width / 2;
                const midVpY = midY - worldOffsetY + height / 2;

                // 1. Planet-Planet Collision
                if (r1.isPlanet && r2.isPlanet) {
                    // Only in default z level (where ship is)
                    if (r1.z < 0.1 && r2.z < 0.1) {
                        createExplosion(midVpX, midVpY, 80, '#ffaa00', 5, 'spark');
                        createExplosion(midVpX, midVpY, 40, '#ff0000', 8, 'debris');
                        AudioEngine.playPlanetExplosion(midX, midY, r1.z); // Strong sound if visible

                        const avgXv = (r1.xv + r2.xv) / 2;
                        const avgYv = (r1.yv + r2.yv) / 2;

                        // Spawn 4 large asteroids in cardinal directions
                        const directions = [
                            { xv: 0, yv: -25 },  // North
                            { xv: 25, yv: 0 },   // East
                            { xv: 0, yv: 25 },   // South
                            { xv: -25, yv: 0 }   // West
                        ];

                        directions.forEach(dir => {
                            const offset = 200; // Spawn offset distance for large asteroids
                            let ast = createAsteroid(
                                midX + (dir.xv !== 0 ? Math.sign(dir.xv) * offset : 0),
                                midY + (dir.yv !== 0 ? Math.sign(dir.yv) * offset : 0),
                                150
                            ); // Large asteroid
                            ast.xv = avgXv + dir.xv;
                            ast.yv = avgYv + dir.yv;
                            ast.blinkNum = 30;
                            roids.push(ast);
                        });
                        createShockwave(midX, midY);

                        // Destroy both planets' stations
                        for (let k = enemies.length - 1; k >= 0; k--) {
                            if (enemies[k].hostPlanet === r1 || enemies[k].hostPlanet === r2) {
                                enemies.splice(k, 1);
                            }
                        }

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
                            createExplosion(midVpX, midVpY, 30, '#fff', 5);
                            // AudioEngine.playExplosion('large'); REMOVED
                        } else if (r1.isPlanet) {
                            r1.r = newR;
                            r1.mass = totalMass * 0.05;
                            console.log(`Planeta ${r1.name} (ID: ${r1.textureData.seed}) CRECE a R=${newR.toFixed(1)}`);
                        }

                        // NEW: Audio feedback for asteroid fusion
                        if (newR <= PLANET_THRESHOLD) {
                            AudioEngine.playSoftThud(midX, midY, r1.z); // Soft sound for merge
                        }

                        roids.splice(j, 1); j--; continue;
                    }
                }
            }

            // --- Gravitational Attraction between Roids/Planets (World Coords) ---
            if (r1.blinkNum === 0 && r2.blinkNum === 0 && dist > 10) {
                let force = 0;
                let G = G_CONST;

                // SPECIAL: Planet acting on Asteroid
                if ((r1.isPlanet && !r2.isPlanet && r1.z < 0.5) || (!r1.isPlanet && r2.isPlanet && r2.z < 0.5)) {
                    // Identify Planet and Asteroid
                    const planet = r1.isPlanet ? r1 : r2;
                    const asteroid = r1.isPlanet ? r2 : r1;

                    // Planets in default z attract near asteroids
                    // Check range - slightly larger range for "near" asteroids
                    const attractionRange = planet.r * 6; // 6 times radius

                    if (dist < attractionRange) {
                        // "the nearer, the faster they are atracted"
                        // Standard gravity is F = G*M1*M2 / r^2. 
                        // To make it noticeably "faster" as they get closer, we can use 1/r (linear falloff) or keep 1/r^2 with high constant.

                        // Let's rely on standard physics but boost the mass/G effect significantly for this interaction
                        const G_PLANET_ATTRACT = 5.0; // Stronger G for absorption

                        force = (G_PLANET_ATTRACT * planet.mass * asteroid.mass) / Math.max(distSq, 100);

                        let fx = (dx / dist) * force;
                        let fy = (dy / dist) * force;

                        if (!isNaN(fx) && !isNaN(fy)) {
                            // Only affect the asteroid. The planet is on rails (orbit).
                            if (r1 === asteroid) {
                                r1.xv += fx / r1.mass;
                                r1.yv += fy / r1.mass;
                            } else {
                                r2.xv -= fx / r2.mass;
                                r2.yv -= fy / r2.mass;
                            }
                        }
                    }
                }
                else if (r1.isPlanet || r2.isPlanet) {
                    // Generic planet-planet or deep-z gravity (weaker)
                    force = (G * r1.mass * r2.mass) / Math.max(distSq, 500);
                    let fx = (dx / dist) * force;
                    let fy = (dy / dist) * force;
                    // Planets are on rails, so this force likely won't move them effectively if we override x/y, 
                    // but we calculate it for completeness or if one isn't orbiting.
                    // Actually, since we override Planet X/Y in the loop, we shouldn't apply force TO the planet.
                } else {
                    // Asteroid-Asteroid Gravity
                    // Gravedad más fuerte y rango cercano más agresivo (USER REQUEST in previous turn, maintained)
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
            if (Math.random() < 0.2) AudioEngine.playThrust(worldOffsetX, worldOffsetY);
        }

        // Desplazamiento lateral / Strafe (A/D)
        if (keys.KeyA) { // Strafe Izquierda (perpendicular a la izquierda: ship.a + PI/2)
            const strafeAngle = ship.a + Math.PI / 2;
            deltaX += SHIP_THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY -= SHIP_THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust(worldOffsetX, worldOffsetY);
        }
        if (keys.KeyD) { // Strafe Derecha (perpendicular a la derecha: ship.a - PI/2)
            const strafeAngle = ship.a - Math.PI / 2;
            deltaX += SHIP_THRUST * strafeMultiplier * Math.cos(strafeAngle);
            deltaY -= SHIP_THRUST * strafeMultiplier * Math.sin(strafeAngle);
            if (Math.random() < 0.2) AudioEngine.playThrust(worldOffsetX, worldOffsetY);
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
        // CULLING: Only cull ships, NOT stations
        if (e.type !== 'station' && Math.hypot(e.x - worldOffsetX, e.y - worldOffsetY) > cullRange) {
            enemies.splice(i, 1);
            continue;
        }

        if (e.blinkNum > 0) e.blinkNum--;

        // 1. MOVIMIENTO ORBITAL (All in World Coords)
        let isOrbiting = false;
        if (e.type === 'station' && e.hostPlanetId) {
            const host = roids.find(r => r.id === e.hostPlanetId);
            if (!host) {
                e.hostPlanetId = null;
                e.xv = (Math.random() - 0.5) * 0.5; e.yv = (Math.random() - 0.5) * 0.5;
            } else {
                // Actualizar la posición orbital ideal
                e.orbitAngle += e.orbitSpeed;
                const dx_orbit = Math.cos(e.orbitAngle) * e.orbitDistance;
                const dy_orbit = Math.sin(e.orbitAngle) * e.orbitDistance;

                const targetX = host.x + dx_orbit;
                const targetY = host.y + dy_orbit;

                // SPRING FORCE TO ORBIT (Soft Lock)
                // Instead of e.x = targetX, we apply force towards targetX
                const distToTargetX = targetX - e.x;
                const distToTargetY = targetY - e.y;

                // Strong spring to keep it in orbit, but allows deviation
                e.xv += distToTargetX * 0.1;
                e.yv += distToTargetY * 0.1;
                e.xv *= 0.8; // Heavy damping to stop oscillation
                e.yv *= 0.8;

                // AVOIDANCE LOGIC (Stations avoid crashing)
                for (let r of roids) {
                    if (r === host) continue; // Don't avoid host
                    if (r.z > 0.5) continue;

                    let dx = e.x - r.x;
                    let dy = e.y - r.y;
                    let dist = Math.hypot(dx, dy);
                    let minDist = e.r + r.r + 100; // Buffer

                    if (dist < minDist && dist > 0) {
                        // Repulsion
                        let force = (minDist - dist) * 0.05;
                        e.xv += (dx / dist) * force;
                        e.yv += (dy / dist) * force;
                    }
                }

                // e.z = host.z; // REMOVED: Don't sync Z with planet

                isOrbiting = true; // Use physics integration below

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

            if ((e.type === 'station' && e.hostPlanetId && r.id === e.hostPlanetId) || e.blinkNum > 0) {
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
            e.a += e.rotSpeed;
            e.spawnTimer--;
            // Only spawn if this station's squad is depleted (check if any ship with same fleetHue exists?)
            // Simplification: Just spawn periodically if total enemies < max
            // Better: Check if any active squad members exist nearby? No, simpler is better for now.
            if (e.spawnTimer <= 0) {
                // Only spawn if total enemies not too high
                if (enemies.filter(en => en.type === 'ship').length < 15) {
                    // Check if we already have a squad for this station
                    // (Optional optimization: track squad aliveness)
                    spawnEnemySquad(e);
                }
                e.spawnTimer = 1800 + Math.random() * 600; // Much longer timer for full squads
            }
        } else {
            // --- ADVANCED SHIP AI ---
            const distToPlayer = Math.hypot(worldOffsetX - e.x, worldOffsetY - e.y);

            // 1. STATE TRANSITION
            const SIGHT_RANGE = 1200; // Approx screen width
            if (distToPlayer < SIGHT_RANGE && !ship.dead) {
                // If ANY member of the squad sees the player, they might all switch?
                // For now, individual switching is fine, they will behave naturally.
                e.aiState = 'COMBAT';
            } else if (distToPlayer > SIGHT_RANGE * 1.5) {
                e.aiState = 'FORMATION';
            }

            // 2. BEHAVIOR EXECUTION
            if (e.aiState === 'FORMATION') {
                // ASTEROID CLEARING (New Feature)
                // Check for obstacles in front and shoot them
                if (e.reloadTime <= 0) {
                    // Check a few roids to see if they are in the way
                    // Optimization: Don't check ALL roids every frame for every ship. 
                    // Just check close ones if we can, or just loop all since N is small (< 15 ships).
                    // Roids can be 300+. We should be careful. 
                    // Let's just check if there is an asteroid within a narrow cone and close distance.

                    for (let r of roids) {
                        if (r.z > 0.5) continue; // Ignore background asteroids
                        let d = Math.hypot(r.x - e.x, r.y - e.y);
                        if (d < 600) { // Look ahead range
                            let angleToRoid = Math.atan2(r.y - e.y, r.x - e.x);
                            let angleDiff = Math.abs(angleToRoid - e.a);
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

                            // If within 15 degrees cone (approx 0.26 rad)
                            if (Math.abs(angleDiff) < 0.26) {
                                enemyShoot(e, r.x, r.y);
                                e.reloadTime = 60 + Math.random() * 40;
                                break; // Shoot one at a time
                            }
                        }
                    }
                }

                if (e.role === 'leader') {
                    // LEADER: Long-range travel towards player
                    let targetAngle = Math.atan2(worldOffsetY - e.y, worldOffsetX - e.x);

                    // Smooth rotation
                    let angleDiff = targetAngle - e.a;
                    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                    e.a += angleDiff * 0.05;

                    // Cruising Speed (Faster than before to hunt)
                    const CRUISE_SPEED = 12;
                    e.xv += Math.cos(e.a) * 0.5;
                    e.yv += Math.sin(e.a) * 0.5;

                    // Cap speed
                    const speed = Math.hypot(e.xv, e.yv);
                    if (speed > CRUISE_SPEED) {
                        e.xv = (e.xv / speed) * CRUISE_SPEED;
                        e.yv = (e.yv / speed) * CRUISE_SPEED;
                    }
                } else if (e.role === 'wingman') {
                    // WINGMAN: Follow Leader in V-Formation
                    if (e.leaderRef && !enemies.includes(e.leaderRef)) e.leaderRef = null; // Leader died context check

                    if (e.leaderRef) {
                        // Calculate Ideal Position
                        // Offset need to be rotated by leader's rotation
                        const lx = e.leaderRef.x;
                        const ly = e.leaderRef.y;
                        const la = e.leaderRef.a;

                        // Rotate offset vector (e.formationOffset.x, e.formationOffset.y) by la
                        // The offset x corresponds to "right" (la + PI/2), y corresponds to "back" (la + PI)
                        const fwdX = Math.cos(la);
                        const fwdY = Math.sin(la);
                        const rightX = Math.cos(la + Math.PI / 2);
                        const rightY = Math.sin(la + Math.PI / 2);

                        // Target Pos = LeaderPos + (RightVector * OffsetX) + (ForwardVector * OffsetY)
                        const targetX = lx + (rightX * e.formationOffset.x) + (fwdX * e.formationOffset.y);
                        const targetY = ly + (rightY * e.formationOffset.x) + (fwdY * e.formationOffset.y);

                        // Spring Force to Target
                        const dx = targetX - e.x;
                        const dy = targetY - e.y;

                        e.xv += dx * 0.05;
                        e.yv += dy * 0.05;

                        // Match Leader Rotation
                        let angleDiff = la - e.a;
                        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                        while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                        e.a += angleDiff * 0.1;

                        // Dampening to prevent oscillation
                        e.xv *= 0.90;
                        e.yv *= 0.90;

                    } else {
                        // Lost Leader -> Become a Leader? Or just float.
                        // For now, switch to leader behavior (hunt player)
                        e.role = 'leader';
                    }
                }
            }
            else if (e.aiState === 'COMBAT') {
                // COMBAT: Break formation, orbit and attack player OR Rival

                // --- FACTION WAR LOGIC ---
                let target = { x: worldOffsetX, y: worldOffsetY, isRival: false, r: 0 }; // Default: Player
                let distToPlayer = Math.hypot(worldOffsetX - e.x, worldOffsetY - e.y);
                let minDist = distToPlayer;

                // Search for rivals
                for (let other of enemies) {
                    if (other === e) continue;
                    // Identify rival: Different faction (hue) and is a ship/station
                    if ((other.type === 'ship' || other.type === 'station') && other.fleetHue !== e.fleetHue) {
                        let d = Math.hypot(other.x - e.x, other.y - e.y);
                        // Aggro if closer than player or player is dead/far
                        if (d < minDist && d < 2000) { // 2000 is aggro range
                            target = other;
                            target.isRival = true; // Mark as rival
                            minDist = d;
                        }
                    }
                }

                let tx = target.x;
                let ty = target.y;
                let d = minDist;


                let targetAngle = Math.atan2(ty - e.y, tx - e.x);
                let angleDiff = targetAngle - e.a;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

                // Smoother elegant rotation (Reduced from 0.1 to 0.04)
                e.a += angleDiff * 0.04;

                // Orbital Combat Movement
                const DESIRED_DIST = 350;

                // 1. Radial Force (Push/Pull) - Proportional smooth spring
                // Instead of hard ±0.8, we scale by distance diff
                const distError = d - DESIRED_DIST;
                // If positive (too far), pull in. If negative (too close), push out.
                const radialForce = distError * 0.002; // Small spring constant

                e.xv += Math.cos(targetAngle) * radialForce;
                e.yv += Math.sin(targetAngle) * radialForce;

                // 2. Tangential Force (Strafe/Orbit)
                const orbitDir = (e.squadId && e.squadId > 0.5) ? 1 : -1;
                const orbAngle = targetAngle + (Math.PI / 2 * orbitDir);

                e.xv += Math.cos(orbAngle) * 0.08; // Slower (Reduced from 0.20)
                e.yv += Math.sin(orbAngle) * 0.08;

                // 3. Separation Logic (Avoid bunching up)
                const SEPARATION_DIST = 120;
                let sepX = 0;
                let sepY = 0;
                let count = 0;

                for (let other of enemies) {
                    if (other === e || other.type !== 'ship') continue;
                    // Simple distance check
                    let distToOther = Math.hypot(e.x - other.x, e.y - other.y);
                    if (distToOther < SEPARATION_DIST) {
                        // Push away relative to other
                        let ang = Math.atan2(e.y - other.y, e.x - other.x);
                        // Force stronger the closer they are
                        let force = (SEPARATION_DIST - distToOther) * 0.01;
                        sepX += Math.cos(ang) * force;
                        sepY += Math.sin(ang) * force;
                        count++;
                    }
                }

                if (count > 0) {
                    e.xv += sepX;
                    e.yv += sepY;
                }

                // Drag for control (slightly stronger to dampen spring effects)
                e.xv *= 0.96;
                e.yv *= 0.96;

                // MAX SPEED CLAMP (User Request)
                let currentSpeed = Math.hypot(e.xv, e.yv);
                if (currentSpeed > MAX_SPEED) {
                    let scale = MAX_SPEED / currentSpeed;
                    e.xv *= scale;
                    e.yv *= scale;
                }

                // Shoot if lined up (slightly wider angle for smoother shooting feel)
                // Shoot if lined up (slightly wider angle for smoother shooting feel)
                if (e.reloadTime <= 0 && Math.abs(angleDiff) < 0.4) {
                    // Start of synchronized weapon logic
                    // INDIVIDUAL EVOLUTION: Tier based on score
                    const tier = Math.floor(e.score / EVOLUTION_SCORE_STEP);

                    const b = createBullet(0, 0, 0, true, tier);

                    // Assign properties to bullet
                    b.x = e.x + Math.cos(e.a) * e.r; // Spawn at nose
                    b.y = e.y + Math.sin(e.a) * e.r;
                    b.xv = Math.cos(e.a) * 20 + e.xv; // Bullet velocity + Ship velocity
                    b.yv = Math.sin(e.a) * 20 + e.yv;
                    b.a = e.a; // Pass orientation for beams

                    b.hue = e.fleetHue; // Important: Pass faction color
                    b.owner = e; // NEW: Bullet Ownership for scoring

                    enemyBullets.push(b);

                    enemyBullets.push(b);
                    AudioEngine.playLaser(tier);

                    e.reloadTime = 60 + Math.random() * 100;
                }
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
                    AudioEngine.playSoftThud(e.x, e.y, e.z); // Soft sound for ship-ship collision

                    let ang = Math.atan2(e.y - worldOffsetY, e.x - worldOffsetX);
                    e.x += Math.cos(ang) * 60; e.y += Math.sin(ang) * 60;

                } else {
                    enemies.splice(i, 1); i--;
                    scoreEl.innerText = score;
                    AudioEngine.playExplosion('large', e.x, e.y, e.z);
                }

                if (e.structureHP <= 0) {
                    let debrisColor = e.type === 'station' ? `hsl(${e.fleetHue}, 100%, 50%)` : `hsl(${e.fleetHue}, 100%, 40%)`;
                    createExplosion(vpX, vpY, 40, '#ffaa00', 3, 'spark'); createExplosion(vpX, vpY, 20, debrisColor, 4, 'debris');
                    if (e.type === 'station') { onStationDestroyed(e); }
                    else {
                        score += 200;
                        // SHIP DEBRIS (Player Kill)
                        const debris = createAsteroid(e.x, e.y, 40 + Math.random() * 20);
                        debris.xv = (Math.random() - 0.5) * 10;
                        debris.yv = (Math.random() - 0.5) * 10;
                        debris.blinkNum = 30;
                        roids.push(debris);
                    }
                    enemies.splice(i, 1); scoreEl.innerText = score; AudioEngine.playExplosion('large', e.x, e.y, e.z);
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
                    AudioEngine.playSoftThud(r.x, r.y, r.z);

                    // Create explosions
                    createExplosion(vpX, vpY, 15, '#0ff', 2, 'spark');
                    createExplosion(vpX, vpY, 8, '#fff', 1, 'debris');

                    // Split asteroid if larger than minimum size
                    const MIN_ASTEROID_SIZE = 80;
                    if (r.r > MIN_ASTEROID_SIZE) {
                        const newSize = r.r * 0.6;
                        const splitSpeed = 8;
                        const offset = 100;

                        // West asteroid
                        let westAst = createAsteroid(r.x - offset, r.y, newSize);
                        westAst.xv = r.xv - splitSpeed;
                        westAst.yv = r.yv;
                        westAst.blinkNum = 30;
                        roids.push(westAst);

                        // East asteroid
                        let eastAst = createAsteroid(r.x + offset, r.y, newSize);
                        eastAst.xv = r.xv + splitSpeed;
                        eastAst.yv = r.yv;
                        eastAst.blinkNum = 30;
                        roids.push(eastAst);
                    }

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

            // --- INDIVIDUAL EVOLUTION: Enemies match their OWN score visuals ---
            const tier = Math.floor((e.score || 0) / EVOLUTION_SCORE_STEP);
            const r = e.r;

            // Generate Palette based on fleetHue (Host Planet)
            // Player Blue Theme: Hull(210, 60%, 30%), Detail(210, 100%, 50%), Cockpit(Cyan)
            // Enemy Theme: Hull(fleetHue, ...), Detail(fleetHue+variation, ...)

            const HULL_COLOR = `hsl(${e.fleetHue}, 60%, 30%)`;
            const HULL_BORDER = `hsl(${e.fleetHue}, 40%, 50%)`; // Lighter border
            const DETAIL_COLOR = `hsl(${e.fleetHue}, 80%, 60%)`;
            const ACCENT_COLOR = `hsl(${(e.fleetHue + 180) % 360}, 90%, 60%)`; // Complementary accent
            const THRUST_COLOR = `hsl(${e.fleetHue}, 100%, 70%)`;
            const COCKPIT_GRAD_1 = `hsl(${e.fleetHue}, 100%, 80%)`;
            const COCKPIT_GRAD_2 = `hsl(${e.fleetHue}, 100%, 50%)`;

            if (tier >= 8) {
                // TIER 8 DREADNOUGHT VISUAL (Enemy Version)
                const HULL_COLOR_D = `hsl(${e.fleetHue}, 20%, 20%)`; // Darker, menacing
                const HULL_BORDER_D = `hsl(${e.fleetHue}, 40%, 40%)`;
                const DETAIL_GRAY_D = `hsl(${e.fleetHue}, 10%, 40%)`;

                // Normalization scale to match hit radius
                const norm = 0.6;

                ctx.shadowBlur = 20; ctx.shadowColor = THRUST_COLOR;
                ctx.beginPath();
                ctx.moveTo(r * 1.6 * norm, 0);
                ctx.lineTo(r * 0.5 * norm, r * 1.5 * norm); ctx.lineTo(-r * 1.2 * norm, r * 0.8 * norm);
                ctx.lineTo(-r * 1.8 * norm, r * 0.4 * norm); ctx.lineTo(-r * 1.8 * norm, -r * 0.4 * norm);
                ctx.lineTo(-r * 1.2 * norm, -r * 0.8 * norm); ctx.lineTo(r * 0.5 * norm, -r * 1.5 * norm);
                ctx.closePath();
                ctx.fillStyle = HULL_COLOR_D; ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = HULL_BORDER_D; ctx.stroke();

                // Details
                ctx.shadowBlur = 0; ctx.fillStyle = DETAIL_GRAY_D;
                ctx.beginPath(); ctx.moveTo(r * 1.6 * norm, 0); ctx.lineTo(r * 1.4 * norm, r * 0.1 * norm); ctx.lineTo(r * 1.4 * norm, -r * 0.1 * norm); ctx.closePath(); ctx.fill();
                ctx.fillStyle = DETAIL_GRAY_D;
                ctx.fillRect(r * 0.2 * norm, r * 0.5 * norm, r * 0.3 * norm, r * 0.2 * norm); ctx.fillRect(r * 0.2 * norm, -r * 0.7 * norm, r * 0.3 * norm, r * 0.2 * norm);

                // Accent Engine/Core
                ctx.fillStyle = ACCENT_COLOR; ctx.beginPath(); ctx.arc(-r * 0.5 * norm, 0, r * 0.2 * norm, 0, Math.PI * 2); ctx.fill();

                // Thrust
                ctx.shadowBlur = 30; ctx.shadowColor = THRUST_COLOR;
                const EXHAUST_H = r * 0.7 * norm; const EXHAUST_X = -r * 1.8 * norm;
                ctx.fillStyle = HULL_BORDER_D; ctx.fillRect(EXHAUST_X, -EXHAUST_H / 2, 5, EXHAUST_H);

                // Always thrusting slightly for visual effect
                ctx.fillStyle = `hsla(${e.fleetHue}, 100%, 60%, ${0.5 + Math.random() * 0.5})`;
                ctx.beginPath(); ctx.moveTo(EXHAUST_X + 5, -EXHAUST_H / 2); ctx.lineTo(EXHAUST_X + 5, EXHAUST_H / 2);
                ctx.lineTo(EXHAUST_X - 25 * norm * (0.8 + Math.random() * 0.4), 0); ctx.closePath(); ctx.fill();
                ctx.shadowBlur = 0;

            } else {
                // STANDARD EVOLVING SHIP (Tiers 0-7)
                // Shape evolves with individual score (Triangle -> Square -> ...)
                let sides = 3 + tier;
                ctx.beginPath();
                for (let i = 0; i <= sides; i++) {
                    let ang = i * (2 * Math.PI / sides);
                    let rad = r * (1 + tier * 0.1);
                    if (i === 0) ctx.moveTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                    else ctx.lineTo(rad * Math.cos(ang), -rad * Math.sin(ang));
                }
                ctx.closePath();

                let chassisGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
                chassisGrad.addColorStop(0, DETAIL_COLOR);
                chassisGrad.addColorStop(1, HULL_COLOR);

                ctx.fillStyle = chassisGrad; ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = HULL_BORDER; ctx.stroke();

                // Side Detail
                ctx.fillStyle = `hsl(${e.fleetHue}, 60%, 20%)`; // Darker detail
                ctx.fillRect(-r * 0.5, -r * 0.2, r * 0.3, r * 0.4);

                // Wing/Stripe
                ctx.strokeStyle = DETAIL_COLOR; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-r * 0.6, -r * 0.3); ctx.bezierCurveTo(-r * 0.2, 0, 0, r * 0.2, r * 0.4, r * 0.3); ctx.stroke();

                // Engine Node
                ctx.beginPath();
                ctx.arc(-r * 0.2, r * 0.3, r * 0.1, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${e.fleetHue}, 40%, 20%)`; ctx.fill(); ctx.strokeStyle = HULL_BORDER; ctx.stroke();

                // Cockpit
                let cockpitGrad = ctx.createRadialGradient(r * 0.4, 0, 2, r * 0.4, 0, r * 0.25);
                cockpitGrad.addColorStop(0, COCKPIT_GRAD_1); cockpitGrad.addColorStop(1, COCKPIT_GRAD_2);
                ctx.fillStyle = cockpitGrad;
                ctx.beginPath(); ctx.ellipse(r * 0.4, 0, r * 0.2, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();

                // Thrust
                ctx.shadowColor = THRUST_COLOR; ctx.strokeStyle = THRUST_COLOR; ctx.lineWidth = 2;
                ctx.beginPath();
                const rX = -r; const rY = 0;
                ctx.moveTo(rX, rY);
                // Engine flicker
                ctx.lineTo(rX - 20 * Math.cos((Math.random() - 0.5) * 0.5), rY + 20 * Math.sin((Math.random() - 0.5) * 0.5));
                ctx.stroke();
                ctx.fillStyle = THRUST_COLOR;
                ctx.beginPath(); ctx.arc(rX - 5, 0, 5, 0, Math.PI * 2); ctx.fill();
            }

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
        ctx.save(); // PUSH 1: Isolate entire player ship rendering block

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

                // Normalization scale to match Tier 7 visual radius (approx 1/1.7)
                const norm = 0.6;

                ctx.shadowBlur = 20; ctx.shadowColor = THRUST_COLOR;
                ctx.beginPath();
                ctx.moveTo(r * 1.6 * norm, 0);
                ctx.lineTo(r * 0.5 * norm, r * 1.5 * norm); ctx.lineTo(-r * 1.2 * norm, r * 0.8 * norm);
                ctx.lineTo(-r * 1.8 * norm, r * 0.4 * norm); ctx.lineTo(-r * 1.8 * norm, -r * 0.4 * norm);
                ctx.lineTo(-r * 1.2 * norm, -r * 0.8 * norm); ctx.lineTo(r * 0.5 * norm, -r * 1.5 * norm);
                ctx.closePath();
                ctx.fillStyle = HULL_COLOR; ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = HULL_BORDER; ctx.stroke();
                ctx.shadowBlur = 0; ctx.fillStyle = DETAIL_GRAY;
                ctx.beginPath(); ctx.moveTo(r * 1.6 * norm, 0); ctx.lineTo(r * 1.4 * norm, r * 0.1 * norm); ctx.lineTo(r * 1.4 * norm, -r * 0.1 * norm); ctx.closePath(); ctx.fill();
                ctx.fillStyle = DETAIL_GRAY;
                ctx.fillRect(r * 0.2 * norm, r * 0.5 * norm, r * 0.3 * norm, r * 0.2 * norm); ctx.fillRect(r * 0.2 * norm, -r * 0.7 * norm, r * 0.3 * norm, r * 0.2 * norm);
                ctx.fillStyle = ACCENT_RED; ctx.beginPath(); ctx.arc(-r * 0.5 * norm, 0, r * 0.2 * norm, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 30; ctx.shadowColor = THRUST_COLOR;
                const EXHAUST_H = r * 0.7 * norm; const EXHAUST_X = -r * 1.8 * norm;
                ctx.fillStyle = HULL_BORDER; ctx.fillRect(EXHAUST_X, -EXHAUST_H / 2, 5, EXHAUST_H);
                if (ship.thrusting) {
                    ctx.fillStyle = `rgba(0, 136, 255, ${0.5 + Math.random() * 0.5})`;
                    ctx.beginPath(); ctx.moveTo(EXHAUST_X + 5, -EXHAUST_H / 2); ctx.lineTo(EXHAUST_X + 5, EXHAUST_H / 2);
                    ctx.lineTo(EXHAUST_X - 25 * norm * (0.8 + Math.random() * 0.4), 0); ctx.closePath(); ctx.fill();
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
        ctx.restore(); // POP 1: Restore state after ship block
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

        // TIERED ENEMY BULLET RENDERING (Synchronized with Player)
        const tier = eb.tier || 0;
        const hue = eb.hue || 0; // Faction Color

        // Colors derived from faction hue
        const mainColor = `hsl(${hue}, 100%, 70%)`;
        const glowColor = `hsl(${hue}, 100%, 50%)`;
        const coreColor = '#ffffff';

        if (tier >= 8) { // Ultimate Beam-like (Enemy)
            ctx.shadowBlur = 15; ctx.shadowColor = glowColor; ctx.fillStyle = mainColor;
            ctx.beginPath();
            let ang = Math.atan2(eb.yv, eb.xv);
            ctx.ellipse(vpX, vpY, eb.size * 4, eb.size * 0.8, ang, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = coreColor;
            ctx.beginPath(); ctx.arc(vpX, vpY, eb.size / 2, 0, Math.PI * 2); ctx.fill();
        } else {
            // GEOMETRIC SHAPES (Tier 0-7) matching Ship Hull
            let sides = 3 + tier;
            ctx.shadowBlur = 5; ctx.shadowColor = glowColor; ctx.fillStyle = mainColor;

            ctx.save();
            ctx.translate(vpX, vpY);
            // Spin effect based on life
            ctx.rotate(eb.life * 0.2);

            ctx.beginPath();
            for (let k = 0; k < sides; k++) {
                let ang = k * (2 * Math.PI / sides);
                let r = eb.size * (1 + tier * 0.1); // Slightly larger for higher tiers
                if (k === 0) ctx.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                else ctx.lineTo(r * Math.cos(ang), r * Math.sin(ang));
            }
            ctx.closePath();
            ctx.fill();

            // Core
            ctx.fillStyle = coreColor;
            ctx.beginPath(); ctx.arc(0, 0, eb.size * 0.4, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

        ctx.globalAlpha = 1; // Reset alpha

        let hit = false;
        // Collision with player (World Coords)
        if (!ship.dead && Math.hypot(worldOffsetX - eb.x, worldOffsetY - eb.y) < (ship.effectiveR || ship.r) + 5) {
            hitShip(1); // Aplicar 1 golpe al jugador

            // INDIVIDUAL EVOLUTION: Gain score for hitting/killing player
            if (eb.owner && enemies.includes(eb.owner)) {
                eb.owner.score += 1000;
            }

            enemyBullets.splice(i, 1);
            hit = true;
        }
        if (hit) continue;

        // NEW: Collision with RIVAL SHIPS (Faction War)
        for (let k = enemies.length - 1; k >= 0; k--) {
            let e = enemies[k];
            if (e.z > 0.5) continue; // Ignore background ships

            // Basic collision check
            if (Math.hypot(eb.x - e.x, eb.y - e.y) < e.r + eb.size) {
                // Check if it's the own ship (or squad?) - difficult without ID on bullet.
                // For now, let's assume if it hits, it hits. Civil war is messy.
                // To minimize self-damage, we rely on the fact bullets spawn 'outside' the ship.

                e.structureHP--;
                e.shieldHitTimer = 10;
                createExplosion(eb.x - worldOffsetX + width / 2, eb.y - worldOffsetY + height / 2, 5, '#ff0055', 1, 'spark');

                if (e.structureHP <= 0) {
                    let debrisColor = e.type === 'station' ? `hsl(${e.fleetHue}, 100%, 50%)` : `hsl(${e.fleetHue}, 100%, 40%)`;
                    createExplosion(e.x - worldOffsetX + width / 2, e.y - worldOffsetY + height / 2, 40, debrisColor, 4, 'debris');
                    if (e.type === 'station') { onStationDestroyed(e); }
                    else {
                        // SHIP DEBRIS
                        const debris = createAsteroid(e.x, e.y, 40 + Math.random() * 20);
                        debris.xv = (Math.random() - 0.5) * 10;
                        debris.yv = (Math.random() - 0.5) * 10;
                        debris.blinkNum = 30;
                        roids.push(debris);
                    }

                    // INDIVIDUAL EVOLUTION: Gain score for killing rival
                    if (eb.owner && enemies.includes(eb.owner)) {
                        eb.owner.score += (e.type === 'station') ? 1000 : 200;
                    }

                    enemies.splice(k, 1);
                    AudioEngine.playExplosion('large', e.x, e.y, e.z);
                }

                enemyBullets.splice(i, 1);
                hit = true;
                break;
            }
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

                    // INDIVIDUAL EVOLUTION: Gain score for destroying asteroids
                    if (eb.owner && enemies.includes(eb.owner)) {
                        eb.owner.score += 50;
                        // console.log(`Enemy ${eb.owner.id.toFixed(2)} score: ${eb.owner.score}`);
                    }

                    if (r.r > 100) { roids.push(createAsteroid(r.x, r.y, r.r / 2)); roids.push(createAsteroid(r.x, r.y, r.r / 2)); } // New asteroids get world coords
                    roids.splice(j, 1);
                    AudioEngine.playExplosion('small', r.x, r.y, r.z); // Added for asteroid destruction by enemy
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

        ctx.globalAlpha = alpha;

        // TIERED BULLET RENDERING
        const tier = b.tier || 0;

        if (tier >= 8) { // Ultimate Beam-like
            ctx.shadowBlur = 15; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            // Draw elongated bolt
            let ang = Math.atan2(b.yv, b.xv); // Use velocity for orientation
            ctx.ellipse(vpX, vpY, b.size * 4, b.size * 0.8, ang, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = '#ccffff';
            ctx.beginPath(); ctx.arc(vpX, vpY, b.size / 2, 0, Math.PI * 2); ctx.fill();
        } else {
            // GEOMETRIC SHAPES (Tier 0-7)
            let sides = 3 + tier;

            // Colors logic
            let pColor = '#ff0055'; let pGlow = '#ff0055';
            if (tier >= 4) { pColor = '#ffff00'; pGlow = '#ffff00'; }
            else if (tier >= 1) { pColor = '#ffaa00'; pGlow = '#ffaa00'; }

            ctx.shadowBlur = 5; ctx.shadowColor = pGlow; ctx.fillStyle = pColor;

            ctx.save();
            ctx.translate(vpX, vpY);
            ctx.rotate(b.life * 0.2);

            ctx.beginPath();
            for (let k = 0; k < sides; k++) {
                let ang = k * (2 * Math.PI / sides);
                let r = b.size * (1 + tier * 0.1);
                if (k === 0) ctx.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                else ctx.lineTo(r * Math.cos(ang), r * Math.sin(ang));
            }
            ctx.closePath();
            ctx.fill();

            // Core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, b.size * 0.4, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

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
                    createExplosion(rVpX, rVpY, 15, '#ff0055', 1, 'spark');
                    createExplosion(rVpX, rVpY, 5, '#888', 2, 'debris');

                    // Split asteroid if larger than minimum size
                    const MIN_ASTEROID_SIZE = 80;
                    if (r.r > MIN_ASTEROID_SIZE) {
                        const newSize = r.r * 0.6;
                        const splitSpeed = 8;
                        const offset = 100;

                        // West asteroid
                        let westAst = createAsteroid(r.x - offset, r.y, newSize);
                        westAst.xv = r.xv - splitSpeed;
                        westAst.yv = r.yv;
                        westAst.blinkNum = 30;
                        roids.push(westAst);

                        // East asteroid
                        let eastAst = createAsteroid(r.x + offset, r.y, newSize);
                        eastAst.xv = r.xv + splitSpeed;
                        eastAst.yv = r.yv;
                        eastAst.blinkNum = 30;
                        roids.push(eastAst);
                    }

                    roids.splice(j, 1);
                    AudioEngine.playExplosion('small', r.x, r.y, r.z);
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
                    if (e.type === 'station') { onStationDestroyed(e); } else { score += 200; }
                    enemies.splice(j, 1); scoreEl.innerText = score;
                    AudioEngine.playExplosion('large', e.x, e.y, e.z);
                } else {
                    // AudioEngine.playExplosion('small'); REMOVED
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
    particles = [];
    ambientFogs = [];
    bullets = [];
    enemyBullets = [];
    shockwaves = [];

    drawLives(); // NEW: Initial draw

    initBackground(); createLevel(); gameRunning = true;

    // Reset radar zoom to default (2500)
    currentZoomIndex = 2;
    RADAR_RANGE = ZOOM_LEVELS[currentZoomIndex];
    // radarRangeEl.innerText = RADAR_RANGE; // REMOVED

    // Determine initial input mode based on device
    if (window.matchMedia("(pointer: coarse)").matches) { inputMode = 'touch'; }
    else { inputMode = 'mouse'; gestureHint.innerText = ""; }

    if (!loopStarted) {
        loopStarted = true;
        loop();
    }
}

resize();
