# Asteroids: Celestial Genesis

Asteroids Reimagined: The Classic, Upgraded by Aron Galdon

A modern, visually-rich reimagining of the classic arcade game "Asteroids." Navigate a procedurally generated universe, survive against increasingly difficult odds, and evolve your ship from a simple vessel into a cosmic powerhouse.

## How to Play

### Objective

The goal of **Asteroids: Celestial Genesis** is to score as many points as possible by destroying asteroids and hostile enemy ships. As your score increases, your ship will evolve, granting it new forms and more powerful weapons.

### Controls

The game supports keyboard, mouse, and touch controls.

#### Keyboard

- **Thrust:** `W` or `ArrowUp`
- **Rotate:** `ArrowLeft` and `ArrowRight`
- **Strafe:** `A` and `D`
- **Fire:** `Space`
- **Brake:** `S`
- **Cycle Radar Zoom:** `Z`

#### Mouse

- **Aim:** Move the mouse cursor.
- **Fire:** Left-click

#### Touch

- **Thrust/Brake:** Use the on-screen joystick on the left.
- **Fire:** Use the on-screen fire button on the right.
- **Rotate:** Swipe left or right across the screen.

### Gameplay Features

#### Ship Evolution

Your ship evolves every 10,000 points. Each new tier changes your ship's shape and dramatically upgrades its weapon systems, progressing from a single laser to a devastating omni-directional cannon.

- **Tier 0 (Triangle):** Single laser cannon.
- **Tier 1 (Square):** Double laser cannon.
- **...and beyond!** Discover new forms like the Pentagon, Hexagon, and eventually, the ultimate form: **MEGACORINTIOS**.

#### The Universe

The game takes place in a vast, procedurally generated world.

- **Planets:** Discover unique, named planets with their own gravity, procedurally generated textures, and even planetary rings. Be careful—their gravitational pull can be dangerous!
- **Enemies:** You're not alone. Hostile forces have established a presence in this sector.
  - **Enemy Ships:** Agile fighters that will hunt you down.
  - **Enemy Stations:** Formidable bases that orbit planets and spawn fleets of smaller ships.
- **Dynamic Backgrounds:** The game features a parallaxing background with procedurally generated stars, nebulas, and distant galaxies.

### Secrets & Cheats

The game includes a few hidden cheat codes for those who like to experiment:

- **Bonus:** Double-tap the audio (🔊/🔇) button in-game for a score boost.
- **Epic Mode:** Press and hold the audio button for two seconds to activate invincibility and upgrade your ship to its maximum potential.
- **Reveal Cheats:** On the main menu, press and hold the "INICIAR" (Start) button for two seconds to see the in-game cheat instructions.

## Technical Details

**Asteroids: Celestial Genesis** is built using modern web technologies and features several advanced systems to create a dynamic and engaging experience.

### Procedural Generation

- **Planets:** The game uses a pseudo-random number generator (`mulberry32`) to create planets with unique attributes. Each planet has a generated name, and its surface (water, land, craters, clouds), atmosphere, and rings are all procedurally determined.
- **Asteroids:** Asteroids are generated with irregular polygonal shapes to ensure no two look exactly alike.
- **Backgrounds:** The starfields and nebulas are generated and placed in parallaxing layers to create a sense of depth and scale.

### Physics Engine

- The game features a custom physics engine:
  - **Ship Movement:** Your ship follows Newtonian physics, with forces for thrust and friction.
  - **Gravity:** Planets exert a real gravitational pull on your ship and on all projectiles in the game, requiring you to adjust your aim and trajectory.
  - **Shockwaves:** Large explosions create shockwaves that can push other objects away.

### AI Behavior

- **Enemy Ships:** Enemy AI uses a state-based system. They will patrol, target the player, and even attempt to avoid friendly fire.
- **Enemy Stations:** These are high-level AI entities that serve as spawn points for enemy fleets, creating a persistent threat in the game world.

### Audio Engine

- The game's sound is powered by the Web Audio API.
- All sound effects, from the lasers to the explosions, are generated programmatically.
- The menu features a procedurally generated ambient music track to set the mood.
