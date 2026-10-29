const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const listeners = {};
let scheduled = 0, lines = 0, dots = 0;
const ctx = new Proxy({}, { get: (_, name) => (...args) => {
  assert(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
  if (name === 'lineTo') lines++;
  if (name === 'arc') dots++;
} });
const motion = { matches: false, addEventListener: (_, fn) => { listeners.motion = fn; } };
const document = {
  hidden: false,
  createElement: () => ({ setAttribute() {}, getContext: () => ctx }),
  body: { appendChild() {} },
  addEventListener: (name, fn) => { listeners[name] = fn; }
};
const geometry = fs.readFileSync('js/neural-network.js', 'utf8');
vm.runInNewContext(geometry + fs.readFileSync('js/custom.js', 'utf8'), {
  document, matchMedia: () => motion, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  addEventListener: (name, fn) => { listeners[name] = fn; },
  requestAnimationFrame: () => ++scheduled, cancelAnimationFrame() {}
});
assert.equal(dots, 2379, 'Matches reference desktop dot count');
assert.equal(lines, 2772, 'Matches reference desktop connection count');
vm.runInNewContext(geometry + `
  const unique = new Set();
  neuralNetwork.edges.forEach(([a, b]) => {
    assert(a !== b && neuralNetwork.nodes[a] && neuralNetwork.nodes[b]);
    unique.add([a, b].sort((x, y) => x - y).join(':'));
  });
  assert.equal(unique.size, 2772);
`, { assert });
assert.equal(scheduled, 1);
motion.matches = true;
listeners.motion();
assert.equal(scheduled, 1, 'Reduced motion renders without scheduling animation');
motion.matches = false;
document.hidden = true;
listeners.visibilitychange();
assert.equal(scheduled, 1, 'Hidden tabs do not animate');
document.hidden = false;
listeners.visibilitychange();
assert.equal(scheduled, 2, 'Animation resumes');
console.log('Neural background checks passed');
