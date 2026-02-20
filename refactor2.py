import re
import os

constants = [
    'ASTEROIDS', 'ASTEROIDS_INIT_INNER', 'ASTEROIDS_INIT_OUTER', 'ASTEROID_DESTROYED_REWARD',
    'ASTEROID_MAX_SIZE', 'ASTEROID_MIN_SIZE', 'ASTEROID_SPEED_LIMIT', 'ASTEROID_SPLIT_OFFSET',
    'ASTEROID_SPLIT_SPEED', 'BOUNDARY_CORRECTION_FORCE', 'BOUNDARY_DAMPENING', 'BOUNDARY_TOLERANCE',
    'BOUNDARY_TOLERANCE_ROIDS', 'FPS', 'FRICTION', 'G_CONST', 'MAX_Z_DEPTH', 'MIN_DURATION_TAP_TO_MOVE',
    'PLANETS_LIMIT', 'PLANET_MAX_SIZE', 'PLANET_THRESHOLD', 'PLAYER_INITIAL_LIVES', 'PLAYER_RELOAD_TIME_MAX',
    'SCALE_IN_MOUSE_MODE', 'SCALE_IN_TOUCH_MODE', 'SHIPS_COMBAT_ORBIT_DISTANCE', 'SHIPS_LIMIT',
    'SHIPS_SEPARATION_DISTANCE', 'SHIPS_SPAWN_TIME', 'SHIP_BASE_MAX_SHIELD', 'SHIP_BULLET1_LIFETIME',
    'SHIP_BULLET2_LIFETIME', 'SHIP_BULLET_FADE_FRAMES', 'SHIP_BULLET_GRAVITY_FACTOR', 'SHIP_EVOLUTION_SCORE_STEP',
    'SHIP_FRIENDLY_BLUE_HUE', 'SHIP_KILLED_REWARD', 'SHIP_MAX_SPEED', 'SHIP_RESISTANCE', 'SHIP_SIGHT_RANGE',
    'SHIP_SIZE', 'SHIP_THRUST', 'STATIONS_PER_PLANET', 'STATIONS_SPAWN_TIMER', 'STATION_KILLED_REWARD',
    'STATION_RESISTANCE', 'WORLD_BOUNDS', 'ZOOM_LEVELS', 'suffixes', 'syllables', 'DOM'
]

dom_elements = [
    'canvas', 'canvasRadar', 'fadeOverlay', 'infoLED', 'livesDisplay',
    'asteroidCountDisplay', 'scoreDisplay', 'startBtn', 'startScreen',
    'canvasContext', 'canvasRadarContext'
]

def replace_dom_elements(content):
    for el in dom_elements:
        pattern = r'(?<!\.)(?<!["\'])\b' + el + r'\b(?!["\':])'
        content = re.sub(pattern, f'DOM.{el}', content)
    return content

# Read processed files
files = ['js_modules/core.js', 'js_modules/game.js']

import_statement = f"import {{ {', '.join(constants)} }} from './config.js';\nimport {{ State }} from './state.js';\n\n"

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    content = replace_dom_elements(content)
    
    # Remove old global let declarations in core.js
    if 'core.js' in filepath:
        # We need to remove lines 6 to 36 block
        # Just use regex to remove "let State.width, State.height;" etc
        # Actually easier to just remove lines 6 to 36 by splitting on \n
        lines = content.split('\n')
        # find the index
        start_idx = -1
        end_idx = -1
        for i, line in enumerate(lines):
            if 'GLOBAL STATE (Shared)' in line:
                start_idx = i - 1
            if 'class SpatialHash' in line:
                end_idx = i - 1
                break
        if start_idx != -1 and end_idx != -1:
            lines = lines[:start_idx] + lines[end_idx+1:]
        content = '\n'.join(lines)
    
    # Remove DOM parameters declarations from parameters... wait they are not in here
    
    with open(filepath, 'w') as f:
        f.write(import_statement + content)

print("Imports added and DOM elements prefixed.")
