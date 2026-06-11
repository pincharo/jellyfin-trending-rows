import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U } from '../src/services/m3u.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="MovistarLaLiga.es" tvg-name="M+ LaLiga FHD" tvg-logo="http://logo.example/laliga.png" group-title="DEPORTES",M+ LaLiga FHD
http://iptv.example:8080/user/pass/1001
#EXTINF:-1 tvg-id="" tvg-name="DAZN 1" group-title="DEPORTES",DAZN 1 HD
http://iptv.example:8080/user/pass/1002

#EXTVLCOPT:http-user-agent=VLC
#EXTINF:-1,Canal sin atributos
http://iptv.example:8080/user/pass/1003
`;

test('parses channels with quoted attributes', () => {
  const channels = parseM3U(SAMPLE);
  assert.equal(channels.length, 3);

  assert.deepEqual(channels[0], {
    tvg_id: 'MovistarLaLiga.es',
    tvg_name: 'M+ LaLiga FHD',
    tvg_logo: 'http://logo.example/laliga.png',
    group_title: 'DEPORTES',
    name: 'M+ LaLiga FHD',
    stream_url: 'http://iptv.example:8080/user/pass/1001',
  });
});

test('handles missing attributes gracefully', () => {
  const channels = parseM3U(SAMPLE);
  assert.equal(channels[1].tvg_id, '');
  assert.equal(channels[1].tvg_name, 'DAZN 1');
  assert.equal(channels[1].tvg_logo, '');
});

test('parses bare EXTINF without attributes', () => {
  const channels = parseM3U(SAMPLE);
  assert.equal(channels[2].name, 'Canal sin atributos');
  assert.equal(channels[2].tvg_name, 'Canal sin atributos');
  assert.equal(channels[2].stream_url, 'http://iptv.example:8080/user/pass/1003');
});

test('ignores EXTVLCOPT and blank lines', () => {
  const channels = parseM3U('#EXTM3U\n\n#EXTVLCOPT:foo\n#EXTINF:-1,Test\nhttp://x/1\n');
  assert.equal(channels.length, 1);
});

test('returns empty array for empty playlist', () => {
  assert.deepEqual(parseM3U(''), []);
  assert.deepEqual(parseM3U('#EXTM3U\n'), []);
});

test('skips URL lines without preceding EXTINF', () => {
  const channels = parseM3U('#EXTM3U\nhttp://orphan/url\n#EXTINF:-1,Ok\nhttp://x/1\n');
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'Ok');
});
