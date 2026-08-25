> 🔒 **Localização e sugestão de correção disponíveis no PROguard.** Este relatório FREE mostra o que foi encontrado, não onde nem como corrigir.

# Relatório de Segurança — marisvaldo1/ControleOperacoes

**Scan:** `cmt8og8k1019k10d7fk05udba` · MANUAL · branch `master` · commit `32603a6fa128`
**Status:** COMPLETED · **Executado em:** 2026-08-25T13:10:09.353Z · **Concluído em:** 2026-08-25T13:15:15.040Z
**Relatório gerado em:** 2026-08-25T13:59:27.427Z por GitGuard

## Instruções para a IA que for corrigir isto

- Repositório alvo: marisvaldo1/ControleOperacoes, branch "master", commit 32603a6fa1286a2c1ce45fe9f2a2b4b58a8fd3c6. Aplique as correções diretamente nesse checkout.
- Em "dependencyUpgrades", cada entrada agrupa TODOS os CVEs de um mesmo pacote — faça UM upgrade por pacote (para "recommendedVersion" ou mais recente), não uma correção por CVE.
- Em "secrets", nunca tente adivinhar ou reconstruir o valor original do segredo (ele foi propositalmente redigido) — apenas remova/rotacione conforme "remediation".
- Depois de aplicar as correções, rode os testes existentes do projeto e, se disponível, o linter/build antes de considerar concluído.

## Resumo

- **Total de findings:** 188
- **Por severidade:** HIGH: 17 · MEDIUM: 163 · LOW: 8
- **Por scanner:** SEMGREP: 188

## Outros findings

| Severidade | Scanner | Categoria | Título | Local |
|---|---|---|---|---|
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.lang.security.audit.subprocess-shell-true.subprocess-shell-true | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.lang.security.audit.subprocess-shell-true.subprocess-shell-true | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.flask.security.injection.ssrf-requests.ssrf-requests | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.requests.security.disabled-cert-validation.disabled-cert-validation | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.xss.xss_dom.dom_xss | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.xss.xss_dom.dom_xss | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.xss.xss_dom.dom_xss | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.xss.xss_dom.dom_xss | — |
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.python.lang.security.audit.subprocess-shell-true.subprocess-shell-true | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.python.lang.security.audit.formatted-sql-query.formatted-sql-query | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.python.lang.security.audit.formatted-sql-query.formatted-sql-query | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.python.flask.security.audit.debug-enabled.debug-enabled | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.typescript.react.security.audit.react-unsanitized-method.react-unsanitized-method | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.incomplete-sanitization.incomplete-sanitization | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.incomplete-sanitization.incomplete-sanitization | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.incomplete-sanitization.incomplete-sanitization | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.incomplete-sanitization.incomplete-sanitization | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.incomplete-sanitization.incomplete-sanitization | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.incomplete-sanitization.incomplete-sanitization | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.html.security.audit.missing-integrity.missing-integrity | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
