// React Testing Library setup
require('@testing-library/jest-dom');

// Happy DOM setup for React component testing
const { GlobalRegistrator } = require('@happy-dom/global-registrator');

// Register Happy DOM globally for React tests
if (process.env.NODE_ENV === 'test') {
  GlobalRegistrator.register();
}

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