import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

export type AudioTrack = {
  source: { uri: string };
  title: string;
  artist: string;
  artistUrl?: string;
  artwork?: string;
  resourceId: string;
  urlRedirectId?: string;
  purchaseId?: string;
  contentLength?: number;
};

type EventName = "trackChange" | "queueEnd";
type Listener = (track?: AudioTrack) => void;

let queue: AudioTrack[] = [];
let activeTrackIndex = -1;
let loopMode: "off" | "queue" = "off";
const listeners = new Map<EventName, Set<Listener>>();

export const player: AudioPlayer = createAudioPlayer();

const emit = (event: EventName, track?: AudioTrack) => {
  listeners.get(event)?.forEach((cb) => cb(track));
};

export const on = (event: EventName, cb: Listener) => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
};

export const off = (event: EventName, cb: Listener) => {
  listeners.get(event)?.delete(cb);
};

export const setupPlayer = async () => {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix",
  });
};

export const setQueue = (tracks: AudioTrack[]) => {
  queue = tracks;
};

export const getQueue = () => queue;

export const getActiveTrack = (): AudioTrack | null => queue[activeTrackIndex] ?? null;

export const getActiveTrackIndex = () => activeTrackIndex;

const updateLockScreen = (track: AudioTrack) => {
  player.setActiveForLockScreen(
    true,
    {
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artwork,
    },
    {
      showSeekForward: true,
      showSeekBackward: true,
    },
  );
};

export const skipTo = (index: number) => {
  console.log("skipTo", index, queue.length)
  if (index < 0 || index >= queue.length) return;
  activeTrackIndex = index;
  const track = queue[index];
  player.replace(track.source);
  player.play();
  updateLockScreen(track);
  emit("trackChange", track);
};

export const skipToNext = () => {
  if (activeTrackIndex < queue.length - 1) {
    skipTo(activeTrackIndex + 1);
  } else if (loopMode === "queue" && queue.length > 0) {
    skipTo(0);
  } else {
    emit("queueEnd");
  }
};

export const skipToPrevious = () => {
  if (activeTrackIndex > 0) {
    skipTo(activeTrackIndex - 1);
  }
};

export const setLoopMode = (mode: "off" | "queue") => {
  loopMode = mode;
};

export const getLoopMode = () => loopMode;

export const resetPlayer = () => {
  player.pause();
  queue = [];
  activeTrackIndex = -1;
  player.clearLockScreenControls();
};

export const handleTrackEnd = () => {
  skipToNext();
};
