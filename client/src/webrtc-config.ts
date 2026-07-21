/** WebRTC ICE：国内网络 Google STUN 常不可用，生产环境需自建 coturn */
export function getIceServers(): RTCIceServer[] {
  const host = window.location.hostname;
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

  if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.')) {
    servers.push({
      urls: [
        `turn:${host}:3478?transport=udp`,
        `turn:${host}:3478?transport=tcp`,
      ],
      username: 'chatwithyou',
      credential: 'ChatWithYou2024',
    });
  }

  return servers;
}
