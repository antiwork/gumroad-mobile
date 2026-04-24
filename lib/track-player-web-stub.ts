const noop = async () => {};
const noopSync = () => {};
const emptyArray = async () => [];
const zeroProgress = async () => ({ position: 0, duration: 0, buffered: 0 });
const nullAsync = async () => null;

const TrackPlayer = {
  setupPlayer: noop,
  updateOptions: noop,
  registerPlaybackService: noopSync,
  add: noop,
  reset: noop,
  play: noop,
  pause: noop,
  stop: noop,
  seekTo: noop,
  skip: noop,
  skipToNext: noop,
  skipToPrevious: noop,
  setRate: noop,
  setRepeatMode: noop,
  getRate: async () => 1,
  getActiveTrack: nullAsync,
  getActiveTrackIndex: nullAsync,
  getPlaybackState: async () => ({ state: "none" }),
  getProgress: zeroProgress,
  getQueue: emptyArray,
  addEventListener: () => ({ remove: noopSync }),
};

export const Event = {
  PlaybackState: "playback-state",
  PlaybackQueueEnded: "playback-queue-ended",
  PlaybackActiveTrackChanged: "playback-active-track-changed",
  RemotePlay: "remote-play",
  RemotePause: "remote-pause",
  RemoteStop: "remote-stop",
  RemoteNext: "remote-next",
  RemotePrevious: "remote-previous",
  RemoteJumpForward: "remote-jump-forward",
  RemoteJumpBackward: "remote-jump-backward",
} as const;

export const State = {
  None: "none",
  Ready: "ready",
  Playing: "playing",
  Paused: "paused",
  Stopped: "stopped",
  Buffering: "buffering",
  Loading: "loading",
  Ended: "ended",
} as const;

export const Capability = {
  Play: "play",
  Pause: "pause",
  Stop: "stop",
  SkipToNext: "skip-to-next",
  SkipToPrevious: "skip-to-previous",
  JumpForward: "jump-forward",
  JumpBackward: "jump-backward",
} as const;

export const RepeatMode = {
  Off: 0,
  Track: 1,
  Queue: 2,
} as const;

export const useActiveTrack = () => null;
export const usePlaybackState = () => ({ state: State.None });
export const useProgress = () => ({ position: 0, duration: 0, buffered: 0 });

export default TrackPlayer;
