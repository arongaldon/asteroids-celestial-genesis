import os
import re

modules = {
    'config.js': [
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
    ],
    'state.js': ['State'],
    'utils.js': ['SpatialHash', 'mulberry32', 'isVisible', 'getShapeName'],
    'audio.js': ['AudioEngine'],
    'entities.js': [
        'newPlayerShip', 'createAsteroid', 'initializePlanetAttributes',
        'createGalaxy', 'createAmbientFog', 'createExplosion', 'createShockwave',
        'createAsteroidBelt', 'spawnStation', 'spawnShipsSquad', 'getShipTier',
        'generatePlanetName', 'increaseShipScore'
    ],
    'render.js': [
        'drawPlanetTexture', 'drawBackground', 'drawShips', 'drawBullets',
        'drawParticles', 'renderPlanet', 'drawRadar', 'drawHeart', 'drawLives',
        'updateHUD', 'updateAsteroidCounter', 'showInfoLEDText', 'addScreenMessage'
    ],
    'input.js': [
        'changeRadarZoom', 'shootLaser', 'fireEntityWeapon', 'fireGodWeapon',
        'enemyShoot', 'isTrajectoryClear', 'proactiveCombatScanner'
    ]
}

def get_required_imports(content, current_file):
    imports_needed = {}
    for mod_file, exports in modules.items():
        if mod_file == current_file:
            continue
        needed = []
        for exp in exports:
            # simple regex to check if word is used
            # Ensure it's not a substring of another word, and not a property access
            # State.width is fine if exp is State. So look for full words.
            pattern = r'(?<!\.)(?<!["\'])\b' + exp + r'\b(?!["\':])'
            if re.search(pattern, content):
                needed.append(exp)
        if needed:
            imports_needed[mod_file] = needed
            
    return imports_needed

def process_file(filepath):
    filename = os.path.basename(filepath)
    with open(filepath, 'r') as f:
        content = f.read()
        
    imports_needed = get_required_imports(content, filename)
    
    import_statements = []
    for mod_file, needed in imports_needed.items():
        import_statements.append(f"import {{ {', '.join(needed)} }} from './{mod_file}';")
        
    if import_statements:
        # Strip existing imports if we are re-running
        content = re.sub(r'^import\s+.*?;?\s*$', '', content, flags=re.MULTILINE)
        content = content.lstrip()
        content = '\n'.join(import_statements) + '\n\n' + content
        
    with open(filepath, 'w') as f:
        f.write(content)

def main():
    files = [
        'config.js', 'state.js', 'utils.js', 'audio.js', 'entities.js', 
        'render.js', 'input.js', 'main.js'
    ]
    for file in files:
        if os.path.exists(f'js_modules/{file}'):
            process_file(f'js_modules/{file}')

if __name__ == "__main__":
    main()
