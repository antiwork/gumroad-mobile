type AudioContext = {
  resourceId: string;
  urlRedirectId?: string;
  purchaseId?: string;
  contentLength?: number;
};

let currentContext: AudioContext | null = null;
let storedAccessToken: string | null = null;

export const setAudioContext = (ctx: AudioContext | null) => {
  currentContext = ctx;
};

export const getAudioContext = () => currentContext;

export const setAudioAccessToken = (token: string | null) => {
  storedAccessToken = token;
};

export const getAudioAccessToken = () => storedAccessToken;
