import { createGunzip } from 'node:zlib';
import { SaxesParser } from 'saxes';
import { parseXmltvTime, extractSubtitleCategories } from '../util/index.js';

/**
 * Streams an XMLTV (plain or gzip) source and calls:
 *   onChannel(channel)     — { channel_id, display_name, icon }
 *   onProgramme(prog)      — { epg_channel_id, start, stop, title, sub_title, description, categories }
 *
 * Returns a Promise that resolves when parsing is complete.
 */
export function parseXMLTV(readableStream, { onChannel, onProgramme } = {}) {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser({ xmlns: false });

    let inChannel = false;
    let inProgramme = false;
    let currentChannel = null;
    let currentProg = null;
    let currentText = '';
    let currentTag = '';
    let collectText = false;

    parser.on('error', reject);

    parser.on('opentag', ({ name, attributes }) => {
      currentText = '';
      currentTag = name;

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
        if (name === 'icon') currentChannel.icon = attributes.src || '';
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

    parser.on('closetag', name => {
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
        if (name === 'title')    { currentProg.title       = currentText.trim(); collectText = false; }
        if (name === 'sub-title'){ currentProg.sub_title   = currentText.trim(); collectText = false; }
        if (name === 'desc')     { currentProg.description = currentText.trim(); collectText = false; }

        if (name === 'programme') {
          inProgramme = false;
          if (onProgramme && currentProg.start && currentProg.stop) {
            currentProg.categories = extractSubtitleCategories(currentProg.sub_title);
            onProgramme(currentProg);
          }
          currentProg = null;
        }
      }

      currentText = '';
      collectText = false;
    });

    parser.on('end', resolve);

    // detect gzip by piping through the stream
    let piped = readableStream;
    const chunks = [];
    let headerChecked = false;

    const checkGzip = new Promise(res => {
      readableStream.once('data', chunk => {
        const isGzip = chunk[0] === 0x1f && chunk[1] === 0x8b;
        res(isGzip);
        // push the chunk back — we need to reconstruct the stream
        readableStream.unshift(chunk);
      });
      readableStream.once('end', () => res(false));
      readableStream.once('error', () => res(false));
    });

    checkGzip.then(isGzip => {
      piped = isGzip ? readableStream.pipe(createGunzip()) : readableStream;
      piped.on('data', chunk => parser.write(chunk.toString('utf8')));
      piped.on('end',  () => { try { parser.close(); } catch(_) {} });
      piped.on('error', reject);
    });
  });
}
