import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileDetailsApp } from './components/FileDetailsApp/FileDetailsApp';

// ルート要素を取得
const container = document.getElementById('content');
if (!container) {
  throw new Error('Root element not found');
}

// React 18の新しいAPI
const root = createRoot(container);
root.render(<FileDetailsApp />);
