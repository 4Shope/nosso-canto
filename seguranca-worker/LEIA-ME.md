# Segurança do Nosso Canto — implantação pendente

Esta branch é de preparação. **Não publique na main antes de concluir os passos.**

## O que já foi implementado
- `configurar-seguranca.html` envia o PIN e a chave do YouTube para um Cloudflare Worker autenticado por Firebase Auth.
- O PIN é armazenado no Cloudflare KV como hash PBKDF2-SHA256 com salt aleatório (não em texto simples).
- A chave do YouTube é armazenada no KV criptografada com AES-GCM; a chave de criptografia fica em Secret do Worker.
- Somente o UID de Fabricio pode cadastrar ou trocar o PIN e configurar a chave do YouTube.
- PIN anterior é exigido para trocar o PIN existente; cinco tentativas incorretas causam bloqueio temporário de 15 minutos (limitação aproximada do KV, que não tem incrementos atômicos).
- A pesquisa YouTube pode passar pelo endpoint autenticado `POST /youtube/buscar`.

## Instalar o Worker (Cloudflare)
1. Entre no Cloudflare e crie um namespace Workers KV, por exemplo `NOSSO_CANTO_SECURITY`.
2. Copie o ID do namespace para `seguranca-worker/wrangler.toml` no campo `id`.
3. Configure `ALLOWED_ORIGINS` com a origem **exata** do GitHub Pages. Exemplo: `https://4shope.github.io` (não coloque caminho).
4. No terminal com Node.js, execute dentro de `seguranca-worker`: `npm install`.
5. Gere uma chave aleatória de 32 bytes e converta para base64, de forma privada. Exemplo no terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
6. Execute `npx wrangler secret put ENCRYPTION_KEY` e cole o valor. **Não envie a chave para o GitHub ou ChatGPT.**
7. Execute `npx wrangler deploy`. Copie o URL HTTPS do Worker.
8. Abra `configurar-seguranca.html` após login com a conta Fabricio, cole o URL, teste a conexão, cadastre PIN novo e cole a chave atual do YouTube.

## Etapa ainda necessária antes de colocar em produção
- O `index.html` atual **ainda contém PIN fixo e chave YouTube pública**. Precisamos migrar as chamadas para o Worker e remover esses valores do código. **Não considere a migração concluída** até isso ocorrer.
- O histórico Git anterior continua contendo a chave antiga. Reutilizá-la é possível, mas **não elimina exposição prévia**. Restrinja quota e uso no Google Cloud; rotação é a forma de revogar uma chave exposta.
- Para proteger operações sensíveis, as regras atuais do Firestore permitem escrita aos dois usuários mesmo sem PIN. O PIN no navegador não é autorização real; exclusões e mudanças sensíveis precisam de endpoint de servidor ou regras específicas.
- Altere as regras de `configuracoes_privadas/acesso` para **negar todas as operações de clientes** quando tiver concluído a migração (o Worker usa KV e não precisa desse documento). Remova qualquer PIN/API já gravado ali, via Console Firebase, após conferir que não é usado.
- O Worker usa validação JWT com chaves públicas do Firebase, não armazena senha de login.
- Se o site também roda em outro domínio, inclua-o em `ALLOWED_ORIGINS`.
- Teste Firebase Auth, busca do YouTube, Ben, publicações e exclusões antes de mesclar a branch.

## Endpoints
- `POST /estado` — mostra se PIN e API foram cadastrados, sem retornar segredos
- `POST /pin/configurar` — somente Fabricio; `{pin,pinAnterior?}`
- `POST /pin/verificar` — Fabricio ou Maria; `{pin}`
- `POST /youtube/configurar` — somente Fabricio; `{apiKey}`
- `POST /youtube/buscar` — usuários autorizados; `{q}`

Todos exigem `Authorization: Bearer <Firebase ID token>` e origem autorizada.
