type AudioMetadata = {
  resourceId: string;
  urlRedirectId?: string;
  purchaseId?: string;
  contentLength?: number;
};

let currentMetadata: AudioMetadata | null = null;
let storedAccessToken: string | null = null;

export const setAudioMetadata = (ctx: AudioMetadata | null) => {
  currentMetadata = ctx;
};

export const getAudioMetadata = () => currentMetadata;

export const setAudioAccessToken = (token: string | null) => {
  storedAccessToken = token;
};

export const getAudioAccessToken = () => storedAccessToken;
