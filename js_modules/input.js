import { ASTEROID_CONFIG, BOUNDARY_CONFIG, PLANET_CONFIG, PLAYER_CONFIG, SCORE_REWARDS, SHIP_CONFIG, STATION_CONFIG, FPS, FRICTION, G_CONST, MAX_Z_DEPTH, MIN_DURATION_TAP_TO_MOVE, SCALE_IN_MOUSE_MODE, SCALE_IN_TOUCH_MODE, WORLD_BOUNDS, ZOOM_LEVELS, suffixes, syllables, DOM } from './config.js';
import { State } from './state.js';
import { AudioEngine } from './audio.js';
import { addScreenMessage } from './render.js';

export function changeRadarZoom(direction) {
    let newIndex = State.currentZoomIndex + direction;

    if (newIndex < 0) newIndex = 0;
    if (newIndex >= ZOOM_LEVELS.length) newIndex = ZOOM_LEVELS.length - 1;

    if (newIndex !== State.currentZoomIndex) {
        State.currentZoomIndex = newIndex;
        State.RADAR_RANGE = ZOOM_LEVELS[State.currentZoomIndex];
    }
}

export function shootLaser() {
    if (!State.gameRunning || State.playerShip.dead || State.victoryState) return;
    if (State.playerReloadTime > 0) return;
    State.playerReloadTime = PLAYER_CONFIG.RELOAD_TIME_MAX;
    fireEntityWeapon(State.playerShip, State.playerShipBullets, false);
}

export function fireEntityWeapon(ship, bulletList, isEnemy = true) {
    const isPlayer = (ship === State.playerShip);
    const tier = isPlayer ? ship.tier : Math.floor(ship.score / SHIP_CONFIG.EVOLUTION_SCORE_STEP);

    if (isPlayer && tier >= 12) {
        if (ship.transformationTimer > 0) {
            // Cannot fire while transforming to Godship
            if (State.playerReloadTime <= 0) {
                addScreenMessage("ENERGY UNSTABLE: TRANSFORMING...", "#ffaa00");
                State.playerReloadTime = 30; // Brief internal cooldown for message
            }
            return;
        }
        fireGodWeapon(ship);
        return;
    }

    const hue = ship.fleetHue !== undefined ? ship.fleetHue : ((isPlayer || ship.isFriendly) ? SHIP_CONFIG.FRIENDLY_BLUE_HUE : 0);
    const a = isPlayer ? State.playerShip.a : ship.a;

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

        const startX = (isPlayer ? State.worldOffsetX : ship.x) + (fwdX * spawnRadius);
        const startY = (isPlayer ? State.worldOffsetY : ship.y) + (fwdY * spawnRadius);

        const bSpeed = (ship.bulletSpeed || 18) * speedScale;
        const bLife = ship.bulletLife || (isPrimary ? SHIP_CONFIG.BULLET1_LIFETIME : SHIP_CONFIG.BULLET2_LIFETIME);
        const bSize = (ship.bulletSize || 5) * sizeScale;

        const velX = (Math.cos(shootAngle) * bSpeed) + (isPlayer ? State.velocity.x : ship.xv);
        const velY = (Math.sin(shootAngle) * bSpeed) + (isPlayer ? State.velocity.y : ship.yv);

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

    if (isPlayer) AudioEngine.playLaser(State.worldOffsetX, State.worldOffsetY, tier);
    else AudioEngine.playLaser(ship.x, ship.y, tier);
}

export function fireGodWeapon(ship) {
    State.playerReloadTime = PLAYER_CONFIG.RELOAD_TIME_MAX * 5; // Long cooldown for massive power

    // Play Godly sound
    AudioEngine.playLaser(State.worldOffsetX, State.worldOffsetY, 12);

    // One-time announcement handled in metamorphosis completion logic

    // Create the expanding ring
    State.shockwaves.push({
        x: State.worldOffsetX,
        y: State.worldOffsetY,
        r: 100,
        maxR: Math.max(State.width, State.height) * 4, // Reach 4 times the visible viewport (~4000 units)
        strength: 2000,
        alpha: 3.0,
        isGodRing: true,
        type: 'lightning'
    });
}

export function enemyShoot(e, tx, ty) {
    // e.x, e.y, tx, ty are ABSOLUTE WORLD COORDINATES

    if (tx === undefined) tx = State.worldOffsetX;
    if (ty === undefined) ty = State.worldOffsetY;

    let trajectoryAngle = Math.atan2(ty - e.y, tx - e.x); // Correct angle in world space

    let angleDiff = trajectoryAngle - e.a;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

    const FIRE_CONE = Math.PI / 6; // 30 degrees
    if (Math.abs(angleDiff) > FIRE_CONE) return;

    if (!isTrajectoryClear(e, tx, ty)) return;

    let clearShot = true;

    for (let other of State.ships) {
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
        fireEntityWeapon(e, State.enemyShipBullets, true);
        e.reloadTime = 30 + Math.random() * 20; // Set cooldown after successful shot
    }
}

export function isTrajectoryClear(e, targetX, targetY) {
    const trajectoryAngle = Math.atan2(targetY - e.y, targetX - e.x);
    const distToTarget = Math.hypot(targetX - e.x, targetY - e.y);

    // Check against player
    if (!State.playerShip.dead) {
        if (e.isFriendly) {
            // Friendlies check if player is in way
            const distToPlayer = Math.hypot(State.worldOffsetX - e.x, State.worldOffsetY - e.y);
            if (distToPlayer < distToTarget) {
                const angleToPlayer = Math.atan2(State.worldOffsetY - e.y, State.worldOffsetX - e.x);
                let diff = Math.abs(trajectoryAngle - angleToPlayer);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if (diff < 0.2) return false; // Player is in way
            }
        } else {
            // State.ships check if other State.ships are in way
            // (Standard enemy behavior handled in enemyShoot, but let's be thorough)
        }
    }

    // Check against all other State.ships/stations
    for (let other of State.ships) {
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

export function proactiveCombatScanner(e) {
    if (e.reloadTime > 0) return;

    // 1. SCAN FOR RIVALS
    for (let target of State.ships) {
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

    // 2. SCAN FOR ASTEROID_CONFIG.COUNT (Defend Home Station)
    // Priority: Asteroids near the home station
    if (e.homeStation) {
        for (let r of State.roids) {
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
    for (let r of State.roids) {
        if (r.z > 0.5 || r.isPlanet) continue;
        const dist = Math.hypot(r.x - e.x, r.y - e.y);
        if (dist < 1500) {
            enemyShoot(e, r.x, r.y);
            if (e.reloadTime > 0) return;
        }
    }

    // 3. SCAN FOR PLAYER (if enemy)
    if (!e.isFriendly && !State.playerShip.dead) {
        const dist = Math.hypot(State.worldOffsetX - e.x, State.worldOffsetY - e.y);
        if (dist < 2000) {
            enemyShoot(e, State.worldOffsetX, State.worldOffsetY);
        }
    }
}

