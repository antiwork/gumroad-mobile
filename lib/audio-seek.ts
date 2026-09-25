import { isResumableLocation } from "@/lib/media-location";
import TrackPlayer, { State } from "react-native-track-player";

type PendingAudioRestore = {
  resourceId: string;
  position: number;
  provisionalPosition: number;
  resolving?: boolean;
  play?: boolean;
  cancelled?: boolean;
};

let pendingRestore: PendingAudioRestore | null = null;
let playbackIntentVersion = 0;

export const getPendingAudioRestore = () => pendingRestore;
export const setPendingAudioRestore = (restore: PendingAudioRestore | null) => {
  pendingRestore = restore;
};
export const invalidatePendingAudioRestore = (resourceId?: string) => {
  if (pendingRestore && pendingRestore.resourceId !== resourceId) pendingRestore.cancelled = true;
};
export const isAudioRestorePending = (resourceId: string) => pendingRestore?.resourceId === resourceId;
export const setPendingAudioPlaybackIntent = (play: boolean) => {
  if (pendingRestore) pendingRestore.play = play;
};
export const setAudioPlaybackIntent = (play: boolean) => {
  playbackIntentVersion += 1;
  setPendingAudioPlaybackIntent(play);
};

export const resumeAudioPlayback = async () => {
  setAudioPlaybackIntent(true);
  const intentVersion = playbackIntentVersion;
  const track = await TrackPlayer.getActiveTrack();
  if (!track) return;
  const { state } = await TrackPlayer.getPlaybackState();
  const { position, duration } = await TrackPlayer.getProgress();
  if ((await TrackPlayer.getActiveTrack())?.id !== track.id || intentVersion !== playbackIntentVersion) return;
  if (!isAudioRestorePending(track.id) && (state === State.Ended || (duration > 0 && position >= duration))) {
    await TrackPlayer.seekTo(0);
    if ((await TrackPlayer.getActiveTrack())?.id !== track.id || intentVersion !== playbackIntentVersion) return;
  }
  await TrackPlayer.play();
};

export const resolvePendingAudioRestore = async (
  resourceId: string,
  progress: { position: number; duration: number },
  play: boolean,
) => {
  const pending = pendingRestore;
  if (pending?.resourceId !== resourceId) return { ...progress, restored: false };
  if (pending.cancelled) {
    pendingRestore = null;
    return { ...progress, restored: false };
  }
  if (!(progress.duration > 0) || pending.resolving) return null;
  const position = isResumableLocation(pending.position, progress.duration) ? pending.position : 0;
  if (position === pending.provisionalPosition) {
    pendingRestore = null;
    return { ...progress, restored: false };
  }
  pending.resolving = true;
  try {
    if ((await TrackPlayer.getActiveTrack())?.id !== resourceId || pendingRestore !== pending || pending.cancelled)
      return null;
    await TrackPlayer.seekTo(position);
    if ((await TrackPlayer.getActiveTrack())?.id !== resourceId || pendingRestore !== pending || pending.cancelled)
      return null;
    if (pending.play ?? play) await TrackPlayer.play();
    if ((await TrackPlayer.getActiveTrack())?.id !== resourceId || pendingRestore !== pending || pending.cancelled)
      return null;
    pendingRestore = null;
    return { ...progress, position, restored: true };
  } finally {
    pending.resolving = false;
  }
};

export const seekAudioTo = (position: number) => {
  playbackIntentVersion += 1;
  pendingRestore = null;
  return TrackPlayer.seekTo(position);
};

export const seekAudioBy = (offset: number) => {
  playbackIntentVersion += 1;
  pendingRestore = null;
  return TrackPlayer.seekBy(offset);
};
