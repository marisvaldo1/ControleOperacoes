
import re

opcoes_path = r'd:\Sistemas\python\ControleOperacoes\frontend\html\opcoes.html'
new_modal_path = r'd:\Sistemas\python\ControleOperacoes\frontend\html\new_modal.html'

with open(opcoes_path, 'r', encoding='utf-8') as f:
    opcoes_content = f.read()

with open(new_modal_path, 'r', encoding='utf-8') as f:
    new_modal_content = f.read()

# Define the start and end markers for the modal to be replaced
start_marker = '<!-- Modal Detalhes da Operação -->'
end_marker = '<!-- Modal Análise Técnica -->'

# Find the start and end positions
start_pos = opcoes_content.find(start_marker)
end_pos = opcoes_content.find(end_marker)

if start_pos != -1 and end_pos != -1:
    # Replace the content
    new_content = opcoes_content[:start_pos] + new_modal_content + "\n\n    " + opcoes_content[end_pos:]
    
    with open(opcoes_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced modal content.")
else:
    print("Could not find modal markers.")
    print(f"Start: {start_pos}, End: {end_pos}")
