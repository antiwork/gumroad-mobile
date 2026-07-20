import { getAudioAccessToken, getAudioContext } from "@/lib/audio-player-store";
import { isMeaningfulLocation, updateMediaLocation } from "@/lib/media-location";
import TrackPlayer, { Event, State } from "react-native-track-player";
import { isPlayerInitialized } from "./use-audio-player-sync";

const syncCurrentPosition = async () => {
  const accessToken = getAudioAccessToken();
  if (!accessToken) return;

  // Prefer the native active track, which carries its own urlRedirectId/purchaseId. The JS
  // store context is only updated while a screen is mounted, so after the queue auto-advances
  // with no UI open (Android keeps playing when the app is swiped away) the store still points
  // at the previous track and would save this track's position onto the wrong file.
  const activeTrack = await TrackPlayer.getActiveTrack();
  const context = getAudioContext();
  const urlRedirectId = activeTrack?.urlRedirectId ?? context?.urlRedirectId;
  const productFileId = activeTrack?.id ?? context?.resourceId;
  const purchaseId = activeTrack?.purchaseId ?? context?.purchaseId;
  if (!urlRedirectId || !productFileId) return;

  const { position } = await TrackPlayer.getProgress();
  if (!isMeaningfulLocation(position, false)) return;
  const location = Math.floor(position);

  await updateMediaLocation({
    urlRedirectId,
    productFileId,
    purchaseId,
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

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const queue = await TrackPlayer.getQueue();
    const index = await TrackPlayer.getActiveTrackIndex();
    if (index !== undefined && index < queue.length - 1) await TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const index = await TrackPlayer.getActiveTrackIndex();
    if (index !== undefined && index > 0) await TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const interval = event?.interval ?? 30;
    await TrackPlayer.seekBy(interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const interval = event?.interval ?? 15;
    await TrackPlayer.seekBy(-interval);
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
