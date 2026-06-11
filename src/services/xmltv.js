import { createGunzip } from 'node:zlib';
import { once } from 'node:events';
import { SaxesParser } from 'saxes';
import { parseXmltvTime, extractSubtitleCategories, stripKodiTags } from '../util/index.js';

/**
 * Streams an XMLTV (plain or gzip, auto-detected by magic bytes) source and calls:
 *   onChannel(channel)     — { channel_id, display_name, icon }
 *   onProgramme(prog)      — { epg_channel_id, start, stop, title, sub_title, description, categories }
 *
 * Resolves when parsing is complete; rejects on malformed XML or stream errors.
 */
export async function parseXMLTV(readableStream, { onChannel, onProgramme } = {}) {
  const parser = new SaxesParser({ xmlns: false });

  let inChannel = false;
  let inProgramme = false;
  let currentChannel = null;
  let currentProg = null;
  let currentText = '';
  let collectText = false;
  let parseError = null;

  parser.on('error', err => { parseError ??= err; });

  parser.on('opentag', ({ name, attributes }) => {
    currentText = '';

    if (name === 'channel') {
      inChannel = true;
      currentChannel = { channel_id: attributes.id, display_names: [], icon: '' };
      collectText = false;
      return;
    }

    if (name === 'programme') {
      inProgramme = true;
      currentProg = {
        epg_channel_id: attributes.channel,
        start: parseXmltvTime(attributes.start || ''),
        stop:  parseXmltvTime(attributes.stop  || ''),
        title: '', sub_title: '', description: '', categories: [],
      };
      collectText = false;
      return;
    }

    if (inChannel) {
      if (name === 'display-name') collectText = true;
      if (name === 'icon' && !currentChannel.icon) currentChannel.icon = attributes.src || '';
    }

    if (inProgramme) {
      if (name === 'title' || name === 'sub-title' || name === 'desc') collectText = true;
    }
  });

  parser.on('text', text => {
    if (collectText) currentText += text;
  });

  parser.on('cdata', data => {
    if (collectText) currentText += data;
  });

  parser.on('closetag', ({ name }) => {
    if (inChannel) {
      if (name === 'display-name') {
        currentChannel.display_names.push(currentText.trim());
        collectText = false;
      }
      if (name === 'channel') {
        inChannel = false;
        if (onChannel && currentChannel.channel_id) {
          onChannel({
            channel_id:   currentChannel.channel_id,
            display_name: currentChannel.display_names[0] || currentChannel.channel_id,
            icon:         currentChannel.icon,
          });
        }
        currentChannel = null;
      }
    }

    if (inProgramme) {
      if (name === 'title')     { currentProg.title       = currentText.trim(); collectText = false; }
      if (name === 'sub-title') { currentProg.sub_title   = currentText.trim(); collectText = false; }
      if (name === 'desc')      { currentProg.description = currentText.trim(); collectText = false; }

      if (name === 'programme') {
        inProgramme = false;
        if (onProgramme && currentProg.start && currentProg.stop) {
          // categories first: they live inside the [COLOR] markup we strip below
          currentProg.categories = extractSubtitleCategories(currentProg.sub_title);
          currentProg.title = stripKodiTags(currentProg.title);
          currentProg.sub_title = stripKodiTags(currentProg.sub_title);
          currentProg.description = stripKodiTags(currentProg.description);
          onProgramme(currentProg);
        }
        currentProg = null;
      }
    }

    currentText = '';
  });

  // decoder with stream:true handles multi-byte UTF-8 chars split across chunks
  const decoder = new TextDecoder('utf-8');
  const feed = chunk => {
    parser.write(decoder.decode(chunk, { stream: true }));
    if (parseError) throw parseError;
  };

  const iterator = readableStream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) return;

  const rest = { [Symbol.asyncIterator]: () => iterator };
  const isGzip = first.value[0] === 0x1f && first.value[1] === 0x8b;

  if (isGzip) {
    const gunzip = createGunzip();
    const writer = (async () => {
      try {
        if (!gunzip.write(first.value)) await once(gunzip, 'drain');
        for await (const chunk of rest) {
          if (!gunzip.write(chunk)) await once(gunzip, 'drain');
        }
        gunzip.end();
      } catch (err) {
        gunzip.destroy(err);
      }
    })();
    for await (const chunk of gunzip) feed(chunk);
    await writer;
  } else {
    feed(first.value);
    for await (const chunk of rest) feed(chunk);
  }

  parser.close();
  if (parseError) throw parseError;
}
