import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDiscoveryQuery } from './parse';

test('extracts the game named after "like"', () => {
  const slots = parseDiscoveryQuery('something like Elden Ring');
  assert.deepEqual(slots.similar_to, ['elden ring']);
});

test('reads a comparative as relative, not as a guessed hour count', () => {
  const slots = parseDiscoveryQuery('something like Elden Ring but shorter');
  assert.deepEqual(slots.similar_to, ['elden ring']);
  assert.equal(slots.relative_length, 'shorter');
  assert.equal(slots.max_playtime_hours, null);
});

test('an explicit hour count wins over a comparative', () => {
  const slots = parseDiscoveryQuery('like Hades but shorter than 20 hours');
  assert.equal(slots.max_playtime_hours, 20);
  assert.equal(slots.relative_length, null);
});

test('extracts a list of games played without any "like" trigger', () => {
  const slots = parseDiscoveryQuery('I played Elden Ring and Cyberpunk 2077, what next?');
  assert.deepEqual(slots.similar_to, ['elden ring', 'cyberpunk 2077']);
});

test('handles three titles and drops the trailing question', () => {
  const slots = parseDiscoveryQuery("I've played Hades, Celeste and Hollow Knight - what should I play next?");
  assert.deepEqual(slots.similar_to, ['hades', 'celeste', 'hollow knight']);
});

test('recognises other past-tense phrasings', () => {
  assert.deepEqual(parseDiscoveryQuery('I just finished Portal 2').similar_to, ['portal 2']);
  assert.deepEqual(parseDiscoveryQuery('I loved Stardew Valley').similar_to, ['stardew valley']);
});

test('quoted titles are taken verbatim', () => {
  assert.deepEqual(parseDiscoveryQuery('anything like "Baldur\'s Gate 3"?').similar_to, ["Baldur's Gate 3"]);
});

test('parses an explicit playtime ceiling', () => {
  assert.equal(parseDiscoveryQuery('a game under 20 hours').max_playtime_hours, 20);
  assert.equal(parseDiscoveryQuery('something short for the weekend').max_playtime_hours, 15);
});

test('separates excluded genres from requested ones', () => {
  const slots = parseDiscoveryQuery('an action game but not an RPG');
  assert.deepEqual(slots.genres, ['Action']);
  assert.deepEqual(slots.exclude_genres, ['RPG']);
});

test('detects mode and difficulty', () => {
  const slots = parseDiscoveryQuery('a relaxing co-op game');
  assert.equal(slots.mode, 'co-op');
  assert.equal(slots.difficulty, 'lower');
});

test('an empty-ish question yields empty slots rather than throwing', () => {
  const slots = parseDiscoveryQuery('hi');
  assert.deepEqual(slots.similar_to, []);
  assert.equal(slots.max_playtime_hours, null);
  assert.equal(slots.mode, null);
});
