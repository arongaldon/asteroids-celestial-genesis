import re
import os

modules_map = {
    'audio.js': ['const AudioEngine'],
    'utils.js': ['class SpatialHash', 'function mulberry32', 'function isVisible', 'function getShapeName'],
    'entities.js': [
        'function newPlayerShip', 'function createAsteroid', 'function initializePlanetAttributes',
        'function createGalaxy', 'function createAmbientFog', 'function createExplosion', 'function createShockwave',
        'function createAsteroidBelt', 'function spawnStation', 'function spawnShipsSquad', 'function getShipTier',
        'function generatePlanetName', 'function increaseShipScore'
    ],
    'render.js': [
        'function drawPlanetTexture', 'function drawBackground', 'function drawShips', 'function drawBullets',
        'function drawParticles', 'function renderPlanet', 'function drawRadar', 'function drawHeart', 'function drawLives',
        'function updateHUD', 'function updateAsteroidCounter', 'function showInfoLEDText', 'function addScreenMessage'
    ],
    'input.js': [
        'function changeRadarZoom', 'function shootLaser', 'function fireEntityWeapon', 'function fireGodWeapon',
        'function enemyShoot', 'function isTrajectoryClear', 'function proactiveCombatScanner'
    ]
}

def extract_and_remove(content, all_items_to_extract):
    extracted = {}
    
    # We will search the content character by character to find the starting keywords.
    # To be extremely safe, we look for "\nfunction foo(" or "class foo "
    
    for item in all_items_to_extract:
        # construct a regex to find the start of the item
        if item.startswith('const '):
            pattern = re.compile(r'const\s+' + item.split()[1] + r'\s*=\s*\{')
        else:
            kind, name = item.split()
            if kind == 'function':
                pattern = re.compile(r'function\s+' + name + r'\s*\(')
            else:
                pattern = re.compile(r'class\s+' + name + r'\b')
                
        match = pattern.search(content)
        if not match:
            print(f"Warning: could not find {item}")
            continue
            
        start_idx = match.start()
        
        # Now find the matching brace
        # First, find the first '{' after start_idx
        brace_start = content.find('{', start_idx)
        if brace_start == -1:
            print(f"Warning: could not find opening brace for {item}")
            continue
            
        brace_count = 1
        curr_idx = brace_start + 1
        while brace_count > 0 and curr_idx < len(content):
            if content[curr_idx] == '{':
                brace_count += 1
            elif content[curr_idx] == '}':
                brace_count -= 1
            curr_idx += 1
            
        end_idx = curr_idx
        
        # Include a trailing semicolon if it's a const object
        if item.startswith('const '):
            if end_idx < len(content) and content[end_idx] == ';':
                end_idx += 1
                
        block_text = content[start_idx:end_idx]
        extracted[item] = block_text
        
        # Replace the extracted block with empty spaces (to preserve line numbers for now, or just remove)
        # Actually it's better to remove it completely so it doesn't leave huge gaps
        content = content[:start_idx] + "\n/* " + item + " extracted */\n" + content[end_idx:]
        
    return extracted, content

def main():
    with open('js_modules/core.js', 'r') as f:
        core_content = f.read()
    with open('js_modules/game.js', 'r') as f:
        game_content = f.read()
        
    all_content = core_content + '\n' + game_content
    
    all_items = []
    for mod, items in modules_map.items():
        all_items.extend(items)
        
    extracted, remaining_content = extract_and_remove(all_content, all_items)
    
    # Write the extracted modules
    for mod_file, mod_items in modules_map.items():
        out_path = f'js_modules/{mod_file}'
        with open(out_path, 'w') as f:
            for item in mod_items:
                if item in extracted:
                    block_text = extracted[item]
                    if block_text.startswith('const '):
                        block_text = block_text.replace('const ', 'export const ', 1)
                    elif block_text.startswith('class '):
                        block_text = block_text.replace('class ', 'export class ', 1)
                    elif block_text.startswith('function '):
                        block_text = block_text.replace('function ', 'export function ', 1)
                        
                    f.write(block_text + '\n\n')

    # Save the remaining content to main.js
    with open('js_modules/main.js', 'w') as f:
        f.write(remaining_content)
        
if __name__ == "__main__":
    main()
