import re
import os

state_vars = [
    'width', 'height', 'playerShip', 'worldOffsetX', 'worldOffsetY', 
    'velocity', 'roids', 'ships', 'playerShipBullets', 'enemyShipBullets', 
    'particles', 'shockwaves', 'ambientFogs', 'backgroundLayers', 
    'playerReloadTime', 'stationSpawnTimer', 'level', 'homePlanetId', 
    'screenMessages', 'gameRunning', 'victoryState', 'loopStarted', 
    'inputMode', 'keys', 'mouse', 'currentZoomIndex', 'RADAR_RANGE', 
    'viewScale', 'roidCounter'
]

def replace_state_vars(content):
    for var in state_vars:
        # Regex to match var name not preceded by a dot (e.g., obj.width shouldn't be matched)
        # Also not preceded by 'let ', 'const ', 'var ' or '{ ' etc if we are defining it.
        # But here we want to replace ALL usages.
        # Actually it's safer to use a regex that looks for word boundaries, 
        # not preceded by a dot or quotation marks
        pattern = r'(?<!\.)(?<!["\'])\b' + var + r'\b(?!["\':])'
        content = re.sub(pattern, f'State.{var}', content)
    return content

os.makedirs('js_modules', exist_ok=True)

for file in ['js/core.js', 'js/game.js']:
    with open(file, 'r') as f:
        code = f.read()
        code = replace_state_vars(code)
    
    with open(f'js_modules/{os.path.basename(file)}', 'w') as f:
        f.write(code)

print("State variables replaced and saved to js_modules.")
