import { ASTEROID_CONFIG, BOUNDARY_CONFIG, GALAXY_CONFIG, PLANET_CONFIG, PLAYER_CONFIG, SCORE_REWARDS, SHIP_CONFIG, STATION_CONFIG, FPS, FRICTION, G_CONST, MAX_Z_DEPTH, MIN_DURATION_TAP_TO_MOVE, SCALE_IN_MOUSE_MODE, SCALE_IN_TOUCH_MODE, WORLD_BOUNDS, ZOOM_LEVELS, suffixes, syllables, DOM } from './config.js';
import { State } from './state.js';
import { mulberry32, getShapeName } from './utils.js';
import { addScreenMessage, updateAsteroidCounter, drawLives } from './render.js';
import { t } from './i18n.js';

export function newPlayerShip() {
    const startingHP = SHIP_CONFIG.RESISTANCE;
    return {
        a: 90 / 180 * Math.PI,
        blinkNum: 30,
        blinkTime: 6,
        dead: false,
        effectiveR: SHIP_CONFIG.SIZE / 2,
        isFriendly: true,
        leaderRef: null,
        lives: PLAYER_CONFIG.INITIAL_LIVES,
        loneWolf: false,
        mass: 20,
        maxShield: SHIP_CONFIG.BASE_MAX_SHIELD,
        r: SHIP_CONFIG.SIZE / 2,
        role: 'leader',
        score: 0,
        shield: SHIP_CONFIG.BASE_MAX_SHIELD,
        squadId: null,
        squadSlots: [
            { x: -150, y: -150, occupant: null }, { x: 150, y: -150, occupant: null },
            { x: -300, y: -300, occupant: null }, { x: 300, y: -300, occupant: null },
            { x: -450, y: -450, occupant: null }, { x: 450, y: -450, occupant: null } // 6 wingman slots
        ],
        structureHP: startingHP,
        thrusting: false,
        tier: 0,
        // Weapon Properties (Default for Player)
        bulletSpeed: 25,
        bulletLife: 50,
        bulletSize: 6,
        type: 'ship',
        transformationTimer: 0
    };
}

export function createAsteroid(x, y, r, z = 0, forcedName = null) {
    let isPlanet = false;
    if (r > ASTEROID_CONFIG.MAX_SIZE) {
        const currentPlanets = State.roids.filter(ro => ro.isPlanet && !ro._destroyed).length;
        if (currentPlanets < PLANET_CONFIG.LIMIT && !State.victoryState && !(State.playerShip && State.playerShip.dead && State.playerShip.lives <= 0)) {
            isPlanet = true;
        } else {
            r = ASTEROID_CONFIG.MAX_SIZE;
        }
    }

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
        name: forcedName,
        textureData: null,
        rings: null,
        blinkNum: 0,
        targetR: r,
        color: `hsl(${Math.random() * 360}, ${Math.random() * 10}%, ${15 + Math.random() * 35}%)` // Gray tones with brightness variation
    };
    roid.stableXV = roid.xv;
    roid.stableYV = roid.yv;
    if (isPlanet) initializePlanetAttributes(roid, null, forcedName);
    for (let i = 0; i < roid.vert; i++) roid.offs.push(Math.random() * 0.3 * 2 + 1 - 0.3);
    return roid;
}

export function initializePlanetAttributes(roid, forcedHue = null, forcedName = null) {
    if (roid.isPlanet && roid.textureData) return;
    const r = roid.r;
    const seed = Math.floor(Math.random() * 100000);
    const rng = mulberry32(seed);
    const hue = forcedHue !== null ? forcedHue : rng() * 360;
    roid.isPlanet = true;
    roid.name = forcedName || generatePlanetName();

    const countInState = State.roids.filter(r => r.isPlanet && !r._destroyed).length;
    const isNewToState = !State.roids.find(r => r.id === roid.id);
    const totalPlanetsCount = countInState + (isNewToState ? 1 : 0);

    if (State.gameRunning) console.log("Planet " + roid.name + " created. Total planets " + totalPlanetsCount);

    // ELLIPTICAL ORBITAL INITIALIZATION
    // Each planet has its own unique center of gravity (not all orbiting 0,0)
    // Generate a random offset for this planet's orbital center
    const maxCenterOffset = WORLD_BOUNDS * 0.3; // Centers can be up to 30% of world bounds from origin
    const centerDist = rng() * maxCenterOffset;
    const centerAng = rng() * Math.PI * 2;
    roid.orbitCenterX = Math.cos(centerAng) * centerDist;
    roid.orbitCenterY = Math.sin(centerAng) * centerDist;

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
    const baseOrbitSpeed = 0.5; // Majestic, slow, elegant orbits
    roid.orbitSpeed = (baseOrbitSpeed / roid.semiMajorAxis) * (rng() < 0.5 ? 1 : -1);

    roid.zSpeed = (rng() * 0.001) + 0.0005;

    // Softer, more realistic base colors
    const isDesolate = rng() < 0.2; // 20% chance of being a dead/moon-like world

    let wSat = isDesolate ? 10 + rng() * 20 : 40 + rng() * 30;
    let wLight = isDesolate ? 20 + rng() * 20 : 25 + rng() * 20;

    let lSat = isDesolate ? 5 + rng() * 15 : 30 + rng() * 35;
    let lLight = isDesolate ? 30 + rng() * 20 : 35 + rng() * 20;

    // Atmosphere is generally slightly brighter than water but very transparent
    let aHue = hue + (rng() * 40 - 20); // slight atmosphere shift

    let textureData = {
        seed: seed,
        waterColor: `hsl(${hue}, ${wSat}%, ${wLight}%)`,
        landColor: `hsl(${hue + (rng() * 60 - 30)}, ${lSat}%, ${lLight}%)`, // Slightly shifted hue for land
        cloudColor: `rgba(255, 255, 255, ${0.3 + rng() * 0.4})`,
        craterColor: `rgba(0, 0, 0, 0.25)`,
        atmosphereColor: `hsl(${aHue}, ${wSat + 20}%, 60%)`, // Base color for rayleigh scattering
        cloudOffset: rng() * Math.PI * 2,
        age: 0,
        innerGradColor: `hsl(${hue}, ${wSat}%, ${Math.max(5, wLight - 20)}%)`, // Darker core
        landmasses: [],
        craters: [],
        clouds: [],
        cityLights: [] // New: City lights coordinates for night side
    };
    for (let i = 0; i < 5 + Math.floor(rng() * 3); i++) {
        const startAngle = rng() * Math.PI * 2;
        const radiusFactor = (0.4 + rng() * 0.5);
        const vertices = 15 + Math.floor(rng() * 15); // More vertices for smoother landmasses
        const vertexOffsets = [];
        for (let j = 0; j < vertices; j++) vertexOffsets.push(0.7 + rng() * 0.3);
        textureData.landmasses.push({ startAngle, radiusFactor, vertices, vertexOffsets });

        // Generate city lights clustered around this landmass (only if not desolate)
        if (!isDesolate) {
            const numCities = Math.floor(rng() * 5);
            for (let c = 0; c < numCities; c++) {
                // Place near the landmass center but somewhat randomized
                const cAngle = startAngle + (rng() * 0.8 - 0.4);
                const cDist = radiusFactor * (0.2 + rng() * 0.7);
                textureData.cityLights.push({
                    angle: cAngle,
                    distFactor: cDist,
                    size: 0.01 + rng() * 0.03, // Relative to planet radius
                    flickerOffset: rng() * Math.PI * 2,
                    hue: 30 + rng() * 30 // Orange / Yellow glows
                });
            }
        }
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
    if (Math.random() < 0.25 || r > ASTEROID_CONFIG.MAX_SIZE + 100) {
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

export function createGalaxy() {
    const arms = Math.floor(Math.random() * (GALAXY_CONFIG.ARMS_LIMIT - 1)) + 2; // 2 to ARMS_LIMIT arms
    const squish = 0.2 + Math.random() * 0.8; // Perspective tilt: 1.0 = top-down, 0.2 = very edge-on

    // Size distribution: mostly mid-sized, some absolutely massive ones
    let sizeRng = Math.random();
    let size = sizeRng > 0.85 ? (2000 + Math.random() * 2000) : (400 + Math.random() * 1000);

    // Scale star count relative to size (more stars = denser glow)
    const starCount = Math.floor(size * (1.5 + Math.random()));

    // Generate a core color and an edge color for the galaxy
    const hueSeed = Math.random();
    let coreColor, edgeColor;
    if (hueSeed > 0.6) {
        // Golden core to purple/blue edge
        coreColor = { r: 255, g: 220, b: 150 };
        edgeColor = { r: 50, g: 100, b: 255 };
    } else if (hueSeed > 0.3) {
        // Intense bright blue core to darker teal/purple edge
        coreColor = { r: 200, g: 230, b: 255 };
        edgeColor = { r: 100, g: 50, b: 200 };
    } else {
        // Reddish/Orange core to yellow edge
        coreColor = { r: 255, g: 180, b: 100 };
        edgeColor = { r: 255, g: 100, b: 50 };
    }

    let stars = [];
    const armSeparation = (Math.PI * 2) / arms;
    const spiralSwirl = 1.5 + Math.random() * 1.5; // How tightly wound

    for (let i = 0; i < starCount; i++) {
        // Distribute most stars near the center (exponential falloff)
        const distRatio = Math.pow(Math.random(), 2);
        const dist = distRatio * size;

        // Logarithmic spiral angle calculation
        const baseAngle = (i % arms) * armSeparation;
        const spiralAngle = distRatio * Math.PI * spiralSwirl;

        // Add random scatter (more scatter further out)
        const scatter = (Math.random() - 0.5) * (0.2 + distRatio * 0.8);

        const finalAngle = baseAngle + spiralAngle + scatter;

        // Determine color blending based on distance from core
        const r = coreColor.r * (1 - distRatio) + edgeColor.r * distRatio;
        const g = coreColor.g * (1 - distRatio) + edgeColor.g * distRatio;
        const b = coreColor.b * (1 - distRatio) + edgeColor.b * distRatio;

        // Size of individual star point
        const starSize = Math.random() > 0.9 ? (1 + Math.random() * 2) : (0.5 + Math.random());

        // Core stars are brighter
        const alpha = Math.min(1.0, (1.0 - distRatio) + Math.random() * 0.3);

        stars.push({
            r: dist,
            theta: finalAngle,
            size: starSize,
            alpha,
            color: `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)}, ` // Base string, alpha added in render
        });
    }

    // Place galaxy randomly within viewport bounds so they are initially visible
    // They will wrap around when they drift off-screen
    return {
        x: Math.random() * State.width,
        y: Math.random() * State.height,
        size,
        stars,
        coreColor,
        edgeColor,
        angle: Math.random() * Math.PI,
        squish
    };
}

export function createAmbientFog() {
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

export function createExplosion(vpX, vpY, n, color = 'white', sizeBase = 1, type = 'spark') {
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

export function createShockwave(worldX, worldY) {
    State.shockwaves.push({ x: worldX, y: worldY, r: 10, maxR: 1200, strength: 30, alpha: 1 });
}

export function createAsteroidBelt(cx, cy, innerRadius, outerRadius, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const r = (Math.random() < 0.5 ? 0.5 : 0.25) * ASTEROID_CONFIG.MAX_SIZE;
        const roid = createAsteroid(x, y, r);

        // Small tangential State.velocity to give a sense of belt movement
        const orbitalSpeed = 0.2 + Math.random() * 0.3;
        const tangentAngle = angle + Math.PI / 2;
        roid.xv += Math.cos(tangentAngle) * orbitalSpeed * (Math.random() < 0.5 ? 1 : -1);
        roid.yv += Math.sin(tangentAngle) * orbitalSpeed * (Math.random() < 0.5 ? 1 : -1);

        State.roids.push(roid);
    }
}

export function spawnStation(hostPlanet = null) {
    if (!hostPlanet) {
        const nearbyPlanets = State.roids.filter(r => r.isPlanet);
        if (nearbyPlanets.length === 0) {
            State.stationSpawnTimer = 300;
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

    const friendly = State.playerShip.loneWolf === false && State.homePlanetId !== null && hostPlanet.id === State.homePlanetId;

    State.ships.push({
        type: 'station',
        x: startX, // World Coordinate X
        y: startY, // World Coordinate Y
        xv: hostPlanet.xv, // Inherit planet State.velocity
        yv: hostPlanet.yv,
        r: STATION_R, a: Math.random() * Math.PI * 2, rotSpeed: 0.005,
        structureHP: STATION_CONFIG.RESISTANCE,
        shieldHitTimer: 0,
        spawnTimer: 180, reloadTime: 120, mass: 500,
        hostPlanet: hostPlanet, // Reference to the planet object
        orbitDistance: orbitDistance,
        orbitAngle: orbitAngle,
        orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * 0.002, // Slow orbital rotation
        fleetHue: friendly ? SHIP_CONFIG.FRIENDLY_BLUE_HUE : (Math.floor(Math.random() * 260) + 260) % 360, // Avoid blue (160-260)
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
    State.stationSpawnTimer = STATION_CONFIG.SPAWN_TIMER + Math.random() * STATION_CONFIG.SPAWN_TIMER;
}

export function spawnShipsSquad(station) {
    // Avoid spawning more than SHIP_CONFIG.LIMIT total State.ships (including players for friendly squads)
    if (station.isFriendly) {
        const currentFriendlyShips = State.ships.filter(en => en.type === 'ship' && en.isFriendly === true).length;
        if (currentFriendlyShips >= SHIP_CONFIG.LIMIT) { return; }
    } else {
        const currentHostileShips = State.ships.filter(en => en.type === 'ship' && en.isFriendly === false).length;
        // Hostile stations have their own local limit based on SHIP_CONFIG.LIMIT
        if (currentHostileShips >= SHIP_CONFIG.LIMIT * 3) { return; } // Allowing more hostiles than friends for balance
    }
    // Spawn 7 independent ships
    for (let i = 0; i < 7; i++) {
        const spawnDist = station.r * 2.0 + Math.random() * 50;
        const spawnAngle = Math.random() * Math.PI * 2;

        const squadX = station.x + Math.cos(spawnAngle) * spawnDist;
        const squadY = station.y + Math.sin(spawnAngle) * spawnDist;

        let e = {
            a: spawnAngle + Math.PI,
            aiState: 'FORMATION',
            blinkNum: 30,
            fleetHue: station.fleetHue,
            formationOffset: { x: 0, y: 0 },
            isFriendly: station.isFriendly,
            leaderRef: null,
            mass: 30,
            r: SHIP_CONFIG.SIZE / 2,
            reloadTime: 100 + Math.random() * 100,
            role: 'wingman', // Spawns as independent stray
            score: 0,
            shieldHitTimer: 0,
            squadId: null,
            structureHP: SHIP_CONFIG.RESISTANCE,
            thrusting: false,
            tier: 0,
            type: 'ship',
            x: squadX,
            xv: station.xv + (Math.random() - 0.5),
            y: squadY,
            yv: station.yv + (Math.random() - 0.5),
            z: 0,
            homeStation: station,
            bulletSpeed: 15 + Math.random() * 10,
            bulletSize: 4 + Math.random() * 3,
            bulletLife: 45 + Math.random() * 15,
            shootDelay: Math.random() * 20
        };

        State.ships.push(e);
    }
}

export function getShipTier(ship) {
    let score = Math.max(0, ship.score);
    let step = SHIP_CONFIG.EVOLUTION_SCORE_STEP || 1000;

    let tier = 0;
    let requiredScoreForNextTier = step;
    let currentTierThreshold = 0;

    while (score >= currentTierThreshold + requiredScoreForNextTier) {
        currentTierThreshold += requiredScoreForNextTier;
        tier++;
        if (tier >= 7) {
            requiredScoreForNextTier = (tier - 5) * step; // Tier 7->8: 2000, Tier 8->9: 3000...
        } else {
            requiredScoreForNextTier = step;
        }
    }

    return tier;
}

export function generatePlanetName() {
    const s1 = syllables[Math.floor(Math.random() * syllables.length)];
    const s2 = syllables[Math.floor(Math.random() * syllables.length)];
    const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${s1}${s2.toLowerCase()} ${suf}`;
}

export function increaseShipScore(ship, reward) {
    ship.score += reward;
    const newTier = getShipTier(ship);

    if (ship === State.playerShip) {
        // Only show message if tier <= 12 OR if we are devolving
        if (newTier !== ship.tier) {
            if (newTier > ship.tier) {
                if (newTier === 12 && ship.tier < 12) {
                    addScreenMessage(t("game.divine_meta_begins"), "#00ffff");
                    addScreenMessage(t("game.dangerous_shots"), "#ffaa00");
                    ship.transformationTimer = 600; // ~10 seconds at 60fps
                } else if (newTier < 12) {
                    addScreenMessage(t("game.evolved_to", { shape: getShapeName(newTier) }), "#00ff00");
                }
            }
            else if (ship.tier < 12) {
                addScreenMessage(t("game.devolved_to", { shape: getShapeName(newTier) }), "#ff0000");
            } else {
                ship.transformationTimer = 0; // Cancel transformation if devolved
            }
        }
    }

    ship.tier = newTier;
}


export function onShipDestroyed(ship, killerShip = null) {
    if (killerShip === State.playerShip) {
        if (ship.isFriendly && !State.playerShip.loneWolf) {
            increaseShipScore(killerShip, -SCORE_REWARDS.SHIP_KILLED);
            triggerBetrayal();
            return;
        }

        increaseShipScore(killerShip, SCORE_REWARDS.SHIP_KILLED);
    }
}

export function onStationDestroyed(station, killerShip = null) {
    if (station) {
        let junkAst = createAsteroid(station.x + ASTEROID_CONFIG.SPLIT_OFFSET, station.y, ASTEROID_CONFIG.MIN_SIZE);
        junkAst.xv = station.xv + ASTEROID_CONFIG.MAX_SPEED;
        junkAst.yv = station.yv;
        junkAst.blinkNum = 30;
        State.roids.push(junkAst);
        updateAsteroidCounter();
    };

    if (killerShip === State.playerShip) {
        if (station.isFriendly && !State.playerShip.loneWolf) {
            increaseShipScore(killerShip, -SCORE_REWARDS.STATION_KILLED);
            triggerBetrayal();
            return;
        }

        State.playerShip.shield = State.playerShip.maxShield;
        increaseShipScore(killerShip, SCORE_REWARDS.STATION_KILLED);
        // stationsDestroyedCount handled locally in main.js if needed, or moved to State

        State.playerShip.lives++;
        drawLives();
        addScreenMessage(t("game.extra_life"));

        State.playerShip.structureHP = SHIP_CONFIG.RESISTANCE;
        State.playerShip.shield = State.playerShip.maxShield;
    }
}

export function createExplosionDebris(cx, cy, count, isHot = false) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const offset = Math.random() * 600; // Spread them out widely to prevent overlap cascades
        const x = cx + Math.cos(angle) * offset;
        const y = cy + Math.sin(angle) * offset;

        // Make debris smaller than MAX_SIZE to avoid instant giant splitting chains
        const maxDebrisSize = ASTEROID_CONFIG.MAX_SIZE * 0.5;
        const r = ASTEROID_CONFIG.MIN_SIZE + Math.random() * (maxDebrisSize - ASTEROID_CONFIG.MIN_SIZE);
        const roid = createAsteroid(x, y, r);

        if (isHot) {
            roid.isHot = true;
            roid.color = `hsl(${20 + Math.random() * 30}, 80%, 30%)`;
        }

        const speedBase = isHot ? ASTEROID_CONFIG.MAX_SPEED * 4.0 : ASTEROID_CONFIG.MAX_SPEED * 2.0;
        const speed = (0.5 + Math.random() * 0.5) * speedBase;

        roid.xv = Math.cos(angle) * speed;
        roid.yv = Math.sin(angle) * speed;
        roid.rotSpeed = (Math.random() - 0.5) * 0.4;
        roid.blinkNum = 120; // 2 seconds of ghosting to give them time to spread out

        State.roids.push(roid);
    }
}

function triggerBetrayal() {
    if (State.playerShip.loneWolf) return;
    State.playerShip.leaderRef = null;
    State.playerShip.loneWolf = true;
    State.playerShip.squadId = null;
    addScreenMessage(t("game.betrayal"), "#ff0000");

    State.ships.forEach(ship => {
        if (ship.isFriendly) {
            ship.isFriendly = false;
            ship.aiState = 'COMBAT';
            ship.fleetHue = 0;
        }
    });
}
