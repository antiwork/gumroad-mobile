const TRANSIENT_PLAYBACK_MARKERS = [
  "network",
  "connection",
  "timeout",
  "timed out",
  "offline",
  "unknownhost",
  "socket",
  "httpdatasource",
  "behind live window",
  "source error",
  "failed to connect",
  "unable to connect",
  "econnreset",
  "502",
  "503",
  "504",
];

export const MAX_TRANSIENT_PLAYBACK_RETRIES = 3;

export const isTransientPlaybackError = (message?: string | null): boolean => {
  if (!message) return false;
  const haystack = message.toLowerCase();
  return TRANSIENT_PLAYBACK_MARKERS.some((marker) => haystack.includes(marker));
};
