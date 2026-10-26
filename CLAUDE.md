# Dashboards (carteira de investimentos) — regras fixas

## Sincronização (não quebrar)
- Firebase projeto `ajuste-financeiro`. Este app grava SÓ em `dashboard_usuarios/{uid}` (campos: categories, data, settings, wealthHistory, updatedAt).
- O app de contas (repo `gastos-mensais`, "Gestão Financeira") grava em `gastosmensais_usuarios/{uid}`, campo `gestaoFinanceira`. O Dashboards **só lê** essa coleção, nunca grava.
- Fonte dos gastos (`gastosFonte`): nuvem do app de contas + cópia local (`gf_state_v2`); vale a mais recente (`atualizadoEm`). Se a nuvem falhar, usa a cópia local e mostra o motivo na guia Custo de vida.
- Atualiza sozinho: ouvinte `ouvirGastos` (com espera de ~1 s), ao voltar para o app (a cada 2 min no máximo) e ao entrar.
- Nunca enviar dados para a nuvem antes de confirmar o que existe lá (`nuvemOk`). Falha de leitura NÃO é "nuvem vazia". `buscarDaNuvem` só devolve `null` quando o documento realmente não existe; em dúvida, lança erro.
- Um envio por vez (`pushing`), com nova tentativa em 5/10/20/40/60 s. Gravação com `mergeFields` de nível superior (troca cada campo inteiro, sem mesclar por dentro).
- O ouvinte `ouvirMudancas` ignora cópias antigas do aparelho (`fromCache`) e o eco do próprio salvamento.
- Se a leitura do app de contas der "sem permissão", é regra do Firestore: a regra de `gastosmensais_usuarios/{uid}` precisa permitir leitura para o mesmo usuário logado.

## Publicação
- Sempre subir o número do cache em `sw.js` (`carteira-vN`) quando mudar o código.
- Ao pedir mudança, incluir só o que foi pedido: não substituir nem esconder cálculos e informações que já existiam.
- Visual: tudo com o mesmo alinhamento e blocos simétricos. Em dúvida, mostrar prévia antes de publicar.
