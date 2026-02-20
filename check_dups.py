import re
import sys

def check_syntax(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find multiply declared functions
    funcs = re.findall(r'function\s+([a-zA-Z0-9_]+)\s*\(', content)
    seen = set()
    for func in funcs:
        if func in seen:
            print(f"DUPLICATE FUNCTION: {func}")
        seen.add(func)

    # Find multiply declared variables
    vars = re.findall(r'(?:let|const|var)\s+([a-zA-Z0-9_]+)\s*=', content)
    vseen = set()
    for v in vars:
        if v in vseen:
            print(f"DUPLICATE VARIABLE: {v}")
        vseen.add(v)

if __name__ == '__main__':
    check_syntax('js_modules/main.js')
