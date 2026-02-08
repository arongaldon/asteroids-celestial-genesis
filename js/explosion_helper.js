function createExplosionDebris(cx, cy, count) {
    for (let i = 0; i < count; i++) {
        // Start from center
        const x = cx;
        const y = cy;
        const r = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);
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
