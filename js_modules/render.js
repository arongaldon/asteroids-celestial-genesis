import { ASTEROID_CONFIG, BOUNDARY_CONFIG, PLANET_CONFIG, PLAYER_CONFIG, SCORE_REWARDS, SHIP_CONFIG, STATION_CONFIG, FPS, FRICTION, G_CONST, MAX_Z_DEPTH, MIN_DURATION_TAP_TO_MOVE, SCALE_IN_MOUSE_MODE, SCALE_IN_TOUCH_MODE, WORLD_BOUNDS, ZOOM_LEVELS, suffixes, syllables, DOM } from './config.js';
import { State } from './state.js';

export function drawPlanetTexture(ctx, x, y, r, textureData) {
    if (!textureData || isNaN(x) || isNaN(y) || isNaN(r)) return;
    let grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, textureData.innerGradColor);
    grad.addColorStop(0.1, textureData.waterColor);
    grad.addColorStop(1, textureData.waterColor);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = textureData.landColor;
    textureData.landmasses.forEach(lm => {
        ctx.beginPath();
        const radius = r * lm.radiusFactor;
        const centerX = x + Math.cos(lm.startAngle) * radius * 0.5;
        const centerY = y + Math.sin(lm.startAngle) * radius * 0.5;
        for (let j = 0; j < lm.vertices; j++) {
            const angle = (j / lm.vertices) * Math.PI * 2;
            const dist = radius * lm.vertexOffsets[j];
            const px = centerX + Math.cos(angle) * dist;
            const py = centerY + Math.sin(angle) * dist;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = textureData.craterColor;
    textureData.craters.forEach(cr => {
        const cx = x + cr.xFactor * r;
        const cy = y + cr.yFactor * r;
        const crr = r * cr.rFactor;
        if (Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) + crr < r) {
            ctx.beginPath(); ctx.arc(cx, cy, crr, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`; ctx.lineWidth = 1; ctx.stroke();
        }
    });
    textureData.age += 0.001;
    ctx.fillStyle = textureData.cloudColor;
    textureData.clouds.forEach(cl => {
        const angle = textureData.cloudOffset + cl.angleRng + textureData.age * cl.ageFactorRng;
        const dist = r * cl.distRng;
        const cx = x + Math.cos(angle) * dist;
        const cy = y + Math.sin(angle) * dist;
        const cr = r * cl.crRng;
        const rotation = cl.rotationRng;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
        ctx.beginPath(); ctx.ellipse(0, 0, cr * 1.5, cr * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    let atmGrad = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.1);
    atmGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
    atmGrad.addColorStop(0.5, textureData.atmosphereColor);
    atmGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = atmGrad; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = textureData.atmosphereColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

export function drawRadar() {
    try {
        const rW = DOM.canvasRadar.width; const rH = DOM.canvasRadar.height;
        const cX = rW / 2; const cY = rH / 2;
        DOM.canvasRadarContext.clearRect(0, 0, rW, rH);

        const radarRadius = rW / 2;
        const scale = radarRadius / Math.max(1, State.RADAR_RANGE);

        const drawBlip = (worldX, worldY, type, color, size, z = 0) => {
            if (!isFinite(worldX) || !isFinite(worldY) || isNaN(worldX) || isNaN(worldY)) return;

            let dx = worldX - State.worldOffsetX;
            let dy = worldY - State.worldOffsetY;

            // Safety check for worldOffset being invalid
            if (isNaN(dx) || isNaN(dy)) return;

            let dist = Math.sqrt(dx * dx + dy * dy);

            // Ensure large objects like planets are drawn if their edge touches the radar range
            if (dist - size > State.RADAR_RANGE || !isFinite(dist)) return;

            let angle = Math.atan2(dy, dx);
            let radarDist = dist * scale;
            let radarSize = (size * scale) / (1 + z);

            // Ensure elements are visible on the radar regardless of zoom
            if (type === 'planet') radarSize = Math.max(4, radarSize);
            else if (type === 'asteroid') radarSize = Math.max(1.5, radarSize);
            else radarSize = Math.max(2, radarSize); // Default minimum for State.ships/etc

            // Safety check for radarSize
            if (isNaN(radarSize) || !isFinite(radarSize)) radarSize = 2;

            // Snap small objects to the radar border, but let massive planets overflow naturally
            if (type !== 'planet' && type !== 'asteroid' && radarDist > radarRadius - radarSize) {
                radarDist = Math.max(0, radarRadius - radarSize - 1);
            }

            if (isNaN(radarDist) || !isFinite(radarDist)) return;

            let rx = cX + radarDist * Math.cos(angle);
            let ry = cY + radarDist * Math.sin(angle);

            if (isNaN(rx) || isNaN(ry)) return;

            DOM.canvasRadarContext.fillStyle = color;
            DOM.canvasRadarContext.strokeStyle = color;

            if (type === 'station') {
                DOM.canvasRadarContext.font = "bold 12px Courier New";
                DOM.canvasRadarContext.textAlign = 'center';
                DOM.canvasRadarContext.textBaseline = 'middle';
                DOM.canvasRadarContext.fillText('O', rx, ry);
            } else if (type === 'asteroid') {
                DOM.canvasRadarContext.beginPath();
                DOM.canvasRadarContext.arc(rx, ry, radarSize, 0, Math.PI * 2);
                DOM.canvasRadarContext.stroke();
            } else {
                DOM.canvasRadarContext.beginPath();
                DOM.canvasRadarContext.arc(rx, ry, radarSize, 0, Math.PI * 2);
                DOM.canvasRadarContext.fill();
            }
        };

        State.roids.forEach(r => {
            if (r.isPlanet) {
                const color = r.textureData ? r.textureData.waterColor : 'rgba(0, 150, 255, 0.7)';
                if (r.z < 0.5) {
                    drawBlip(r.x, r.y, 'planet', color, r.r, r.z);
                } else {
                    drawBlip(r.x, r.y, 'background_planet', color, 4, r.z); // Small dot for far away planets
                }
            }
        });

        State.roids.forEach(r => {
            if (!r.isPlanet && r.z <= 0.1) {
                drawBlip(r.x, r.y, 'asteroid', 'rgba(200, 200, 200, 0.9)', r.r, r.z);
            }
        });

        State.ships.forEach(e => {
            if (e.z <= 0.1) {
                const color = e.isFriendly ? '#0088FF' : '#FF0000';
                if (e.type === 'station') {
                    drawBlip(e.x, e.y, 'station', color, 0, e.z);
                } else {
                    drawBlip(e.x, e.y, 'ship', color, 2, e.z);
                }
            }
        });

        DOM.canvasRadarContext.strokeStyle = 'rgba(0, 255, 255, 0.2)'; DOM.canvasRadarContext.lineWidth = 1;
        DOM.canvasRadarContext.beginPath(); DOM.canvasRadarContext.moveTo(cX, 0); DOM.canvasRadarContext.lineTo(cX, rH); DOM.canvasRadarContext.stroke();
        DOM.canvasRadarContext.beginPath(); DOM.canvasRadarContext.moveTo(0, cY); DOM.canvasRadarContext.lineTo(rW, cY); DOM.canvasRadarContext.stroke();
        DOM.canvasRadarContext.beginPath(); DOM.canvasRadarContext.arc(cX, cY, rW / 2 - 1, 0, Math.PI * 2); DOM.canvasRadarContext.stroke();
        DOM.canvasRadarContext.fillStyle = '#0ff'; DOM.canvasRadarContext.beginPath(); DOM.canvasRadarContext.arc(cX, cY, 3, 0, Math.PI * 2); DOM.canvasRadarContext.fill();

        // 4. HOME PLANET NAVIGATOR (Dotted path to home)
        if (State.homePlanetId) {
            const home = State.roids.find(r => r.id === State.homePlanetId);
            if (home) {
                let dx = home.x - State.worldOffsetX;
                let dy = home.y - State.worldOffsetY;
                let dist = Math.sqrt(dx * dx + dy * dy);
                let angle = Math.atan2(dy, dx);

                // Calculate radar position for home planet blip
                let radarDist = dist * scale;
                if (radarDist > radarRadius - 5) radarDist = radarRadius - 5;

                let rx = cX + radarDist * Math.cos(angle);
                let ry = cY + radarDist * Math.sin(angle);

                // Draw dotted line
                DOM.canvasRadarContext.setLineDash([3, 5]);
                DOM.canvasRadarContext.strokeStyle = 'rgba(0, 255, 255, 0.5)';
                DOM.canvasRadarContext.lineWidth = 1;
                DOM.canvasRadarContext.beginPath();
                DOM.canvasRadarContext.moveTo(cX, cY);
                DOM.canvasRadarContext.lineTo(rx, ry);
                DOM.canvasRadarContext.stroke();
                DOM.canvasRadarContext.setLineDash([]); // Reset dash

                // Ensure home blip is always visible on radar edge if far away
                DOM.canvasRadarContext.fillStyle = '#00ffaa';
                DOM.canvasRadarContext.beginPath();
                DOM.canvasRadarContext.arc(rx, ry, 4, 0, Math.PI * 2);
                DOM.canvasRadarContext.fill();

                // Pulse effect for home planet
                if (Date.now() % 1000 < 500) {
                    DOM.canvasRadarContext.strokeStyle = '#00ffaa';
                    DOM.canvasRadarContext.beginPath();
                    DOM.canvasRadarContext.arc(rx, ry, 7, 0, Math.PI * 2);
                    DOM.canvasRadarContext.stroke();
                }
            }
        }
    } catch (e) {
        console.error("Radar drawing error:", e);
    }
}

export function drawHeart(ctx, x, y, size) {
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

export function drawLives() {
    DOM.livesDisplay.innerText = `${State.playerShip.lives}`;
    DOM.livesDisplay.style.color = '#0ff';
    DOM.livesDisplay.style.marginTop = '5px';
}

export function updateHUD() {
    if (DOM.scoreDisplay && State.playerShip) {
        const currentScore = State.playerShip.score || 0;
        DOM.scoreDisplay.innerText = isNaN(currentScore) ? 0 : currentScore;
    }
    if (DOM.asteroidCountDisplay) {
        DOM.asteroidCountDisplay.innerText = State.roids.filter(r => !r.isPlanet).length;
    }
    if (DOM.hudTop && State.velocity && State.playerShip && !State.playerShip.dead) {
        const spd = Math.sqrt(State.velocity.x ** 2 + State.velocity.y ** 2);
        // Decrease opacity as speed increases. Min opacity is 0.05 when at max speed.
        let opacity = 1.0 - (spd / SHIP_CONFIG.MAX_SPEED) * 0.95;
        opacity = Math.max(0.05, Math.min(1.0, opacity));
        DOM.hudTop.style.opacity = opacity.toFixed(2);
    } else if (DOM.hudTop) {
        DOM.hudTop.style.opacity = 1.0;
    }
}

export function updateAsteroidCounter() {
    updateHUD();
}

export function showInfoLEDText(text) {
    DOM.infoLED.innerHTML = '';
    const characters = text.split('');
    let i = 0;
    let line = '';
    function show() {
        if (i < characters.length) {
            const char = characters[i];
            line += char;
            DOM.infoLED.textContent = line;
            i++;
            setTimeout(show, 50);
        }
    }
    show();
}

export function addScreenMessage(text, color = "white") {
    // Avoid duplicate messages if they are the same
    if (State.screenMessages.length > 0 && State.screenMessages[State.screenMessages.length - 1].text === text) return;
    State.screenMessages.push({ text, color, life: 180 }); // 3 seconds at 60fps

    // Limit to 2 most recent messages
    if (State.screenMessages.length > 2) {
        State.screenMessages.shift();
    }
}

export function drawRings(ctx, rings, planetRadius, depthScale) {
    ctx.save();
    ctx.rotate(rings.tilt);
    rings.bands.forEach(band => {
        const bandRadius = planetRadius * band.rRatio;
        const bandWidth = planetRadius * band.wRatio;
        const outerRadius = bandRadius * depthScale;
        ctx.lineWidth = bandWidth * depthScale;
        ctx.strokeStyle = band.color;
        ctx.globalAlpha = band.alpha * depthScale;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 0, outerRadius, outerRadius * 0.15, 0, 0, Math.PI, false);
        ctx.stroke();
    });
    ctx.restore();
}
