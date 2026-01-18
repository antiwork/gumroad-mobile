import { useCallback, useEffect, useRef } from "react";
import TrackPlayer, { Capability, Event, RepeatMode, State } from "react-native-track-player";
import type { WebView } from "react-native-webview";

type AudioPlayerInfo = {
  fileId: string;
  isPlaying: boolean;
  latestMediaLocation?: string;
};

export const setupPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
    });
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
  } catch {
    console.info("Player already initialized");
  }
};

export const useAudioPlayerSync = (webViewRef: React.RefObject<WebView | null>) => {
  const currentAudioResourceIdRef = useRef<string | null>(null);

  const sendAudioPlayerInfo = useCallback(
    async (isPlaying: boolean) => {
      if (!currentAudioResourceIdRef.current) return;
      const { position } = await TrackPlayer.getProgress();

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "mobileAppAudioPlayerInfo",
          payload: {
            fileId: currentAudioResourceIdRef.current,
            isPlaying,
            latestMediaLocation: position.toString(),
          } satisfies AudioPlayerInfo,
        }),
      );
    },
    [webViewRef],
  );

  useEffect(() => {
    const intervalId = setInterval(async () => {
      const { state } = await TrackPlayer.getPlaybackState();
      if (state === State.Playing) {
        await sendAudioPlayerInfo(true);
      }
    }, 5000);

    // Listen for playback state changes
    const subscription = TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
      if (state === State.Paused || state === State.Stopped || state === State.Ended) {
        await sendAudioPlayerInfo(false);
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [sendAudioPlayerInfo]);

  const pauseAudio = useCallback(async () => {
    await TrackPlayer.pause();
    await sendAudioPlayerInfo(false);
  }, [sendAudioPlayerInfo]);

  const playAudio = useCallback(
    async ({
      uri,
      resourceId,
      resumeAt,
      title,
      artist,
      artwork,
    }: {
      uri: string;
      resourceId: string;
      resumeAt?: number;
      title?: string;
      artist?: string;
      artwork?: string | null;
    }) => {
      if (currentAudioResourceIdRef.current !== resourceId) {
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: resourceId,
          url: uri,
          title: title || "Audio Track",
          artist: artist || "Gumroad",
          artwork: artwork || undefined,
        });

        if (resumeAt) {
          await TrackPlayer.seekTo(resumeAt);
        }
      }

      await TrackPlayer.play();
      currentAudioResourceIdRef.current = resourceId;
      await sendAudioPlayerInfo(true);
    },
    [sendAudioPlayerInfo],
  );

  return { pauseAudio, playAudio };
};
