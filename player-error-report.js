/**
 * Sends player errors to Discord (browser → webhook, CORS allowed from GitHub Pages).
 */
(function () {
  const MIN_INTERVAL_MS = 30_000;
  const MAX_PER_SESSION = 25;
  let lastKey = '';
  let lastSentAt = 0;
  let sentCount = 0;

  function webhookUrl() {
    const cfg = window.TV_PLAYER_REPORT || {};
    return String(cfg.discordWebhookUrl || '').trim();
  }

  function clip(text, max) {
    const s = text == null ? '' : String(text);
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
  }

  function buildKey(kind, detail) {
    return `${kind}|${clip(detail, 200)}`;
  }

  async function sendPlayerErrorReport(kind, detail, extra) {
    const url = webhookUrl();
    if (!url) return;

    const detailStr = clip(detail, 1200);
    const key = buildKey(kind, detailStr);
    const now = Date.now();
    if (key === lastKey && now - lastSentAt < MIN_INTERVAL_MS) return;
    if (sentCount >= MAX_PER_SESSION) return;

    lastKey = key;
    lastSentAt = now;
    sentCount += 1;

    const ctx = extra && typeof extra === 'object' ? extra : {};
    const fields = [
      { name: 'Тип', value: clip(kind, 256), inline: true },
      { name: 'Серия', value: clip(ctx.episodeId || '—', 64), inline: true },
      { name: 'Позиция', value: clip(ctx.position != null ? `${Math.round(ctx.position)}s` : '—', 64), inline: true },
      { name: 'Озвучка', value: clip(ctx.translation || '—', 120), inline: false },
      { name: 'Детали', value: detailStr || '—', inline: false },
      { name: 'User-Agent', value: clip(navigator.userAgent, 900), inline: false },
      { name: 'Страница', value: clip(location.href, 256), inline: false },
    ];

    if (ctx.streamUrl) {
      fields.push({ name: 'Поток', value: clip(ctx.streamUrl, 400), inline: false });
    }

    const payload = {
      embeds: [
        {
          title: 'Doctor Who S12 — ошибка плеера',
          color: 0xe74c3c,
          fields,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      console.warn('Discord report failed', err);
    }
  }

  function playbackContext() {
    const g = window.__tvPlayerErrorContext;
    if (!g || typeof g !== 'object') return {};
    return {
      episodeId: g.episodeId,
      translation: g.translation,
      position: g.position,
      streamUrl: g.streamUrl,
    };
  }

  window.reportPlayerError = function reportPlayerError(kind, detail, extra) {
    const merged = { ...playbackContext(), ...(extra || {}) };
    void sendPlayerErrorReport(kind, detail, merged);
  };

  window.setTvPlayerErrorContext = function setTvPlayerErrorContext(ctx) {
    window.__tvPlayerErrorContext = { ...(window.__tvPlayerErrorContext || {}), ...(ctx || {}) };
  };
})();
