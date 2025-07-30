// React Testing Library setup
require('@testing-library/jest-dom');

// Mock react-markdown and related ESM modules
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children }) {
    return children;
  };
});

jest.mock('remark-gfm', () => {
  return {};
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};