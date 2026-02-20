import os
import re

exports_map = {
    'config.js': [], 'state.js': ['State'], 'utils.js': [], 'audio.js': ['AudioEngine'], 'entities.js': [], 'render.js': [], 'input.js': [], 'main.js': []
}

# we populate exports_map from the files directly
for filename in exports_map:
    with open(f'js_modules/{filename}', 'r') as f:
        content = f.read()
        # Find all exports
        export_matches = re.findall(r'^export\s+(?:const|let|var|class|function)\s+([a-zA-Z0-9_]+)', content, flags=re.MULTILINE)
        exports_map[filename].extend(export_matches)
        
all_exports_to_file = {}
for filename, exports in exports_map.items():
    for ext in exports:
        all_exports_to_file[ext] = filename

# Now check each file and add missing imports
for filename in exports_map:
    with open(f'js_modules/{filename}', 'r') as f:
        content = f.read()
    
    needed_imports = {}
    for ext, file_source in all_exports_to_file.items():
        if file_source == filename:
            continue
        # Check if ext is used and NOT imported
        pattern = r'(?<!\.)(?<!["\'])\b' + ext + r'\b(?!["\':])'
        
        # Check if used
        if re.search(pattern, content):
            # Check if imported
            import_pattern = r'import\s+.*?\b' + ext + r'\b.*?from\s+[\'"]\./' + file_source + r'[\'"]'
            if not re.search(import_pattern, content):
                if file_source not in needed_imports:
                    needed_imports[file_source] = []
                needed_imports[file_source].append(ext)
                
    if needed_imports:
        import_lines = []
        for file_source, exts in needed_imports.items():
            import_lines.append(f"import {{ {', '.join(exts)} }} from './{file_source}';")
            
        content = '\n'.join(import_lines) + '\n' + content
        with open(f'js_modules/{filename}', 'w') as f:
            f.write(content)
        print(f"Added missing imports to {filename}: {needed_imports}")
