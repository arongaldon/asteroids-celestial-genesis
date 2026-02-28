import { SHIP_CONFIG, PLAYER_CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { AudioEngine } from '../audio/audio.js';
import { addScreenMessage } from '../graphics/render.js';

export function fireEntityWeapon(ship, bulletList, isEnemy = true) {
    const isPlayer = (ship === State.playerShip);
    const tier = isPlayer ? ship.tier : Math.floor(ship.score / SHIP_CONFIG.EVOLUTION_SCORE_STEP);

    if (tier >= 12) {
        if (ship.transformationTimer > 0) {
            // Cannot fire while transforming to Godship
            if (isPlayer && State.playerReloadTime <= 0) {
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
        const speedScale = 1 + (tier * 0.1);
        const sizeScale = 1 + (tier * 0.18); // Increased size scale to compensate for lower count in high tiers

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
            owner: ship,
            ignoreGravity: tier >= 8
        };
        bulletList.push(bullet);
    };

    // --- TIER PATTERNS (Clearly more powerful with each step) ---
    if (tier === 11) { // THE HYPERION
        pushBullet(0, true);
        for (let i = 1; i <= 10; i++) { // From 20 to 10 (Total 21)
            pushBullet(i * 0.02, true); pushBullet(-i * 0.02, true);
        }
    } else if (tier === 10) { // THE TITAN
        pushBullet(0, true);
        for (let i = 1; i <= 6; i++) { // From 10 to 6 (Total 13)
            pushBullet(i * 0.04, true); pushBullet(-i * 0.04, true);
        }
    } else if (tier === 9) { // THE CELESTIAL
        pushBullet(0, true);
        for (let i = 1; i <= 3; i++) { // From 5 to 3 (Total 7)
            pushBullet(i * 0.08, true); pushBullet(-i * 0.08, true);
        }
    } else if (tier === 8) { // THE SPHERE
        pushBullet(0, true);
        pushBullet(0.12, true); pushBullet(-0.12, true);
        pushBullet(0.24, true); pushBullet(-0.24, true);
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
    const isPlayer = ship === State.playerShip;

    if (isPlayer) {
        State.playerReloadTime = PLAYER_CONFIG.RELOAD_TIME_MAX * 5; // Long cooldown for massive power
    } else {
        ship.reloadTime = 300; // 5 seconds for AI Godship weapon
    }

    const originX = isPlayer ? State.worldOffsetX : ship.x;
    const originY = isPlayer ? State.worldOffsetY : ship.y;

    // Play Godly sound
    AudioEngine.playLaser(originX, originY, 12);

    // One-time announcement handled in metamorphosis completion logic

    // Create the expanding ring
    State.shockwaves.push({
        x: originX,
        y: originY,
        r: 100,
        maxR: Math.max(State.width, State.height) * 3, // Reach 3 times the visible viewport
        strength: 2000,
        alpha: 3.0,
        isGodRing: true,
        type: 'lightning',
        owner: ship // Attach the owner so we know who gets credit/immunity
    });
}
