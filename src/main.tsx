import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppStateProvider } from './state/AppState';
import { I18nProvider } from './i18n/I18nProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </I18nProvider>
  </React.StrictMode>
);
