/**
 * Browser-only Cinemar playback helpers (no Cloudflare Workers).
 */
(function () {
  function labelKey(raw) {
    return String(raw || '').split('(')[0].trim().toLowerCase();
  }

  function findEpisodeTrack(playlist, episodeId, translationHint) {
    const season = playlist.find((s) => s && s.id === 's12');
    if (!season) throw new Error('Season 12 missing in playlist');

    const ep = (season.folder || []).find((e) => e.id === episodeId);
    if (!ep) throw new Error(`Episode ${episodeId} not found`);

    const hintKey = labelKey(translationHint);
    let track = null;

    for (const tr of ep.folder || []) {
      if (!tr.data && !tr.streamUrl) continue;
      const full = tr.translation || tr.title || '';
      const label = labelKey(full);
      if (
        !hintKey
        || full === translationHint
        || label === hintKey
        || label.startsWith(hintKey)
        || hintKey.startsWith(label)
      ) {
        track = tr;
        break;
      }
    }

    if (!track) throw new Error(`Translation not found for ${episodeId}`);
    return track;
  }

  function cinemarReferer(embedUrl) {
    const line = String(embedUrl || '').trim();
    if (!line.includes('/+')) throw new Error('Invalid embed URL');
    return `${line.split('/+')[0]}/`;
  }

  async function loadCinemarStream(track, referer) {
    if (track && track.streamUrl) {
      return {
        file: track.streamUrl,
        duration: track.streamDuration,
        subtitle: '',
        translation: track.translation || track.title || '',
      };
    }
    const trackData = track?.data ?? track;
    if (!trackData) {
      throw new Error('Данные дорожки отсутствуют. Запустите обновление embed в Docker.');
    }
    const res = await fetch('https://cinemar.cc/api/playlist/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: referer,
        Origin: 'https://cinemar.cc',
      },
      body: JSON.stringify(trackData),
    });
    const body = await res.json();
    if (!res.ok || body.file == null) {
      throw new Error(
        body.error
          || `Cinemar playlist/load HTTP ${res.status}. `
            + 'С браузера GitHub Pages API недоступен — нужен dist с streamUrl из Docker.',
      );
    }
    return {
      file: body.file,
      duration: body.duration,
      subtitle: body.subtitle || '',
      translation: body.translation,
    };
  }

  let playlistPromise = null;
  let embedUrlPromise = null;

  function loadPlaylist() {
    if (!playlistPromise) {
      playlistPromise = fetch('cinemar-playlist.json', { cache: 'no-store' }).then(async (res) => {
        if (!res.ok) throw new Error(`cinemar-playlist.json HTTP ${res.status}`);
        return res.json();
      });
    }
    return playlistPromise;
  }

  function loadEmbedUrl() {
    if (!embedUrlPromise) {
      embedUrlPromise = fetch('cinemar-embed-url.txt', { cache: 'no-store' }).then(async (res) => {
        if (!res.ok) throw new Error(`cinemar-embed-url.txt HTTP ${res.status}`);
        return (await res.text()).trim();
      });
    }
    return embedUrlPromise;
  }

  window.Season12Playback = {
    findEpisodeTrack,
    cinemarReferer,
    loadCinemarStream,
    loadPlaylist,
    loadEmbedUrl,
  };
})();
