import re
import os

def process_file(filepath, outpath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find all const/let declarations at top level
    # Simple regex for top-level const/let/var
    out_content = re.sub(r'^(const|let|var)\s+([a-zA-Z0-9_]+)', r'export \1 \2', content, flags=re.MULTILINE)
    
    # Export functions
    out_content = re.sub(r'^function\s+([a-zA-Z0-9_]+)', r'export function \1', out_content, flags=re.MULTILINE)

    # Export classes
    out_content = re.sub(r'^class\s+([a-zA-Z0-9_]+)', r'export class \1', out_content, flags=re.MULTILINE)

    with open(outpath, 'w') as f:
        f.write(out_content)

os.makedirs('js_modules', exist_ok=True)
process_file('js/parameters.js', 'js_modules/config.js')
process_file('js/core.js', 'js_modules/core_export.js')
process_file('js/game.js', 'js_modules/game_export.js')
