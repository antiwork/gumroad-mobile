import {
  getPendingAudioRestore,
  invalidatePendingAudioRestore,
  resolvePendingAudioRestore,
  resumeAudioPlayback,
  seekAudioBy,
  setPendingAudioRestore,
  setAudioPlaybackIntent,
  setPendingAudioPlaybackIntent,
} from "@/lib/audio-seek";
import { getAudioAccessToken, getAudioContext } from "@/lib/audio-player-store";
import { isMeaningfulLocation, updateMediaLocation } from "@/lib/media-location";
import TrackPlayer, { Event, State } from "react-native-track-player";
import { isPlayerInitialized } from "./use-audio-player-sync";

let activeTrackVersion = 0;

const syncCurrentPosition = async () => {
  const trackVersion = activeTrackVersion;
  const accessToken = getAudioAccessToken();
  if (!accessToken) return;

  // Prefer the native active track, which carries its own urlRedirectId/purchaseId. The JS
  // store context is only updated while a screen is mounted, so after the queue auto-advances
  // with no UI open (Android keeps playing when the app is swiped away) the store still points
  // at the previous track and would save this track's position onto the wrong file.
  const activeTrack = await TrackPlayer.getActiveTrack();
  if (trackVersion !== activeTrackVersion) return;
  if (activeTrack?.id && getPendingAudioRestore()?.resourceId !== activeTrack.id) setPendingAudioRestore(null);
  const context = getAudioContext();
  const urlRedirectId = activeTrack?.urlRedirectId ?? context?.urlRedirectId;
  const productFileId = activeTrack?.id ?? context?.resourceId;
  const purchaseId = activeTrack?.purchaseId ?? context?.purchaseId;
  if (!urlRedirectId || !productFileId) return;

  const progress = await TrackPlayer.getProgress();
  const { state } = await TrackPlayer.getPlaybackState();
  if ((await TrackPlayer.getActiveTrack())?.id !== activeTrack?.id || trackVersion !== activeTrackVersion) return;
  const resolved = await resolvePendingAudioRestore(
    productFileId,
    progress,
    state === State.Playing || state === State.Ended,
  );
  if (!resolved) return;
  if ((await TrackPlayer.getActiveTrack())?.id !== activeTrack?.id || trackVersion !== activeTrackVersion) return;
  const { position } = resolved;
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
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
    activeTrackVersion += 1;
    invalidatePendingAudioRestore(track?.id);
  });

  TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
    if (state === State.Playing) setPendingAudioPlaybackIntent(true);
    else if (state === State.Paused || state === State.Stopped) setPendingAudioPlaybackIntent(false);
  });

  TrackPlayer.addEventListener(Event.RemotePlay, resumeAudioPlayback);

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    setAudioPlaybackIntent(false);
    await TrackPlayer.pause();
    await syncCurrentPosition();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    setAudioPlaybackIntent(false);
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
    await seekAudioBy(interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const interval = event?.interval ?? 15;
    await seekAudioBy(-interval);
  });

  setInterval(async () => {
    if (!isPlayerInitialized()) return;
    try {
      const { state } = await TrackPlayer.getPlaybackState();
      if (state === State.Playing || getPendingAudioRestore()) {
        await syncCurrentPosition();
      }
    } catch {}
  }, 5000);
};
