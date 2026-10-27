import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankScene,
  newObject,
  removeItem,
  moveObject,
} from "../src/multi/editor.ts";
test("deleting an object removes attached forces and connections but keeps unrelated nodes", () => {
  const s = blankScene();
  s.objects = [newObject("mass", "a"), newObject("anchor", "b", 3)];
  s.connections = [
    { id: "k", kind: "spring", a: "a", b: "b", k: 8, rest: 3, pulley: "" },
  ];
  s.external = [{ id: "F", body: "a", fx: 1, fy: 0 }];
  const next = removeItem(s, "a");
  assert.equal(next.objects.length, 1);
  assert.equal(next.connections.length, 0);
  assert.equal(next.external.length, 0);
  assert.equal(s.objects.length, 2);
});
test("dragging the platform preserves the relative initial position of its load", () => {
  const s = blankScene(),
    deck = newObject("platform", "deck"),
    top = newObject("block", "top", 1, 0.7);
  top.support = "deck";
  s.objects = [deck, top];
  const next = moveObject(s, "deck", 3, 10, "platform");
  assert.equal(next.objects[0].x, 3);
  assert.equal(next.objects[0].y, 0);
  assert.equal(next.objects[1].x, 4);
  assert.equal(next.objects[1].y, 0.7);
});
test("pulley drag projects onto the guide and preserves rope length", () => {
  const s = blankScene();
  s.objects = [
    newObject("mass", "a", -0.4, 1),
    newObject("mass", "b", 0.4, 1),
    newObject("pulley", "p", 0, 4),
  ];
  s.connections = [
    { id: "r", kind: "rope", a: "a", b: "b", rest: 6, k: 8, pulley: "p" },
  ];
  const n = moveObject(s, "a", -5, 2, "pulley");
  assert.equal(n.objects[0].x, -0.4);
  assert.equal(n.objects[0].y, 2);
  assert.equal(n.objects[1].y, 0);
  assert.equal(4 - n.objects[0].y + (4 - n.objects[1].y), 6);
});
test("spring guide dragging preserves initial height", () => {
  const s = blankScene();
  s.objects = [newObject("mass", "a", 0, 2)];
  const n = moveObject(s, "a", 3, 10, "springs");
  assert.equal(n.objects[0].x, 3);
  assert.equal(n.objects[0].y, 2);
});
