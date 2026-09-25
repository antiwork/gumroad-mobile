import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import TrackPlayer, { State } from "react-native-track-player";
import { FullAudioPlayer } from "@/components/full-audio-player";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { playbackService } from "@/components/track-player-service";
import { getPendingAudioRestore, setPendingAudioRestore } from "@/lib/audio-seek";

let mockState = "ended";
let mockPosition = 3711.049;
let mockDuration = 3711;
let mockTrack = { id: "audio-3711", title: "Audio", url: "https://example.com/audio.m4a" };
const mockEvents: Record<string, (event?: { state: string }) => Promise<void> | void> = {};
let mockFinishSeeking: (event: { x: number }) => void;

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    getActiveTrack: jest.fn(async () => mockTrack),
    getPlaybackState: jest.fn(async () => ({ state: mockState })),
    getProgress: jest.fn(async () => ({ position: mockPosition, duration: mockDuration, buffered: mockDuration })),
    seekTo: jest.fn(async (position: number) => {
      mockPosition = position;
    }),
    seekBy: jest.fn(async (offset: number) => {
      mockPosition = Math.max(0, Math.min(mockDuration, mockPosition + offset));
    }),
    play: jest.fn(async () => {
      if (mockPosition < mockDuration) {
        mockState = "playing";
        mockPosition += 1;
      }
    }),
    pause: jest.fn(async () => {
      mockState = "paused";
    }),
    stop: jest.fn(async () => {
      mockState = "stopped";
    }),
    getQueue: jest.fn(async () => [mockTrack]),
    getActiveTrackIndex: jest.fn(async () => 0),
    getRate: jest.fn(async () => 1),
    addEventListener: jest.fn((event: string, callback: () => Promise<void>) => {
      mockEvents[event] = callback;
      return { remove: jest.fn() };
    }),
  },
  State: {
    Playing: "playing",
    Paused: "paused",
    Stopped: "stopped",
    Ended: "ended",
    Buffering: "buffering",
    Loading: "loading",
  },
  RepeatMode: { Off: 0, Queue: 1 },
  Event: {
    RemotePlay: "remote-play",
    RemotePause: "remote-pause",
    RemoteStop: "remote-stop",
    RemoteNext: "remote-next",
    RemotePrevious: "remote-previous",
    RemoteJumpForward: "remote-forward",
    RemoteJumpBackward: "remote-backward",
    PlaybackState: "playback-state",
    PlaybackActiveTrackChanged: "active-track",
  },
  useActiveTrack: () => mockTrack,
  usePlaybackState: () => ({ state: mockState }),
  useProgress: () => ({ position: mockPosition, duration: mockDuration }),
}));
jest.mock("@/components/use-audio-player-sync", () => ({
  withPlayerReady: (component: unknown) => component,
  isPlayerInitialized: () => true,
}));
jest.mock("@/components/icon", () => ({ LineIcon: () => null, SolidIcon: () => null }));
jest.mock("@/components/styled", () => ({ StyledImage: () => null }));
jest.mock("@/components/ui/text", () => ({ Text: jest.requireActual("react-native").Text }));
jest.mock("@/lib/open-url", () => ({ safeOpenURL: jest.fn() }));
jest.mock("@/lib/audio-player-store", () => ({ getAudioAccessToken: () => null, getAudioContext: () => null }));
jest.mock("react-native-gesture-handler", () => {
  const gesture = {
    hitSlop: jest.fn().mockReturnThis(),
    onBegin: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
    onFinalize: jest.fn((callback: typeof mockFinishSeeking): unknown => {
      mockFinishSeeking = callback;
      return gesture;
    }),
  };
  return {
    Gesture: { Pan: () => gesture, Tap: () => gesture, Exclusive: jest.fn() },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

const controls = ["full", "mini", "remote"] as const;
const pressPlay = async (control: (typeof controls)[number]) => {
  if (control === "remote") {
    await playbackService();
    await mockEvents["remote-play"]();
    return;
  }
  const view = render(control === "full" ? <FullAudioPlayer visible onClose={jest.fn()} /> : <MiniAudioPlayer />);
  await act(async () => {});
  await act(async () => {
    fireEvent.press(view.getByTestId(`${control}-audio-play-pause`));
  });
  view.unmount();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.keys(mockEvents).forEach((key) => delete mockEvents[key]);
  mockState = State.Ended;
  mockPosition = 3711.049;
  mockDuration = 3711;
  mockTrack = { id: "audio-3711", title: "Audio", url: "https://example.com/audio.m4a" };
  (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => mockTrack);
  (TrackPlayer.getProgress as jest.Mock).mockReset().mockImplementation(async () => ({
    position: mockPosition,
    duration: mockDuration,
    buffered: mockDuration,
  }));
  (TrackPlayer.seekTo as jest.Mock).mockReset().mockImplementation(async (position: number) => {
    mockPosition = position;
  });
  setPendingAudioRestore(null);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe.each(controls)("%s Play", (control) => {
  it.each([State.Ended, State.Stopped])("restarts native %s at exact end before playing", async (state) => {
    mockState = state;
    await pressPlay(control);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockState).toBe(State.Playing);
    expect(mockPosition).toBe(1);
    expect((TrackPlayer.seekTo as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.play as jest.Mock).mock.invocationCallOrder[0],
    );
  });
  it.each([1800, 3690, 3710.8])(
    "resumes live paused position %s without applying saved near-end policy",
    async (position) => {
      mockState = State.Paused;
      mockPosition = position;
      await pressPlay(control);
      expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
      expect(mockPosition).toBe(position + 1);
    },
  );
  it("does not seek or play a replacement track after reading progress", async () => {
    (TrackPlayer.getProgress as jest.Mock).mockImplementationOnce(async () => {
      mockTrack = { ...mockTrack, id: "replacement" };
      return { position: mockPosition, duration: mockDuration, buffered: mockDuration };
    });
    await pressPlay(control);
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
  it("does not play a replacement track after the replay seek", async () => {
    (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(async () => {
      mockTrack = { ...mockTrack, id: "replacement" };
    });
    await pressPlay(control);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
  it("retains unknown-duration restoration and its play intent", async () => {
    mockDuration = 0;
    setPendingAudioRestore({ resourceId: mockTrack.id, position: 3711, provisionalPosition: 3711 });
    await pressPlay(control);
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(getPendingAudioRestore()).toEqual(expect.objectContaining({ resourceId: mockTrack.id, play: true }));
  });
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const beginDeferredResume = async (control: (typeof controls)[number], during: "read" | "seek") => {
  await playbackService();
  const entered = deferred();
  const released = deferred();
  const nativeMethod = during === "read" ? TrackPlayer.getProgress : TrackPlayer.seekTo;
  (nativeMethod as jest.Mock).mockImplementationOnce(async () => {
    const progress = { position: mockPosition, duration: mockDuration, buffered: mockDuration };
    entered.resolve();
    await released.promise;
    if (during === "seek") mockPosition = 0;
    return during === "read" ? progress : undefined;
  });
  const view =
    control === "remote"
      ? null
      : render(control === "full" ? <FullAudioPlayer visible onClose={jest.fn()} /> : <MiniAudioPlayer />);
  await act(async () => {});
  let completion: Promise<void> | void;
  await act(async () => {
    completion = view ? fireEvent.press(view.getByTestId(`${control}-audio-play-pause`)) : mockEvents["remote-play"]();
    await entered.promise;
  });
  return {
    view,
    finish: async () => {
      await act(async () => {
        released.resolve();
        await completion;
      });
      view?.unmount();
    },
  };
};

describe.each(controls)("%s command ordering", (control) => {
  describe.each(["read", "seek"] as const)("during native %s", (during) => {
    it.each(["pause", "stop"] as const)("honors a later remote %s and permits a fresh Play", async (command) => {
      const pending = await beginDeferredResume(control, during);
      await act(async () => {
        await mockEvents[`remote-${command}`]();
      });
      await pending.finish();
      expect(TrackPlayer.play).not.toHaveBeenCalled();
      expect(mockState).toBe(command === "pause" ? State.Paused : State.Stopped);
      if (during === "read") expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
      await pressPlay(control);
      expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockState).toBe(State.Playing);
    });

    it.each(["pause", "stop"] as const)(
      "does not revive an old request after %s followed by a newer Play",
      async (command) => {
        const pending = await beginDeferredResume(control, during);
        await act(async () => {
          await mockEvents[`remote-${command}`]();
        });
        await act(async () => {
          await mockEvents["remote-play"]();
        });
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        const seeks = (TrackPlayer.seekTo as jest.Mock).mock.calls.length;
        await pending.finish();
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.seekTo).toHaveBeenCalledTimes(seeks);
      },
    );

    it("keeps replay active through native state notifications", async () => {
      const pending = await beginDeferredResume(control, during);
      await act(async () => {
        await mockEvents["playback-state"]({ state: State.Paused });
        await mockEvents["playback-state"]({ state: State.Stopped });
        await mockEvents["playback-state"]({ state: State.Playing });
      });
      await pending.finish();
      expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockState).toBe(State.Playing);
    });
  });
});

describe.each(["full", "mini"] as const)("%s Pause command ordering", (control) => {
  it.each(["read", "seek"] as const)("cancels a pending resume during native %s", async (during) => {
    const pending = await beginDeferredResume(control, during);
    mockState = State.Playing;
    pending.view!.rerender(control === "full" ? <FullAudioPlayer visible onClose={jest.fn()} /> : <MiniAudioPlayer />);
    await act(async () => {
      fireEvent.press(pending.view!.getByTestId(`${control}-audio-play-pause`));
    });
    await pending.finish();
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(mockState).toBe(State.Paused);
  });
});

describe.each(controls)("%s deliberate seek ordering", (control) => {
  it.each(["scrub", "remote backward"] as const)(
    "preserves a later %s while replay reads are pending and permits fresh Play",
    async (seek) => {
      const pending = await beginDeferredResume(control, "read");
      const selectedPosition = seek === "scrub" ? mockDuration / 2 : mockPosition - 15;
      if (seek === "scrub") {
        const view = control === "full" ? pending.view! : render(<FullAudioPlayer visible onClose={jest.fn()} />);
        await act(async () => {
          fireEvent(view.getByLabelText("Playback position"), "layout", { nativeEvent: { layout: { width: 100 } } });
          mockFinishSeeking({ x: 50 });
        });
        expect(TrackPlayer.seekTo).toHaveBeenCalledWith(selectedPosition);
        if (control !== "full") view.unmount();
      } else {
        await act(async () => {
          await mockEvents["remote-backward"]();
        });
        expect(TrackPlayer.seekBy).toHaveBeenCalledWith(-15);
      }
      expect(mockPosition).toBe(selectedPosition);
      mockState = State.Paused;
      await act(async () => {
        await mockEvents["playback-state"]({ state: State.Paused });
      });
      await pending.finish();
      expect(mockPosition).toBe(selectedPosition);
      expect(TrackPlayer.seekTo).not.toHaveBeenCalledWith(0);
      expect(TrackPlayer.play).not.toHaveBeenCalled();
      await pressPlay(control);
      expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockState).toBe(State.Playing);
      expect(mockPosition).toBe(selectedPosition + 1);
      expect(TrackPlayer.seekTo).not.toHaveBeenCalledWith(0);
    },
  );
});
