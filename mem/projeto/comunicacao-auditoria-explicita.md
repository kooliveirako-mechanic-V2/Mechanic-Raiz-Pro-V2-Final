---
name: Comunicação de auditoria explícita
description: Em auditoria/diagnóstico, escrever no chat TUDO que foi feito (passos, comandos, evidências, achados, limites, próximo passo). Nunca executar ferramentas em silêncio nem entregar só conclusão.
type: preference
---
Em qualquer tarefa de auditoria, diagnóstico, investigação, debugging ou validação:

**Obrigatório escrever no chat, em texto:**
1. Passos executados, em ordem.
2. Arquivos/URLs/endpoints inspecionados.
3. Comandos rodados e o que cada um retornou (resumido se grande, mas citado).
4. Evidências (URL, status, header, valor literal quando seguro).
5. O que ficou indeterminado e por quê.
6. Próximo passo proposto e o que ele vai provar.
7. Status final 🔴/🟡/🟢.

**Proibido:**
- Executar ferramentas sem narrar o resultado.
- Entregar só conclusão sem mostrar o caminho.
- Dizer "verifiquei" sem citar o que foi verificado.
- Encerrar com "ok/feito/corrigido" sem listar evidências.

**Por quê:** o usuário precisa auditar a auditoria. Sem o caminho escrito, não há como confiar na conclusão nem refazer o passo se algo mudar.
