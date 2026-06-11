import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, normalizeChannelName, parseXmltvTime, extractSubtitleCategories, stripKodiTags,
} from '../src/util/index.js';

test('slugify normalizes accents and spaces', () => {
  assert.equal(slugify('M+ LaLiga FHD'), 'm-laliga-fhd');
  assert.equal(slugify('Fútbol Español'), 'futbol-espanol');
  assert.equal(slugify('  --Canal-- '), 'canal');
});

test('normalizeChannelName strips quality suffixes', () => {
  assert.equal(normalizeChannelName('M+ LaLiga FHD'), 'm+ laliga');
  assert.equal(normalizeChannelName('La 1 HD'), 'la 1');
  assert.equal(normalizeChannelName('Antena 3 UHD'), 'antena 3');
  assert.equal(normalizeChannelName('Telecinco'), 'telecinco');
});

test('normalizeChannelName matches EPG variants', () => {
  // Same channel in different qualities must normalize to the same value
  const variants = ['M+ Baloncesto', 'M+ Baloncesto HD', 'M+ Baloncesto FHD', 'M+ Baloncesto 1080'];
  const normalized = new Set(variants.map(normalizeChannelName));
  assert.equal(normalized.size, 1);
});

test('parseXmltvTime parses with timezone offset', () => {
  // 2026-06-10 15:35:00 +0200 = 13:35:00 UTC
  const epoch = parseXmltvTime('20260610153500 +0200');
  assert.equal(new Date(epoch * 1000).toISOString(), '2026-06-10T13:35:00.000Z');
});

test('parseXmltvTime handles negative offset and missing tz', () => {
  const utc = parseXmltvTime('20260610120000 +0000');
  const noTz = parseXmltvTime('20260610120000');
  assert.equal(utc, noTz);

  const minus5 = parseXmltvTime('20260610120000 -0500');
  assert.equal(minus5 - utc, 5 * 3600);
});

test('parseXmltvTime returns 0 on garbage', () => {
  assert.equal(parseXmltvTime('not-a-date'), 0);
  assert.equal(parseXmltvTime(''), 0);
});

test('extractSubtitleCategories parses dobleM COLOR format', () => {
  const sub = '[COLOR SlateBlue]Deportes,Fútbol[/COLOR] | [COLOR cadetblue]2026[/COLOR] | [COLOR gold]★6.0/10[/COLOR]';
  assert.deepEqual(extractSubtitleCategories(sub), ['deportes', 'fútbol']);
});

test('extractSubtitleCategories handles missing categories', () => {
  assert.deepEqual(extractSubtitleCategories(''), []);
  assert.deepEqual(extractSubtitleCategories(null), []);
  assert.deepEqual(extractSubtitleCategories('sin formato color'), []);
});

test('stripKodiTags removes COLOR and bold/italic markup', () => {
  assert.equal(
    stripKodiTags('LALIGA EA SPORTS [COLOR tomato]T25/26[/COLOR] [COLOR goldenrod]Jornada 3: Real Madrid - Mallorca[/COLOR]'),
    'LALIGA EA SPORTS T25/26 Jornada 3: Real Madrid - Mallorca'
  );
  assert.equal(stripKodiTags('[B]Negrita[/B] e [I]itálica[/I]'), 'Negrita e itálica');
  assert.equal(stripKodiTags('sin tags'), 'sin tags');
  assert.equal(stripKodiTags(null), '');
});
