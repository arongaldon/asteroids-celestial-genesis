function drawRadar() {
    try {
        const rW = canvasRadar.width; const rH = canvasRadar.height;
        const cX = rW / 2; const cY = rH / 2;
        canvasRadarContext.clearRect(0, 0, rW, rH);

        const radarRadius = rW / 2;
        const scale = radarRadius / Math.max(100, RADAR_RANGE);

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
