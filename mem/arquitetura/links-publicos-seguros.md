---
name: Links públicos seguros
description: OS e orçamentos públicos devem usar UUID/token, nunca número sequencial previsível
type: constraint
---
Links públicos para cliente em OS e orçamentos devem usar identificador não sequencial (UUID ou token assinado).

É proibido gerar ou aceitar como caminho público principal URLs por número sequencial, como `/os/123`, `/orcamento/5` ou `/orcamento/o/:oficinaId/:numero`, porque números podem colidir entre oficinas e/ou ser enumerados.

O acesso público direto às tabelas de OS/orçamentos deve permanecer fechado por RLS; a leitura pública deve passar apenas por RPCs controladas que recebem UUID/token e retornam somente campos seguros para o cliente.

Por quê: houve incidente em orçamento público em que `numero` era repetido entre oficinas e a função antiga buscava `WHERE numero = p_numero LIMIT 1`, podendo exibir dados da oficina errada.