/**
 * Parses an M3U/M3U8 playlist into an array of channel objects.
 * Handles #EXTINF lines with quoted attributes and bare key=value pairs.
 */
export function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let pending = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === '#EXTM3U') continue;

    if (line.startsWith('#EXTINF:')) {
      const attrStr = line.slice(8);
      const attrs = {};

      // extract quoted attributes: key="value"
      for (const m of attrStr.matchAll(/(\w[\w-]*)="([^"]*)"/g)) {
        attrs[m[1].toLowerCase()] = m[2];
      }

      // channel display name is after the last comma
      const nameMatch = attrStr.match(/,(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : '';

      pending = {
        tvg_id:      attrs['tvg-id']    || attrs['tvgid']    || '',
        tvg_name:    attrs['tvg-name']  || attrs['tvgname']  || name,
        tvg_logo:    attrs['tvg-logo']  || attrs['tvglogo']  || '',
        group_title: attrs['group-title'] || '',
        name,
      };
      continue;
    }

    if (line.startsWith('#')) continue;

    // this is a URL line
    if (pending) {
      channels.push({ ...pending, stream_url: line });
      pending = null;
    }
  }

  return channels;
}
