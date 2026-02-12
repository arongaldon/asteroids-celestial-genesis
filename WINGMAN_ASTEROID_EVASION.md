# Wingman Asteroid Danger Detection & Evasion System

## Overview

Squad wingmen (both friendly and enemy) now actively detect and respond to nearby asteroids that pose a collision threat. They will attempt to shoot dangerous asteroids while maintaining formation, and will abandon their squad to save themselves if shooting fails to neutralize the threat.

## Implementation Details

### 1. Danger Detection System

**Collision Prediction Algorithm:**

- Scans all asteroids within 400 units
- Calculates relative velocity between ship and asteroid
- Projects future positions to predict time to closest approach
- Determines if a collision will occur within the next 60 frames (~1 second)
- Considers collision if closest approach distance < ship radius + asteroid radius + 50 units

**Key Parameters:**

```javascript
const DANGER_SCAN_RANGE = 400;      // How far to scan for asteroids
const CRITICAL_DANGER_RANGE = 200;  // Distance for squad abandonment
const SHOOT_RANGE = 600;            // Distance to start shooting
```

### 2. Three-Tier Response System

#### Tier 1: No Danger (Normal Behavior)

- **Condition**: No asteroids on collision course
- **Behavior**:
  - Match leader's heading orientation
  - Maintain formation position
  - Standard rotation logic applies

#### Tier 2: Moderate Danger (Defensive Shooting)

- **Condition**: Dangerous asteroid within 600 units
- **Behavior**:
  - Temporarily override rotation to face the asteroid
  - Faster rotation speed (0.3 vs normal 0.1-0.4)
  - Fire weapons when aligned with asteroid (within 0.3 radians)
  - Continue maintaining formation position
  - Track the threatening asteroid

#### Tier 3: Critical Danger (Squad Abandonment)

- **Condition**: Dangerous asteroid within 200 units AND threat persists for >30 frames
- **Behavior**:
  - **ABANDON SQUAD** - set leaderRef and squadId to null
  - Execute evasive maneuver (move perpendicular to asteroid approach)
  - Apply strong evasive force (3 units)
  - Reset danger tracking
  - Ship becomes independent and will seek new squad later

### 3. Threat Persistence Tracking

Each wingman tracks:

- `asteroidDangerTimer`: Frames the current asteroid has been a threat
- `lastDangerousAsteroid`: Reference to the threatening asteroid

This prevents premature squad abandonment and ensures the ship tries shooting first.

### 4. Collision Course Calculation

The system uses physics-based prediction:

```javascript
// Relative velocity
relVel = asteroid.velocity - ship.velocity

// Time to closest approach
t = -(relPos · relVel) / |relVel|²

// Closest distance
closestDist = |relPos + relVel * t|
```

This accurately predicts whether a collision will occur, accounting for both ship and asteroid movement.

## Behavioral Flow

```
1. Scan nearby asteroids (400 unit radius)
   ↓
2. For each asteroid, predict collision course
   ↓
3. If collision predicted:
   ├─→ Distance > 600: Monitor only
   ├─→ Distance 200-600: Shoot while maintaining formation
   └─→ Distance < 200 for >30 frames: ABANDON SQUAD & EVADE
   ↓
4. If no collision predicted:
   └─→ Resume normal formation behavior
```

## Key Features

✅ **Predictive**: Uses physics to predict collisions, not just proximity
✅ **Graduated Response**: Three tiers from monitoring to abandonment
✅ **Formation Preservation**: Tries to stay in formation while shooting
✅ **Self-Preservation**: Will abandon squad if necessary to survive
✅ **Smart Tracking**: Tracks persistent threats to avoid false positives
✅ **Works for All Squads**: Applies to both friendly and enemy wingmen

## Visual Indicators

When observing wingmen in-game, you'll notice:

- **Normal**: Ships face their leader's direction
- **Moderate Danger**: Ships rotate to face threatening asteroids and fire
- **Critical Danger**: Ships break formation and perform evasive maneuvers

## Performance Considerations

- Only scans asteroids within 400 units (not all asteroids)
- Skips planets and distant asteroids (z > 0.5)
- Collision prediction is computationally efficient
- Danger tracking prevents repeated calculations for same asteroid

## Integration with Existing Systems

- Works seamlessly with existing formation AI
- Compatible with ship separation logic
- Respects reload times and weapon systems
- Integrates with squad joining/leaving mechanics
- Enemy and friendly wingmen both use this system

## Testing Scenarios

1. **Formation Shooting**: Wingmen should shoot asteroids while staying in formation
2. **Squad Abandonment**: Wingmen should leave squad when asteroid gets too close
3. **Rejoining**: After evading, wingmen should eventually seek new squads
4. **Multiple Threats**: System prioritizes closest threatening asteroid
5. **False Positives**: Non-threatening asteroids should be ignored

## Future Enhancements

Potential improvements:

- Visual warning indicators when wingmen detect danger
- Communication between squad members about threats
- Coordinated evasion maneuvers
- Priority targeting (shoot largest threats first)
- Return to original squad after threat is neutralized
