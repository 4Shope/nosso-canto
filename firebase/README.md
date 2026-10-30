# Regras do Firebase — Nosso Canto

Esta pasta mantém as regras do Cloud Firestore como referência versionada no GitHub.

- [firestore.original.rules](firestore.original.rules): cópia exata das regras enviadas pelo usuário em 30/10/2026; **não substitui as regras ativas**.
- [firestore.rules](firestore.rules): versão recomendada, que preserva as coleções usadas pelo site e pelo Ben, mas **nega acesso** do navegador a `configuracoes_privadas`, para que PIN e chave da API do YouTube não sejam armazenados/consultados como segredos nesse documento.
- A versão recomendada **não foi publicada automaticamente** no Firebase. É preciso revisar dependências e publicar manualmente no console ou via deploy autorizado.
- O bloqueio de leitura não remove dados previamente gravados. Se houver PIN ou chave no documento antigo, revisar e remover pelo console do Firebase.
- Guardar regras no GitHub público é aceitável, mas **nunca armazenar aqui senhas, PINs, segredos, tokens de autenticação, chave de conta de serviço ou credenciais de API privadas**.
- Firestore: `ben_estado` continua permitindo leitura e escrita para os dois usuários autorizados; `posts`, `comentarios`, `chat_privado`, `ben_memorias`, `historico_reproducoes` e `pedido_privado` mantêm o comportamento de acesso anterior.
- O código público do site pode conter chave de API do YouTube por outro caminho; regras do Firestore **não removem** chave embutida no HTML.
