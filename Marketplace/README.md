# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Projeto e dominio publico

- Repositorio alvo: `https://github.com/brg-6389-hub/Loot-box`
- Dominio publico: `https://lootbox.marketplace`

## Alojamento local seguro e estavel

Este projeto ja fica preparado para correr apenas em `127.0.0.1`, reduzindo a exposicao na rede local.

### 1. Preparar ambiente local

```bash
cd Marketplace
cp .env.example .env
npm install
```

### 2. Desenvolvimento local

Este modo arranca API e frontend com recarregamento automatico:

```bash
npm run local:full
```

Enderecos locais:

- Frontend: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:8787`
- Health check: `http://127.0.0.1:8787/api/health`

### 3. Alojamento local mais estavel a partir da build

Este modo usa a build de producao do frontend, mantendo o backend local:

```bash
npm run build
npm run serve:full
```

### 4. Recomendacoes de seguranca local

- Manter `API_HOST=127.0.0.1` para impedir acesso a partir de outros dispositivos da rede.
- Trocar `JWT_SECRET` por um valor forte no ficheiro `.env`.
- Nao preencher chaves Stripe, SMTP ou Firebase enquanto nao forem realmente necessarias.
- Se precisares de parar tudo em segurança, termina os processos com `Ctrl+C`.

### Ligar este projeto ao repositorio (local)

```bash
git init
git branch -M main
git remote add origin https://github.com/brg-6389-hub/Loot-box.git
git add .
git commit -m "chore: inicializa projeto Loot Box"
git push -u origin main
```

### Publicacao no Netlify com dominio custom

1. Criar o site no Netlify a partir do repositorio `brg-6389-hub/Loot-box`.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Em `Domain management`, adicionar `lootbox.marketplace` como dominio primario.
5. No DNS do dominio, apontar os registros para Netlify e manter `www` com redirect para o dominio raiz.
