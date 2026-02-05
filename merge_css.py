
import os

opcoes_path = r'd:\Sistemas\python\ControleOperacoes\frontend\css\opcoes.css'
y2_path = r'd:\Sistemas\python\ControleOperacoes\frontend\css\y2-styles.css'

with open(opcoes_path, 'r', encoding='utf-8') as f:
    opcoes_css = f.read()

with open(y2_path, 'r', encoding='utf-8') as f:
    y2_css = f.read()

# Extract imports
imports = []
y2_content = []
for line in y2_css.splitlines():
    if line.strip().startswith('@import'):
        imports.append(line)
    else:
        y2_content.append(line)

y2_body = '\n'.join(y2_content)

# Check if import already exists in opcoes
final_css = opcoes_css
for imp in imports:
    if imp not in opcoes_css:
        final_css = imp + '\n' + final_css

# Append body
final_css += '\n\n/* Y2 Styles Integration */\n' + y2_body

with open(opcoes_path, 'w', encoding='utf-8') as f:
    f.write(final_css)

print("Merged CSS successfully.")
