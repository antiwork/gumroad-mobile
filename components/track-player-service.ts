import { getAudioAccessToken, getAudioContext } from "@/lib/audio-player-store";
import { updateMediaLocation } from "@/lib/media-location";
import TrackPlayer, { Event, State } from "react-native-track-player";
import { isPlayerInitialized } from "./use-audio-player-sync";

const syncCurrentPosition = async (isEnd = false) => {
  const context = getAudioContext();
  const accessToken = getAudioAccessToken();
  if (!context || !context.urlRedirectId || !accessToken) return;

  const { position } = await TrackPlayer.getProgress();
  const location = isEnd && context.contentLength ? context.contentLength : Math.floor(position);

  await updateMediaLocation({
    urlRedirectId: context.urlRedirectId,
    productFileId: context.resourceId,
    purchaseId: context.purchaseId,
    location,
    accessToken,
  });
};

export const playbackService = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause();
    await syncCurrentPosition();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.stop();
    await syncCurrentPosition();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({ interval }) => {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(position + interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, position - interval));
  });

  setInterval(async () => {
    if (!isPlayerInitialized()) return;
    try {
      const { state } = await TrackPlayer.getPlaybackState();
      if (state === State.Playing) {
        await syncCurrentPosition();
      }
    } catch {}
  }, 5000);
};
