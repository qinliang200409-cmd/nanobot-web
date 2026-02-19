# nanobot-web

Web UI for nanobot - an AI assistant powered by MiniMax API.

## Features

- 💬 Chat with AI assistants
- 🎭 Multiple agent personas (customizable)
- 🌙 Dark/Light theme
- 💾 Session history (localStorage)
- ✨ Modern, clean UI

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd nanobot-web
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

The built files will be in the `dist` folder.

## Configuration

### API Settings

The app uses MiniMax API by default. Configure your API key in the Settings page.

### Custom Agents

Create custom agent prompts in the sidebar:
1. Click the agent dropdown
2. Click "New Agent"
3. Enter agent name
4. Edit the prompt content
5. Click Save

Agent prompts are stored in `~/.nanobot/agents/` directory.

## Project Structure

```
nanobot-web/
├── src/
│   ├── components/     # React components
│   │   ├── layout/    # Layout components
│   │   └── ui/        # UI components
│   ├── contexts/      # React contexts
│   ├── hooks/         # Custom hooks
│   ├── pages/         # Page components
│   └── types/         # TypeScript types
├── public/            # Static assets
└── dist/              # Built files
```

## License

MIT

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
