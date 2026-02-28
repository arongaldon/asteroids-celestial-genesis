import { SHIP_CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { fireEntityWeapon } from '../systems/combat.js';

export function enemyShoot(e, tx, ty) {
    // e.x, e.y, tx, ty are ABSOLUTE WORLD COORDINATES

    if (tx === undefined) tx = State.worldOffsetX;
    if (ty === undefined) ty = State.worldOffsetY;

    const isPlayer = e === State.playerShip;
    const tier = isPlayer ? e.tier : Math.floor((e.score || 0) / SHIP_CONFIG.EVOLUTION_SCORE_STEP);

    // AI Godships should be extremely careful with their Ring of Power
    if (!isPlayer && tier >= 12) {
        let alliesNear = false;
        const SAFETY_RADIUS = 2500;

        // Check for friendly planets nearby
        for (let r of State.roids) {
            if (r.isPlanet) {
                let isFriendlyPlanet = false;
                if (e.isFriendly && r.id === State.homePlanetId) isFriendlyPlanet = true;
                if (!e.isFriendly && r.textureData && r.textureData.fleetHue === e.fleetHue) isFriendlyPlanet = true;

                if (isFriendlyPlanet && Math.hypot(r.x - e.x, r.y - e.y) < SAFETY_RADIUS) {
                    alliesNear = true;
                    break;
                }
            }
        }

        // Check for fellow allied ships nearby
        if (!alliesNear) {
            for (let other of State.ships) {
                if (other === e) continue;
                let isAlly = false;
                if (e.isFriendly && other.isFriendly) isAlly = true;
                if (!e.isFriendly && !other.isFriendly && e.fleetHue === other.fleetHue) isAlly = true;

                if (isAlly && Math.hypot(other.x - e.x, other.y - e.y) < SAFETY_RADIUS) {
                    alliesNear = true;
                    break;
                }
            }
        }

        // If allies or own planet are within blast range, suppress the God Weapon
        if (alliesNear) return;
    }

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

    // 2. SCAN FOR ENEMY PLANETS (Friendly Wingmen)
    if (e.isFriendly) {
        for (let r of State.roids) {
            if (r.isPlanet && r.z < 0.5 && r.id !== State.homePlanetId && !r._destroyed) {
                const dist = Math.hypot(r.x - e.x, r.y - e.y);
                if (dist < 2000) {
                    enemyShoot(e, r.x, r.y);
                    if (e.reloadTime > 0) return;
                }
            }
        }
    }

    // 3. SCAN FOR ASTEROID_CONFIG.COUNT (Defend Home Station)
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
