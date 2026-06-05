# REGISTRO TÉCNICO — RECONEXÃO GITHUB + VERCEL + DEPLOY DO MECHANIC RAIZ PRO

## Contexto geral

Hoje reorganizamos o fluxo técnico do projeto Mechanic Raiz Pro para deixar o código local validado, subir para um repositório GitHub novo e conectar esse repositório ao projeto já existente na Vercel, sem perder o domínio e sem criar um projeto novo na Vercel.

---

## Pasta local usada no computador

O projeto estava no computador nesta pasta:

```
C:\Users\Hp\Downloads\mechanic-raiz-pro-v2-SOURCE
```

Dentro dessa pasta estavam os arquivos do projeto, incluindo:

```
package.json
package-lock.json
src/
public/
supabase/
docs/
electron/
mem/
vite.config.ts
vercel.json
tailwind.config.ts
tsconfig.json
README.md
```

Essa foi a pasta usada para rodar, testar, compilar e subir o projeto.

---

## Validação local com Node/npm

Antes de subir para GitHub e Vercel, validamos o projeto localmente.

### Primeiro rodamos:

```bash
npm install
```

**Resultado:**
As dependências foram instaladas com sucesso. Apareceram avisos de pacotes deprecated e vulnerabilidades do npm, mas nada que impedisse o projeto de rodar. Não foi usado `npm audit fix --force` para evitar quebrar dependências.

### Depois rodamos:

```bash
npm run dev
```

**Resultado:**
O Vite iniciou normalmente em:

```
http://localhost:8080
```

O site abriu corretamente no navegador.

### Depois paramos o servidor local e rodamos:

```bash
npm run build
```

**Resultado:**
O build passou com sucesso. Apareceu o aviso de chunks maiores que 500kB, mas isso foi apenas aviso de performance, não erro. O projeto compilou para produção.

### Depois rodamos:

```bash
npm run preview
```

**Resultado:**
O preview de produção local abriu em:

```
http://localhost:4173
```

O sistema abriu corretamente. Foi feito cadastro de teste e o login funcionou localmente.

### Conclusão dessa etapa:
O projeto estava válido localmente com Node/npm, rodando em dev, compilando em produção e abrindo no preview.

---

## Git local

Ao rodar `git status` inicialmente, apareceu:

```
fatal: not a git repository
```

Isso indicava que a pasta ainda não era um repositório Git válido. Havia um arquivo `.git` quebrado/solto na pasta, mas não uma pasta `.git` funcional.

Foi executado:

```bash
del .git
```

Depois protegemos arquivos que não deveriam ir para o GitHub adicionando entradas no `.gitignore`:

```
.env.local
.env
node_modules/
dist/
```

**Importante:**
- `node_modules` e `dist` não devem ser versionados no GitHub.
- `.env` e `.env.local` também não devem ser enviados para o GitHub, porque podem conter chaves e variáveis sensíveis.

Depois iniciamos o Git corretamente:

```bash
git init
git branch -M main
```

O `git status` passou a mostrar:

```
On branch main
No commits yet
Untracked files...
```

Depois adicionamos os arquivos:

```bash
git add .
```

O Git preparou os arquivos do projeto para commit.

### Configuração de identidade

Na primeira tentativa de commit apareceu erro de identidade:

```
Author identity unknown
Please tell me who you are.
```

Então configuramos o Git com nome e e-mail:

```bash
git config --global user.name "Mechanic Raiz Pro"
git config --global user.email "[EMAIL_USADO_NO_GITHUB]"
```

**Observação:**
O e-mail usado no `git config` precisa ser um e-mail válido/verificado na conta do GitHub usada no repositório. Esse e-mail serve apenas para assinar os commits.

### Commit inicial

```bash
git commit -m "Primeira versão validada do Mechanic Raiz Pro"
```

**Resultado:**
O commit foi criado com sucesso.

---

## GitHub novo

Criamos/usamos o repositório novo no GitHub:

- **Conta/organização:** `kooliveirako-mechanic-V2`
- **Repositório:** `Mechanic-Raiz-Pro-V2-Final`
- **URL do repositório:** `https://github.com/kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final`

Depois conectamos a pasta local a esse repositório com:

```bash
git remote add origin https://github.com/kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final.git
```

Depois enviamos o projeto:

```bash
git push -u origin main
```

Durante o push, o GitHub abriu autenticação no navegador em `localhost/127.0.0.1`. Isso foi normal, era apenas o fluxo de login/autorização do GitHub.

**Resultado:**
O push terminou com sucesso e o repositório passou a mostrar os arquivos do projeto, incluindo:

```
src/
supabase/
public/
package.json
package-lock.json
vite.config.ts
vercel.json
README.md
```

O commit visível no GitHub ficou como:

```
"Primeira versão validada do Mechanic Raiz Pro"
```

### Conclusão dessa etapa:
O código validado localmente foi enviado com sucesso para o GitHub novo, na branch `main`.

---

## Vercel existente

A Vercel já tinha um projeto antigo/existente chamado:

```
mechanicraizpro
```

Esse projeto já possuía domínio configurado, por isso a decisão correta foi **NÃO criar um projeto novo na Vercel**.

- **Domínio em produção usado/testado:** `https://www.mechanicraizpro.com.br`
- **Também havia referência ao domínio/subdomínio:** `mt.mechanicraizpro.com.br`

A decisão foi:
**Manter o projeto existente da Vercel** para preservar domínio, configurações e variáveis de ambiente.

---

## Problema encontrado na Vercel

Ao tentar conectar o GitHub, a Vercel inicialmente estava usando/mostrando a conta GitHub antiga:

```
kooliveira2016-cell
```

Essa conta tinha repositórios antigos/deploys antigos, mas não era o repositório novo que acabamos de subir.

O repositório correto era:

```
kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final
```

Foi necessário ajustar a conexão GitHub da Vercel para usar o repositório novo.

---

## Conexão correta feita na Vercel

Dentro do projeto Vercel `mechanicraizpro`, em:

```
Project Settings > Git
```

O Connected Git Repository foi atualizado para:

```
kooliveirako-mechanic-V2 / Mechanic-Raiz-Pro-V2-Final
```

A tela mostrou:

```
Connected just now
```

Isso confirmou que a Vercel passou a puxar o código do repositório GitHub novo.

---

## Deploy novo

Depois que o GitHub novo foi conectado à Vercel, o deploy antigo ainda aparecia como sendo do dia 20, então foi necessário disparar um novo deploy.

Para isso, no terminal local, dentro da pasta do projeto, foi usado um commit vazio:

```bash
git commit --allow-empty -m "Dispara deploy Vercel com repositorio novo"
git push
```

Esse push acionou a Vercel.

Na Vercel, em **Deployments**, apareceu um deploy novo no topo com:

- **Status:** Ready
- **Ambiente:** Production
- **Branch:** main
- **Commit:** `"Dispara deploy Vercel com repositorio novo"`
- **Autor:** `kooliveirako-mechanic-V2`
- **Marcado como:** Current

Isso confirmou que a Vercel não estava mais apenas com o deploy antigo do dia 20. Ela gerou um deploy novo usando o GitHub novo.

---

## Teste em produção

Após o deploy ficar Ready/Current, foi aberto o domínio:

```
https://www.mechanicraizpro.com.br
```

**Resultado:**
O sistema carregou normalmente em produção.

Foi possível entrar no sistema, acessar o dashboard e ver o app funcionando.

A tela mostrou o sistema Mechanic Raiz Pro logado, com menus como:

- Início
- Clientes
- Veículos
- Serviços
- Agenda
- Solicitações
- Orçamentos
- Estoque
- Recebimentos
- Relatórios
- Configurações

Também apareceu o bloco de onboarding:

> "Comece aqui — leva 2 minutos"

Isso confirmou que o deploy novo está servindo a aplicação em produção.

---

## Situação final confirmada

### Estado atual:

- [x] Código local validado com `npm install`, `npm run dev`, `npm run build` e `npm run preview`.
- [x] Git local iniciado corretamente.
- [x] Arquivos sensíveis/pesados protegidos no `.gitignore`.
- [x] Projeto enviado para GitHub novo.
- [x] GitHub novo conectado à Vercel existente.
- [x] Projeto antigo da Vercel foi mantido para preservar domínio e variáveis.
- [x] Deploy novo criado a partir do repositório novo.
- [x] Deploy novo ficou Ready e Current.
- [x] Domínio de produção abriu normalmente.
- [x] Sistema carregou em produção.

---

## Estrutura atual correta

### Fluxo atual do projeto:

| Camada | Localização |
|--------|-------------|
| **Pasta local** | `C:\Users\Hp\Downloads\mechanic-raiz-pro-v2-SOURCE` |
| **GitHub** | `kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final` |
| **Branch** | `main` |
| **Vercel** | Projeto `mechanicraizpro` |
| **Connected Git Repository na Vercel** | `kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final` |
| **Domínio de produção** | `https://www.mechanicraizpro.com.br` |
| **Deploy atual** | Production / Ready / Current / branch main |

---

## Cuidados importantes daqui para frente

1. **Não desconectar** o Git Repository da Vercel sem necessidade.
2. **Não criar** outro projeto Vercel para o mesmo app se a intenção for manter o domínio atual.
3. **Não apagar** as variáveis de ambiente da Vercel.
4. **Não subir** `.env` ou `.env.local` para o GitHub.
5. **Não subir** `node_modules` nem `dist`.

### Toda alteração futura deve seguir este fluxo:

1. Alterar código local ou via ferramenta adequada.
2. Testar localmente se possível.
3. Rodar `npm run build`.
4. Fazer `git add .`
5. Fazer `git commit -m "descrição da alteração"`
6. Fazer `git push`
7. Aguardar a Vercel gerar deploy automático.
8. Testar o domínio em produção.

---

## Comandos principais usados

```bash
# Validação local
npm install
npm run dev
npm run build
npm run preview

# Git local
del .git
git init
git branch -M main
git add .
git commit -m "Primeira versão validada do Mechanic Raiz Pro"
git remote add origin https://github.com/kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final.git
git push -u origin main

# Deploy trigger
git commit --allow-empty -m "Dispara deploy Vercel com repositorio novo"
git push
```

---

## Diagnóstico final

A migração/conexão foi bem-sucedida.

O projeto saiu de uma pasta local sem Git funcional e passou a estar versionado em um GitHub novo, conectado ao projeto existente da Vercel, mantendo domínio e deploy de produção.

### Mapa rápido de onde está cada coisa:

| O que | Onde |
|-------|------|
| **Código-fonte oficial** | GitHub `kooliveirako-mechanic-V2/Mechanic-Raiz-Pro-V2-Final` |
| **Deploy/produção** | Vercel projeto `mechanicraizpro` |
| **Domínio** | `www.mechanicraizpro.com.br` |
| **Branch de produção** | `main` |
| **Build** | `npm run build` |
| **Output** | `dist` |
| **Framework** | Vite |

**Status final:** Produção atualizada e funcionando a partir do GitHub novo.
