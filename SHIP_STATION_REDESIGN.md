# Modern Ship & Station Design Overhaul

## Overview

Complete visual redesign of all ships and stations with a sleek, modern aesthetic inspired by the tactical diagram. The new designs feature sharp geometry, vibrant glowing edges, and dynamic visual effects.

## Ship Design (Tiers 0-7)

### Design Philosophy

- **Sharp Triangular Geometry**: Clean, pointed triangle shape pointing forward
- **Glowing Edges**: Bright, vibrant outlines that match the ship's fleet color
- **Internal Details**: Technical detail lines running through the hull
- **Wing Accents**: Geometric wing panels for visual depth
- **Dual Engine Ports**: Two glowing engine ports with animated thrust
- **Tier Indicators**: Small glowing dots showing ship evolution level

### Visual Components

#### 1. Main Hull

- **Shape**: Sharp triangle (1.2x forward, 0.6x back, 0.8x width)
- **Fill**: Linear gradient from bright center to dark edges
- **Outline**: 3px glowing edge in fleet color
- **Shadow**: 25px blur for prominent glow effect

#### 2. Internal Detail Lines

- **Center Line**: Runs from nose to rear
- **Diagonal Lines**: Two lines from center to wings
- **Color**: Bright (100% saturation, 70% lightness)
- **Width**: 1.5px with 10px glow

#### 3. Wing Accents

- **Position**: Top and bottom of hull
- **Shape**: Geometric trapezoid panels
- **Color**: Medium fleet color (80% saturation, 40% lightness)
- **Purpose**: Add visual depth and technical detail

#### 4. Cockpit

- **Position**: Front-center of ship (0.5x from nose)
- **Shape**: Circular with radial gradient
- **Gradient**: White center → fleet color → hull color
- **Rim**: 2px bright outline
- **Glow**: 20px shadow blur

#### 5. Engine Ports

- **Count**: 2 (top and bottom rear)
- **Position**: -0.45x horizontal, ±0.35x vertical
- **Size**: 0.08x radius
- **Color**: Accent color (complementary to fleet hue)
- **Glow**: 15px shadow blur

#### 6. Engine Thrust (Animated)

- **Shape**: Diamond/arrow shape
- **Length**: 20-35px (random variation)
- **Opacity**: 0.6-1.0 (flickering effect)
- **Color**: Fleet color at 100% saturation, 70% lightness
- **Glow**: 30px shadow blur

#### 7. Tier Indicators

- **Count**: 0-7 dots (matches tier level)
- **Position**: Staggered along hull centerline
- **Size**: 0.04x radius
- **Color**: Very bright (100% saturation, 80% lightness)
- **Pattern**: Alternates top/bottom

### Color Palette

```javascript
HULL_COLOR = hsl(fleetHue, 60%, 30%)        // Base hull
HULL_BORDER = hsl(fleetHue, 40%, 50%)       // Lighter border
DETAIL_COLOR = hsl(fleetHue, 80%, 60%)      // Bright details
ACCENT_COLOR = hsl(fleetHue+180, 90%, 60%)  // Complementary
THRUST_COLOR = hsl(fleetHue, 100%, 70%)     // Engine glow
COCKPIT_GRAD_1 = hsl(fleetHue, 100%, 80%)   // Cockpit bright
COCKPIT_GRAD_2 = hsl(fleetHue, 100%, 50%)   // Cockpit mid
```

## Station Design

### Design Philosophy

- **Hexagonal Structure**: 6-sided geometric shape
- **Energy Rings**: Multiple concentric glowing rings
- **Rotating Spokes**: 6 spokes connecting core to outer shell
- **Pulsing Core**: Animated central core with breathing effect
- **Energy Particles**: Orbiting particle effects

### Visual Components

#### 1. Outer Hexagonal Shell

- **Shape**: Regular hexagon (6 sides)
- **Size**: 1.1x station radius
- **Fill**: Radial gradient (bright center → dark edges)
- **Outline**: 4px glowing edge
- **Rotation**: Rotates with station angle
- **Shadow**: 25px blur

#### 2. Energy Rings

- **Outer Ring**: 0.9x radius, 3px width, accent color
- **Middle Ring**: 0.7x radius, 2px width, body color
- **Purpose**: Create depth and energy field effect
- **Glow**: 20px shadow blur

#### 3. Connecting Spokes

- **Count**: 6 (matching hexagon vertices)
- **Length**: From 0.4x to 0.95x radius
- **Width**: 2px
- **Color**: Accent color
- **Nodes**: Small glowing circles at outer ends (0.06x radius)
- **Glow**: 15px shadow blur

#### 4. Pulsing Core

- **Size**: 0.3x radius (±0.05x pulsing)
- **Animation**: Sine wave, 2-second cycle
- **Gradient**: White center → core color → body color
- **Outline**: 2px white rim
- **Glow**: 30px shadow blur
- **Effect**: Creates "breathing" appearance

#### 5. Energy Particles

- **Count**: 8 particles
- **Position**: Orbit at 0.8x radius (±0.1x variation)
- **Size**: 0.03x radius
- **Animation**: Rotate around station (1 rotation/second)
- **Opacity**: 0.6-1.0 (random flicker)
- **Color**: Very bright fleet color

### Color Palette

```javascript
haloColor = hsl(fleetHue, 100%, 70%)        // Outer glow
bodyColor = hsl(fleetHue, 80%, 50%)         // Main structure
coreColor = hsl(fleetHue+120, 100%, 60%)    // Core (triadic)
accentColor = hsl(fleetHue, 90%, 65%)       // Accent details
```

## Technical Implementation

### Performance Optimizations

- Gradients created once per frame
- Particle animations use Date.now() for smooth timing
- Shadow blur reset to 0 after rendering to prevent bleed
- Efficient path drawing with beginPath/closePath

### Animation Details

- **Ship Thrust**: Random length and opacity each frame
- **Station Core**: Sine wave pulse over 2 seconds
- **Station Particles**: Continuous rotation with sine wave radius variation
- **Tier Indicators**: Static but positioned dynamically based on tier

### Scaling

- All dimensions relative to ship/station radius
- Scales properly with tier evolution
- Maintains proportions at all zoom levels
- Works with depth scaling (Z-axis)

## Visual Comparison

### Before

- **Ships**: Simple polygons (triangle → square → pentagon...)
- **Stations**: Basic circles with 4 spokes
- **Style**: Minimal, functional
- **Glow**: Limited shadow effects

### After

- **Ships**: Sharp triangular design with internal details
- **Stations**: Hexagonal with energy rings and particles
- **Style**: Modern, futuristic, tactical
- **Glow**: Extensive use of shadow blur and vibrant colors

## Fleet Color Variations

Each fleet (based on host planet) has unique colors:

- **Player Fleet**: Blue (hue 210°)
- **Enemy Fleets**: Various hues based on planet
- **All Components**: Automatically tinted to fleet color
- **Complementary Accents**: Use opposite hue for contrast

## Special Effects

### Ships

- Animated engine thrust (flickering)
- Glowing cockpit
- Tier progression indicators
- Bright outline glow

### Stations

- Pulsing core (breathing effect)
- Orbiting energy particles
- Rotating hexagonal structure
- Multiple energy rings

## Integration

✅ Works with existing game systems
✅ Compatible with all tiers (0-12)
✅ Maintains collision detection accuracy
✅ Scales with ship evolution
✅ Supports friendly/enemy color schemes
✅ Works with depth (Z-axis) rendering

## Future Enhancement Ideas

- Particle trails for moving ships
- Shield visual effects
- Damage states (cracks, sparks)
- Warp/jump effects
- Formation indicators
- Target lock visuals
