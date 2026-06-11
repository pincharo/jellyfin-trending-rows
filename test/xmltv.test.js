import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { parseXMLTV } from '../src/services/xmltv.js';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="test">
  <channel id="M+ LaLiga HD">
    <display-name>M+ LaLiga</display-name>
    <display-name>M+ LaLiga HD</display-name>
    <icon src="https://logos.example/laliga.png" />
  </channel>
  <channel id="La 1 HD">
    <display-name>La 1</display-name>
    <icon src="https://logos.example/la1.png" />
  </channel>
  <programme start="20260610190000 +0200" stop="20260610210000 +0200" channel="M+ LaLiga HD">
    <title>Real Madrid vs Barcelona</title>
    <sub-title>[COLOR SlateBlue]Deportes,Fútbol[/COLOR] | [COLOR cadetblue]2026[/COLOR]</sub-title>
    <desc>El Clásico de LaLiga.</desc>
  </programme>
  <programme start="20260610210000 +0200" stop="20260610230000 +0200" channel="M+ LaLiga HD">
    <title>Post partido</title>
  </programme>
</tv>`;

async function collect(stream) {
  const channels = [];
  const programmes = [];
  await parseXMLTV(stream, {
    onChannel: ch => channels.push(ch),
    onProgramme: p => programmes.push(p),
  });
  return { channels, programmes };
}

test('parses channels with first display-name and icon', async () => {
  const { channels } = await collect(Readable.from(Buffer.from(SAMPLE_XML)));
  assert.equal(channels.length, 2);
  assert.deepEqual(channels[0], {
    channel_id: 'M+ LaLiga HD',
    display_name: 'M+ LaLiga',
    icon: 'https://logos.example/laliga.png',
  });
});

test('parses programmes with times, title and categories', async () => {
  const { programmes } = await collect(Readable.from(Buffer.from(SAMPLE_XML)));
  assert.equal(programmes.length, 2);

  const clasico = programmes[0];
  assert.equal(clasico.epg_channel_id, 'M+ LaLiga HD');
  assert.equal(clasico.title, 'Real Madrid vs Barcelona');
  assert.equal(clasico.description, 'El Clásico de LaLiga.');
  assert.deepEqual(clasico.categories, ['deportes', 'fútbol']);
  // Kodi COLOR tags are stripped from stored sub_title (categories already extracted)
  assert.equal(clasico.sub_title, 'Deportes,Fútbol | 2026');
  // 19:00 +0200 → 17:00 UTC
  assert.equal(new Date(clasico.start * 1000).toISOString(), '2026-06-10T17:00:00.000Z');
  assert.equal(clasico.stop - clasico.start, 2 * 3600);
});

test('handles programmes without sub-title', async () => {
  const { programmes } = await collect(Readable.from(Buffer.from(SAMPLE_XML)));
  assert.equal(programmes[1].title, 'Post partido');
  assert.deepEqual(programmes[1].categories, []);
});

test('transparently decompresses gzip input', async () => {
  const gz = gzipSync(Buffer.from(SAMPLE_XML));
  const { channels, programmes } = await collect(Readable.from(gz));
  assert.equal(channels.length, 2);
  assert.equal(programmes.length, 2);
});

test('rejects on malformed XML', async () => {
  const bad = Readable.from(Buffer.from('<tv><channel id="x"><display-name>broken'));
  await assert.rejects(() => collect(bad));
});
