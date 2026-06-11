import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXtreamUrl } from '../src/services/xtream.js';

test('detects Xtream get.php URLs', () => {
  const xt = parseXtreamUrl('http://panel.example:8080/get.php?username=user1&password=pass1&type=m3u_plus&output=ts');
  assert.deepEqual(xt, {
    base: 'http://panel.example:8080',
    username: 'user1',
    password: 'pass1',
    output: 'ts',
  });
});

test('detects player_api.php URLs', () => {
  const xt = parseXtreamUrl('https://panel.example/player_api.php?username=u&password=p');
  assert.equal(xt.base, 'https://panel.example');
  assert.equal(xt.output, '');
});

test('returns null for plain M3U URLs', () => {
  assert.equal(parseXtreamUrl('https://example.com/lista.m3u'), null);
  assert.equal(parseXtreamUrl('https://example.com/playlist.m3u8'), null);
});

test('returns null when credentials are missing', () => {
  assert.equal(parseXtreamUrl('http://panel.example/get.php?type=m3u_plus'), null);
  assert.equal(parseXtreamUrl('http://panel.example/get.php?username=solo'), null);
});

test('returns null for garbage input', () => {
  assert.equal(parseXtreamUrl('no es una url'), null);
  assert.equal(parseXtreamUrl(''), null);
});
