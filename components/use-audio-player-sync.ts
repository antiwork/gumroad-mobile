import { useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import type { WebView } from "react-native-webview";

type AudioPlayerInfo = {
  fileId: string;
  isPlaying: boolean;
  latestMediaLocation?: string;
};

export const useAudioPlayerSync = (webViewRef: React.RefObject<WebView | null>) => {
  const audioPlayer = useAudioPlayer();
  const currentAudioResourceIdRef = useRef<string | null>(null);

  const sendAudioPlayerInfo = useCallback(
    (isPlaying: boolean, currentTime: number) => {
      if (!currentAudioResourceIdRef.current) return;
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "mobileAppAudioPlayerInfo",
          payload: {
            fileId: currentAudioResourceIdRef.current,
            isPlaying,
            latestMediaLocation: currentTime.toString(),
          } satisfies AudioPlayerInfo,
        }),
      );
    },
    [webViewRef],
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (audioPlayer.playing) sendAudioPlayerInfo(true, audioPlayer.currentTime);
    }, 5000);

    const subscription = audioPlayer.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) sendAudioPlayerInfo(false, status.currentTime);
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [audioPlayer, sendAudioPlayerInfo]);

  const pauseAudio = () => {
    audioPlayer.pause();
    sendAudioPlayerInfo(false, audioPlayer.currentTime);
  };

  const playAudio = (uri: string, resourceId: string, resumeAt?: number) => {
    audioPlayer.replace(uri);
    if (currentAudioResourceIdRef.current !== resourceId) {
      audioPlayer.seekTo(resumeAt ?? 0);
    }
    audioPlayer.play();
    currentAudioResourceIdRef.current = resourceId;
    sendAudioPlayerInfo(true, audioPlayer.currentTime);
  };

  return { pauseAudio, playAudio };
};
