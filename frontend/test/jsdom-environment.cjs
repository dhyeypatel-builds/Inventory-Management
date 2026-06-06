// Custom jsdom environment that injects the Web/Fetch globals jsdom omits but
// that react-router v7's data router needs (Request/Response/fetch are created
// on navigation). These exist as Node globals in the environment's realm; we
// copy them onto the jsdom global.
const JSDOMEnvironment = require('jest-environment-jsdom').default;
const { TextEncoder, TextDecoder } = require('node:util');

class CustomJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    const g = this.global;
    const inject = (key, value) => {
      if (typeof g[key] === 'undefined' && typeof value !== 'undefined') g[key] = value;
    };
    inject('TextEncoder', TextEncoder);
    inject('TextDecoder', TextDecoder);
    inject('Request', globalThis.Request);
    inject('Response', globalThis.Response);
    inject('Headers', globalThis.Headers);
    inject('fetch', globalThis.fetch);
    inject('ReadableStream', globalThis.ReadableStream);
  }
}

module.exports = CustomJSDOMEnvironment;
