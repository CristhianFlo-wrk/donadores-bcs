import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/inter';
import './index.css';
import App from './App.jsx';
import { SesionProvider } from './contexto/SesionContext.jsx';
import { iniciarPwa } from './pwa.js';

iniciarPwa();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SesionProvider>
        <App />
      </SesionProvider>
    </BrowserRouter>
  </StrictMode>
);
