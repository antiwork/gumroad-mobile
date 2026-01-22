import { updateMediaLocation } from "@/lib/media-location";
import { useCallback, useEffect, useRef } from "react";
import TrackPlayer, { Capability, Event, RepeatMode, State } from "react-native-track-player";
import type { WebView } from "react-native-webview";

type AudioPlayerInfo = {
  fileId: string;
  isPlaying: boolean;
  latestMediaLocation?: string;
};

let isPlayerSetup = false;

export const setupPlayer = async () => {
  if (isPlayerSetup) return;

  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
    notificationCapabilities: [Capability.Play, Capability.Pause],
  });
  await TrackPlayer.setRepeatMode(RepeatMode.Off);
  isPlayerSetup = true;
};

export const useAudioPlayerSync = (webViewRef: React.RefObject<WebView | null>) => {
  const currentAudioRef = useRef<{
    resourceId: string;
    urlRedirectId: string;
    purchaseId?: string;
    contentLength?: number;
  } | null>(null);

  const syncMediaLocation = useCallback(async (position: number, isEnd = false) => {
    const currentAudio = currentAudioRef.current;
    if (!currentAudio) return;

    const location = isEnd && currentAudio.contentLength ? currentAudio.contentLength : Math.floor(position);

    await updateMediaLocation({
      urlRedirectId: currentAudio.urlRedirectId,
      productFileId: currentAudio.resourceId,
      purchaseId: currentAudio.purchaseId,
      location,
    });
  }, []);

  // TODO: Only works when the component is mounted, need to support background playback
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
    await TrackPlayer.pause();
    await sendAudioPlayerInfo({ isPlaying: false });
  }, [sendAudioPlayerInfo]);

  const playAudio = useCallback(
    async (audio: {
      uri: string;
      resourceId: string;
      resumeAt?: number;
      title?: string;
      artist?: string;
      artwork?: string | null;
      urlRedirectId: string;
      purchaseId?: string;
      contentLength?: number;
    }) => {
      const previousContext = currentAudioRef.current;

      // If switching tracks, sync the previous track's position first
      if (previousContext && previousContext.resourceId !== audio.resourceId) {
        const { position } = await TrackPlayer.getProgress();
        await syncMediaLocation(position);
      }

      if (!previousContext || previousContext.resourceId !== audio.resourceId) {
        // TODO: Should add multiple tracks when there are multiple audio files in the purchase
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: audio.resourceId,
          url: audio.uri,
          title: audio.title || "Audio Track",
          artist: audio.artist || "Gumroad",
          artwork: audio.artwork || undefined,
        });

        if (audio.resumeAt) {
          await TrackPlayer.seekTo(audio.resumeAt);
        }
      }

      currentAudioRef.current = audio;

      await TrackPlayer.play();
      await sendAudioPlayerInfo({ isPlaying: true });
    },
    [sendAudioPlayerInfo, syncMediaLocation],
  );

  return { pauseAudio, playAudio };
};
