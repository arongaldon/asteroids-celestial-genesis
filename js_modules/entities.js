import { ASTEROID_MAX_SIZE, ASTEROID_MIN_SIZE, ASTEROID_SPEED_LIMIT, ASTEROID_SPLIT_OFFSET, ASTEROID_SPLIT_SPEED, FPS, PLANETS_LIMIT, PLAYER_INITIAL_LIVES, SHIPS_LIMIT, SHIP_BASE_MAX_SHIELD, SHIP_EVOLUTION_SCORE_STEP, SHIP_FRIENDLY_BLUE_HUE, SHIP_KILLED_REWARD, SHIP_RESISTANCE, SHIP_SIZE, STATIONS_SPAWN_TIMER, STATION_KILLED_REWARD, STATION_RESISTANCE, WORLD_BOUNDS, suffixes, syllables } from './config.js';
import { State } from './state.js';
import { mulberry32, getShapeName } from './utils.js';
import { addScreenMessage, updateAsteroidCounter, drawLives } from './render.js';

export function newPlayerShip() {
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
        role: 'leader',
        score: 0,
        shield: SHIP_BASE_MAX_SHIELD,
        squadId: null,
        squadSlots: [
            { x: -150, y: -150, occupant: null }, { x: 150, y: -150, occupant: null },
            { x: -300, y: -300, occupant: null }, { x: 300, y: -300, occupant: null },
            { x: -450, y: -450, occupant: null }, { x: 450, y: -450, occupant: null },
            { x: 0, y: -600, occupant: null }
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
    if (r > ASTEROID_MAX_SIZE) {
        const currentPlanets = State.roids.filter(ro => ro.isPlanet && !ro._destroyed).length;
        if (currentPlanets < PLANETS_LIMIT) {
            isPlanet = true;
        } else {
            r = ASTEROID_MAX_SIZE;
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
        color: `hsl(${Math.random() * 360}, ${5 + Math.random() * 5}%, ${5 + Math.random() * 10}%)` // Almost black, low saturation
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
    if (Math.random() < 0.25 || r > ASTEROID_MAX_SIZE + 100) {
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
        const r = (Math.random() < 0.5 ? 0.5 : 0.25) * ASTEROID_MAX_SIZE;
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
    State.stationSpawnTimer = STATIONS_SPAWN_TIMER + Math.random() * STATIONS_SPAWN_TIMER;
}

export function spawnShipsSquad(station) {
    // Avoid spawning more than SHIPS_LIMIT total State.ships (including players for friendly squads)
    if (station.isFriendly) {
        const currentFriendlyShips = State.ships.filter(en => en.type === 'ship' && en.isFriendly === true).length;
        if (currentFriendlyShips >= SHIPS_LIMIT) { return; }
    } else {
        const currentHostileShips = State.ships.filter(en => en.type === 'ship' && en.isFriendly === false).length;
        // Hostile stations have their own local limit based on SHIPS_LIMIT
        if (currentHostileShips >= SHIPS_LIMIT * 3) { return; } // Allowing more hostiles than friends for balance
    }
    const squadId = Math.random();

    let formationData = [
        { role: 'leader', x: 0, y: 0 },
        { role: 'wingman', x: -150, y: -150 }, { role: 'wingman', x: 150, y: -150 },
        { role: 'wingman', x: -300, y: -300 }, { role: 'wingman', x: 300, y: -300 },
        { role: 'wingman', x: -450, y: -450 }, { role: 'wingman', x: 450, y: -450 }
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
        if (station.isFriendly && State.playerShip.dead === false && State.playerShip.squadId === null) {
            e = State.playerShip;
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
            // Always ensure the leader has 7 squad slots (for wingmen 1-7)
            if (!leader.squadSlots || leader.squadSlots.length < 7) {
                leader.squadSlots = [
                    { x: -150, y: -150, occupant: null }, { x: 150, y: -150, occupant: null },
                    { x: -300, y: -300, occupant: null }, { x: 300, y: -300, occupant: null },
                    { x: -450, y: -450, occupant: null }, { x: 450, y: -450, occupant: null },
                    { x: 0, y: -600, occupant: null } // 7th slot
                ];
            }
            // Clear current occupants for this specific squad spawn session
            leader.squadSlots.forEach(s => s.occupant = null);
        } else {
            e.leaderRef = leader;
            // Register this wingman in the leader's slot list
            if (leader) {
                // Determine which list to use (player or NPC leader)
                const slots = leader === State.playerShip ? State.playerShip.squadSlots : leader.squadSlots;
                if (slots) {
                    // Find an empty slot or a slot matching our offset
                    let targetSlot = slots.find(s => !s.occupant && s.x === slot.x && s.y === slot.y);
                    if (!targetSlot) targetSlot = slots.find(s => !s.occupant);
                    if (targetSlot) {
                        targetSlot.occupant = e;
                    } else {
                        // Fallback: push if no slots left (though we initialized 7)
                        slots.push({
                            x: slot.x,
                            y: slot.y,
                            occupant: e
                        });
                    }
                }
            }
        }

        State.ships.push(e);
    });
}

export function getShipTier(ship) {
    return Math.max(0, Math.floor(ship.score / SHIP_EVOLUTION_SCORE_STEP));
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


export function onShipDestroyed(ship, killerShip = null) {
    if (killerShip === State.playerShip) {
        if (ship.isFriendly && !State.playerShip.loneWolf) {
            triggerBetrayal();
            return;
        }

        increaseShipScore(killerShip, SHIP_KILLED_REWARD);
    }
}

export function onStationDestroyed(station, killerShip = null) {
    if (station) {
        let junkAst = createAsteroid(station.x + ASTEROID_SPLIT_OFFSET, station.y, ASTEROID_MIN_SIZE);
        junkAst.xv = station.xv + ASTEROID_SPLIT_SPEED;
        junkAst.yv = station.yv;
        junkAst.blinkNum = 30;
        State.roids.push(junkAst);
        updateAsteroidCounter();
    };

    if (killerShip === State.playerShip) {
        if (station.isFriendly && !State.playerShip.loneWolf) {
            triggerBetrayal();
            return;
        }

        State.playerShip.shield = State.playerShip.maxShield;
        increaseShipScore(killerShip, STATION_KILLED_REWARD);
        // stationsDestroyedCount handled locally in main.js if needed, or moved to State

        State.playerShip.lives++;
        drawLives();
        addScreenMessage("EXTRA LIFE!");

        State.playerShip.structureHP = SHIP_RESISTANCE;
        State.playerShip.shield = State.playerShip.maxShield;
    }
}

export function createExplosionDebris(cx, cy, count, isHot = false) {
    for (let i = 0; i < count; i++) {
        const x = cx;
        const y = cy;
        const r = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);
        const roid = createAsteroid(x, y, r);

        if (isHot) {
            roid.isHot = true;
            roid.color = `hsl(${20 + Math.random() * 30}, 80%, 30%)`;
        }

        const angle = Math.random() * Math.PI * 2;
        const speedBase = isHot ? ASTEROID_SPEED_LIMIT * 2.0 : ASTEROID_SPEED_LIMIT;
        const speed = Math.random() * speedBase;

        roid.xv = Math.cos(angle) * speed;
        roid.yv = Math.sin(angle) * speed;
        roid.rotSpeed = (Math.random() - 0.5) * 0.2;

        State.roids.push(roid);
    }
}

function triggerBetrayal() {
    if (State.playerShip.loneWolf) return;
    State.playerShip.leaderRef = null;
    State.playerShip.loneWolf = true;
    State.playerShip.squadId = null;
    addScreenMessage("⚠ BETRAYAL: YOU ARE NOW A LONE WOLF!", "#ff0000");

    State.ships.forEach(ship => {
        if (ship.isFriendly) {
            ship.isFriendly = false;
            ship.aiState = 'COMBAT';
            ship.fleetHue = 0;
        }
    });
}
