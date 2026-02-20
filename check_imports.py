import os
import re

# Check if maybe there are TWO import statements for State in the same file
files = os.listdir('js_modules')
for f in files:
    if not f.endswith('.js'): continue
    filepath = os.path.join('js_modules', f)
    with open(filepath, 'r') as file:
        content = file.read()
        imports = re.findall(r'import\s+.*?State.*?\bfrom\s+[\'"].*?[\'"]', content)
        if len(imports) > 1:
            print(f"DUPLICATE IMPORTS IN {f}: {imports}")
            
        # check if there's any local function or variable named State
        locals_found = re.findall(r'function\s+State\b|class\s+State\b|let\s+State\b|const\s+State\b|var\s+State\b', content)
        if locals_found:
            print(f"LOCAL DECLARATION IN {f}: {locals_found}")

# Also check for circular imports which might cause webpack/browser logic weirdness
# but usually native ES modules handle them or throw "cannot access 'State' before initialization"
