import { useAuth } from "@/lib/auth-context";
import { setAudioAccessToken, setAudioMetadata } from "@/lib/audio-player-store";
import { updateMediaLocation } from "@/lib/media-location";
import {
  player,
  setupPlayer as initPlayer,
  setQueue,
  skipTo,
  resetPlayer,
  getActiveTrack,
  handleTrackEnd,
  setLoopMode,
  on,
  off,
  type AudioTrack,
} from "@/lib/audio-player";
import { useAudioPlayerStatus } from "expo-audio";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

  await initPlayer();
  const loopEnabled = await getStoredLoopEnabled();
  setLoopMode(loopEnabled ? "queue" : "off");
  isPlayerSetup = true;
  playerSetupListeners.forEach((l) => l());
  playerSetupListeners = [];
};

export const useAudioPlayerSync = (webViewRef: React.RefObject<WebView | null>) => {
  const { accessToken } = useAuth();
  const status = useAudioPlayerStatus(player);

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

      const position = player.currentTime;
      const duration = player.duration;
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
      if (!isPlayerSetup) return;
      if (player.playing) {
        await sendAudioPlayerInfo({ isPlaying: true });
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      if (currentAudioRef.current) sendAudioPlayerInfo({ isPlaying: false });
    };
  }, [sendAudioPlayerInfo]);

  const prevPlayingRef = useRef(false);
  const prevDidJustFinishRef = useRef(false);

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    const wasFinished = prevDidJustFinishRef.current;
    prevPlayingRef.current = status.playing;
    prevDidJustFinishRef.current = status.didJustFinish;

    if (wasPlaying && !status.playing && !status.didJustFinish) {
      sendAudioPlayerInfo({ isPlaying: false });
    }

    if (status.didJustFinish && !wasFinished) {
      sendAudioPlayerInfo({ isPlaying: false, isEnd: true });
      handleTrackEnd();
    }
  }, [status.playing, status.didJustFinish, sendAudioPlayerInfo]);

  useEffect(() => {
    const handleQueueEnd = () => {
      sendAudioPlayerInfo({ isPlaying: false, isEnd: true });
    };
    on("queueEnd", handleQueueEnd);
    return () => {
      off("queueEnd", handleQueueEnd);
    };
  }, [sendAudioPlayerInfo]);

  useEffect(() => {
    const handleTrackChange = (track?: AudioTrack) => {
      if (!track) return;
      const previousContext = currentAudioRef.current;
      if (previousContext && previousContext.resourceId !== track.resourceId) {
        const position = player.currentTime;
        syncMediaLocation(position);
      }
      currentAudioRef.current = {
        resourceId: track.resourceId,
        urlRedirectId: track.urlRedirectId,
        purchaseId: track.purchaseId,
        contentLength: track.contentLength,
      };
      setAudioMetadata(currentAudioRef.current);
    };
    on("trackChange", handleTrackChange);
    return () => {
      off("trackChange", handleTrackChange);
    };
  }, [syncMediaLocation]);

  const pauseAudio = useCallback(async () => {
    if (!isPlayerSetup) {
      console.warn("pauseAudio called before player setup");
      return;
    }
    player.pause();
    await sendAudioPlayerInfo({ isPlaying: false });
  }, [sendAudioPlayerInfo]);

  const allTracksRef = useRef<AudioTrackInfo[]>([]);

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
        const position = player.currentTime;
        await syncMediaLocation(position);
      }

      const isNewPlaylist =
        !previousContext ||
        allTracksRef.current.length !== tracks.length ||
        !allTracksRef.current.every((t, i) => t.resourceId === tracks[i].resourceId);

      const audioTracks: AudioTrack[] = tracks.map((track) => ({
        source: { uri: track.uri },
        title: track.title || "Audio Track",
        artist: artist || "Gumroad",
        artistUrl,
        artwork: artwork || undefined,
        resourceId: track.resourceId,
        urlRedirectId: track.urlRedirectId,
        purchaseId: track.purchaseId,
      }));

      if (isNewPlaylist) {
        allTracksRef.current = tracks;
        resetPlayer();
        setQueue(audioTracks);

        const trackIndex = tracks.findIndex((t) => t.resourceId === audio.resourceId);
        skipTo(Math.max(trackIndex, 0));

        if (resumeAt) {
          await player.seekTo(resumeAt);
        }
      } else if (previousContext?.resourceId !== audio.resourceId) {
        const trackIndex = tracks.findIndex((t) => t.resourceId === audio.resourceId);
        if (trackIndex >= 0) {
          skipTo(trackIndex);
          if (resumeAt) await player.seekTo(resumeAt);
        }
      }

      currentAudioRef.current = {
        resourceId: audio.resourceId,
        urlRedirectId: audio.urlRedirectId,
        purchaseId: audio.purchaseId,
      };
      setAudioMetadata(currentAudioRef.current);

      const storedSpeed = await getStoredPlaybackSpeed();
      if (storedSpeed) player.setPlaybackRate(storedSpeed);

      player.play();
      await sendAudioPlayerInfo({ isPlaying: true });
    },
    [sendAudioPlayerInfo, syncMediaLocation],
  );

  return { pauseAudio, playAudio };
};
