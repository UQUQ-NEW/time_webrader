// TIME 服务器的公开 WebSocket 地址。
window.TIME_WS_URLS = ['ws://cheap-host1.cheapyun.com:31413'];

function timeWsUrls() {
  const configured = Array.isArray(window.TIME_WS_URLS)
    ? window.TIME_WS_URLS
    : [];
  const candidates = configured.length
    ? configured
    : (location.protocol === 'https:' ? [] : [`ws://${location.hostname}:5000`]);
  return [...new Set(candidates.map(url => String(url).trim()).filter(url => {
    if (!/^wss?:\/\//i.test(url)) return false;
    return location.protocol !== 'https:' || /^wss:\/\//i.test(url);
  }))];
}

function findRoomTIME(key, timeoutMs = 5000) {
  if (!/^[1-9][0-9]{3}$/.test(key)) return Promise.resolve({ url: null, reason: 'invalid' });
  const urls = timeWsUrls();
  if (!urls.length) return Promise.resolve({ url: null, reason: 'config' });

  return new Promise(resolve => {
    const sockets = [];
    let remaining = urls.length;
    let sawReply = false;
    let settled = false;
    const timer = setTimeout(() => finish({ url: null, reason: sawReply ? 'invalid' : 'timeout' }), timeoutMs);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const socket of sockets) {
        try { socket.close(); } catch (_) {}
      }
      resolve(result);
    }

    for (const url of urls) {
      let socket;
      let done = false;
      const fail = () => {
        if (done || settled) return;
        done = true;
        if (--remaining === 0) finish({ url: null, reason: sawReply ? 'invalid' : 'network' });
      };
      try {
        socket = new WebSocket(url);
        sockets.push(socket);
        socket.onopen = () => {
          try { socket.send(JSON.stringify({ action: 'auth', role: 'check', key })); }
          catch (_) { fail(); }
        };
        socket.onmessage = event => {
          if (done || settled) return;
          try {
            const reply = JSON.parse(event.data);
            sawReply = true;
            if (reply.ok && reply.pub) finish({ url });
            else fail();
          } catch (_) { fail(); }
        };
        socket.onerror = fail;
        socket.onclose = fail;
      } catch (_) { fail(); }
    }
  });
}
