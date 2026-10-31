import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractInventory } from '../lib/inventory.mjs';
import { makeRepo, ROUTING_DIR, ROUTER_FILE } from './helpers.mjs';

test('extracts get/post/put/patch/delete/webSocket routes with file and line', () => {
  const root = makeRepo({
    routing: {
      'A.kt': 'get("/a") {}\npost("/a")\nput("/a/{id}")\npatch("/a/{id}")\ndelete("/a/{id}")\nwebSocket("/ws") {}\n',
    },
  });
  const { endpoints } = extractInventory(root);
  assert.deepEqual(
    endpoints.map((e) => e.key),
    ['GET /a', 'POST /a', 'PUT /a/{}', 'PATCH /a/{}', 'DELETE /a/{}', 'WS /ws'],
  );
  assert.equal(endpoints[2].path, '/a/{id}');
  assert.equal(endpoints[2].file, `${ROUTING_DIR}/A.kt`);
  assert.equal(endpoints[2].line, 3);
});

test('reports unparsed route declarations', () => {
  const root = makeRepo({
    routing: { 'B.kt': 'get(PATH) {}\npost(\n    "/split"\n) {}\nval x = map.get("key")\n' },
  });
  const { endpoints, unparsed } = extractInventory(root);
  assert.deepEqual(endpoints.map((e) => e.key), []);
  assert.deepEqual(unparsed.map((u) => u.line), [1, 2]);
  assert.equal(unparsed[0].file, `${ROUTING_DIR}/B.kt`);
});

test('skips Kotlin property getters', () => {
  const root = makeRepo({ routing: { 'C.kt': 'val slug: String\n    get() = parameters["slug"]!!\nget("/c") {}\n' } });
  const { endpoints, unparsed } = extractInventory(root);
  assert.deepEqual(endpoints.map((e) => e.key), ['GET /c']);
  assert.deepEqual(unparsed, []);
});

test('extracts app routes from .page references once each', () => {
  const root = makeRepo();
  const { routes } = extractInventory(root);
  assert.deepEqual(routes.map((r) => r.name), ['MainRoute', 'ShelfDetailRoute', 'AddToShelvesRoute']);
  assert.equal(routes[1].file, ROUTER_FILE);
  assert.equal(routes[1].line, 4);
});

test('reports nested route blocks as unparsed', () => {
  const root = makeRepo({ routing: { 'D.kt': 'route("/d") {\n    get("/e") {}\n}\n' } });
  const { unparsed } = extractInventory(root);
  assert.deepEqual(unparsed.map((u) => [u.line, u.text]), [[1, 'route("/d") {']]);
});

test('skips commented-out routes and reports path-less ones', () => {
  const root = makeRepo({ routing: { 'E.kt': '// get("/old") {}\n    /* post("/older") */\nget {\n}\nget("/kept") {} // get("/trailing")\n' } });
  const { endpoints, unparsed } = extractInventory(root);
  assert.deepEqual(endpoints.map((e) => e.key), ['GET /kept']);
  assert.deepEqual(unparsed.map((u) => [u.line, u.text]), [[3, 'get {']]);
});
