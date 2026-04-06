import { useAuth } from "@/lib/auth-context";
import { setAudioAccessToken, setAudioContext } from "@/lib/audio-player-store";
import { updateMediaLocation } from "@/lib/media-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import TrackPlayer, { Capability, Event, RepeatMode, State } from "react-native-track-player";
import type { WebView } from "react-native-webview";
import { getStoredLoopEnabled, getStoredPlaybackSpeed } from "./full-audio-player";

type AudioPlayerInfo = {
  fileId: string;
  isPlaying: boolean;
  latestMediaLocation?: string;
};

export type AudioTrackInfo = {
  uri: string;
  resourceId: string;
  title?: string;
  urlRedirectId?: string;
  purchaseId?: string;
};

let isPlayerSetup = false;
let playerSetupListeners: (() => void)[] = [];

export const isPlayerInitialized = () => isPlayerSetup;

export const withPlayerReady = <P extends object>(Component: React.ComponentType<P>): React.FC<P> => {
  const Wrapped: React.FC<P> = (props) => {
    const [ready, setReady] = useState(isPlayerSetup);
    useEffect(() => {
      if (isPlayerSetup) {
        setReady(true);
        return;
      }
      const listener = () => setReady(true);
      playerSetupListeners.push(listener);
      return () => {
        playerSetupListeners = playerSetupListeners.filter((l) => l !== listener);
      };
    }, []);
    if (!ready) return null;
    return React.createElement(Component, props);
  };
  return Wrapped;
};

export const setupPlayer = async () => {
  if (isPlayerSetup) return;

  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    forwardJumpInterval: 30,
    backwardJumpInterval: 15,
  });
  const loopEnabled = await getStoredLoopEnabled();
  await TrackPlayer.setRepeatMode(loopEnabled ? RepeatMode.Queue : RepeatMode.Off);
  isPlayerSetup = true;
  playerSetupListeners.forEach((l) => l());
  playerSetupListeners = [];
};

export const useAudioPlayerSync = (webViewRef: React.RefObject<WebView | null>) => {
  const { accessToken } = useAuth();

  useEffect(() => {
    setAudioAccessToken(accessToken);
  }, [accessToken]);

  const currentAudioRef = useRef<{
    resourceId: string;
    urlRedirectId?: string;
    purchaseId?: string;
    contentLength?: number;
  } | null>(null);

  const syncMediaLocation = useCallback(
    async (position: number, isEnd = false) => {
      const currentAudio = currentAudioRef.current;
      if (!currentAudio || !currentAudio.urlRedirectId) return;
      // Avoid saving the location 0:01, it's not useful
      if (!isEnd && position > 0 && position < 3) return;

      const location = isEnd && currentAudio.contentLength ? currentAudio.contentLength : Math.floor(position);

      await updateMediaLocation({
        urlRedirectId: currentAudio.urlRedirectId,
        productFileId: currentAudio.resourceId,
        purchaseId: currentAudio.purchaseId,
        location,
        accessToken,
      });
    },
    [accessToken],
  );

  const sendAudioPlayerInfo = useCallback(
    async ({ isPlaying, isEnd: forceIsEnd }: { isPlaying: boolean; isEnd?: boolean }) => {
      const currentAudio = currentAudioRef.current;
      if (!currentAudio) return;

      const { position, duration } = await TrackPlayer.getProgress();
      const isStart = position < 1;
      const isEnd = forceIsEnd || (duration > 0 && position >= duration - 0.5);

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "mobileAppAudioPlayerInfo",
          payload: {
            fileId: currentAudio.resourceId,
            isPlaying,
            latestMediaLocation: position.toString(),
          } satisfies AudioPlayerInfo,
        }),
      );

      const flooredPosition = Math.floor(position);
      if (!isPlaying || isStart || isEnd || flooredPosition % 5 === 0) {
        await syncMediaLocation(position, isEnd);
      }
    },
    [webViewRef, syncMediaLocation],
  );

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (!isPlayerSetup) {
        console.warn("Audio polling called before player setup");
        return;
      }
      const { state } = await TrackPlayer.getPlaybackState();
      if (state === State.Playing) {
        await sendAudioPlayerInfo({ isPlaying: true });
      }
    }, 5000);

    const stateSubscription = TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
      if (state === State.Paused || state === State.Stopped) {
        await sendAudioPlayerInfo({ isPlaying: false });
      } else if (state === State.Ended) {
        await sendAudioPlayerInfo({ isPlaying: false, isEnd: true });
      }
    });

    const endSubscription = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
      await sendAudioPlayerInfo({ isPlaying: false, isEnd: true });
    });

    return () => {
      clearInterval(intervalId);
      stateSubscription.remove();
      endSubscription.remove();
      if (currentAudioRef.current) sendAudioPlayerInfo({ isPlaying: false });
    };
  }, [sendAudioPlayerInfo, syncMediaLocation]);

  const pauseAudio = useCallback(async () => {
    if (!isPlayerSetup) {
      console.warn("pauseAudio called before player setup");
      return;
    }
    await TrackPlayer.pause();
    await sendAudioPlayerInfo({ isPlaying: false });
  }, [sendAudioPlayerInfo]);

  const allTracksRef = useRef<AudioTrackInfo[]>([]);

  const updateCurrentAudioRef = useCallback((resourceId: string, duration?: number) => {
    const track = allTracksRef.current.find((t) => t.resourceId === resourceId);
    if (track) {
      const context = { ...track, contentLength: duration };
      currentAudioRef.current = context;
      setAudioContext(context);
    }
  }, []);

  useEffect(() => {
    const subscription = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      if (event.track?.id) {
        const previousContext = currentAudioRef.current;
        if (previousContext && previousContext.resourceId !== event.track.id) {
          const position = event.lastPosition ?? 0;
          await syncMediaLocation(position);
        }
        updateCurrentAudioRef(event.track.id, event.track.duration);
      }
    });
    return () => subscription.remove();
  }, [syncMediaLocation, updateCurrentAudioRef]);

  const playAudio = useCallback(
    async ({
      resourceId,
      resumeAt,
      artist,
      artistUrl,
      artwork,
      tracks,
    }: {
      resourceId: string;
      resumeAt?: number;
      artist?: string;
      artistUrl?: string;
      artwork?: string | null;
      tracks: AudioTrackInfo[];
    }) => {
      if (!isPlayerSetup) {
        console.warn("playAudio called before player setup");
        return;
      }
      const audio = tracks.find((track) => track.resourceId === resourceId);
      if (!audio) {
        console.warn(`Couldn't find track ${resourceId}. Available:`, tracks);
        return;
      }
      const previousContext = currentAudioRef.current;

      if (previousContext && previousContext.resourceId !== audio.resourceId) {
        const { position } = await TrackPlayer.getProgress();
        await syncMediaLocation(position);
      }

      const isNewPlaylist =
        !previousContext ||
        allTracksRef.current.length !== tracks.length ||
        !allTracksRef.current.every((t, i) => t.resourceId === tracks[i].resourceId);

      if (isNewPlaylist) {
        allTracksRef.current = tracks;
        await TrackPlayer.reset();
        await TrackPlayer.add(
          tracks.map((track) => ({
            id: track.resourceId,
            url: track.uri,
            title: track.title || "Audio Track",
            artist: artist || "Gumroad",
            artistUrl,
            artwork: artwork || undefined,
          })),
        );

        const trackIndex = tracks.findIndex((t) => t.resourceId === audio.resourceId);
        if (trackIndex > 0) {
          await TrackPlayer.skip(trackIndex);
        }

        if (resumeAt) {
          await TrackPlayer.seekTo(resumeAt);
        }
      } else if (previousContext?.resourceId !== audio.resourceId) {
        const trackIndex = tracks.findIndex((t) => t.resourceId === audio.resourceId);
        if (trackIndex >= 0) {
          await TrackPlayer.skip(trackIndex);
          if (resumeAt) await TrackPlayer.seekTo(resumeAt);
        }
      }

      currentAudioRef.current = audio;
      setAudioContext(audio);

      const storedSpeed = await getStoredPlaybackSpeed();
      if (storedSpeed) await TrackPlayer.setRate(storedSpeed);

      await TrackPlayer.play();
      await sendAudioPlayerInfo({ isPlaying: true });
    },
    [sendAudioPlayerInfo, syncMediaLocation],
  );

  return { pauseAudio, playAudio };
};
