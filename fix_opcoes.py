
import os

file_path = r'd:\Sistemas\python\ControleOperacoes\frontend\js\opcoes.js'

with open(file_path, 'rb') as f:
    content = f.read()

# Replace null bytes
clean_content = content.replace(b'\x00', b'')

with open(file_path, 'wb') as f:
    f.write(clean_content)

print(f"Cleaned {len(content) - len(clean_content)} null bytes.")
