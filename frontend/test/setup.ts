import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia; stub it for components that may query it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Recharts ResponsiveContainer uses ResizeObserver; jsdom doesn't implement it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverStub,
});

// Radix UI Select calls hasPointerCapture / scrollIntoView; jsdom lacks them.
Object.defineProperty(window.Element.prototype, 'hasPointerCapture', {
  writable: true,
  value: () => false,
});
Object.defineProperty(window.Element.prototype, 'scrollIntoView', {
  writable: true,
  value: () => {},
});

// Each test starts with a clean session.
beforeEach(() => {
  localStorage.clear();
});
