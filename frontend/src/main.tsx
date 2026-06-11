import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// We intentionally remove <StrictMode> here because it causes 
// double-mounting bugs with HTML5 Canvas / PixiJS game loops.
createRoot(document.getElementById('root')!).render(
  <App />
);