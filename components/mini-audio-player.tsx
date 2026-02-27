import { FullAudioPlayer } from "@/components/full-audio-player";
import { LineIcon, SolidIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Text } from "@/components/ui/text";
import { useEffect, useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";
import TrackPlayer, { State, useActiveTrack, usePlaybackState, useProgress } from "react-native-track-player";

export const MiniAudioPlayer = () => {
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const { position, duration } = useProgress();
  const [isVisible, setIsVisible] = useState(false);

  const [isFullPlayerVisible, setFullPlayerVisible] = useState(false);

  const isPlaying = playbackState.state === State.Playing;
  const isBuffering = playbackState.state === State.Buffering || playbackState.state === State.Loading;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  useEffect(() => {
    const checkTrack = async () => {
      const track = await TrackPlayer.getActiveTrack();
      setIsVisible(track !== undefined);
    };
    checkTrack();
  }, [activeTrack]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const handleSkipForward = async () => {
    const { position, duration } = await TrackPlayer.getProgress();
    const newPosition = Math.min(position + 30, duration);
    await TrackPlayer.seekTo(newPosition);
  };

  if (!isVisible || !activeTrack) {
    return null;
  }

  return (
    <>
      <Pressable onPress={() => setFullPlayerVisible(true)}>
        <View className="h-1 border-t border-border bg-background">
          <View className="h-1 bg-primary" style={{ width: `${progress}%` }} />
        </View>
        <View className="flex-row items-center gap-2 bg-background px-3 pt-2 pb-3">
          {activeTrack.artwork ? (
            <StyledImage source={{ uri: activeTrack.artwork }} className="size-8 rounded bg-muted" />
          ) : (
            <View className="size-8 items-center justify-center rounded bg-muted">
              <LineIcon name="music" size={16} className="text-muted-foreground" />
            </View>
          )}

          <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={1}>
            {activeTrack.title || "Unknown Track"}
          </Text>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handlePlayPause}
              disabled={isBuffering}
              className="size-7 items-center justify-center rounded-full bg-primary"
            >
              <SolidIcon name={isPlaying ? "pause" : "play"} size={24} className="text-primary-foreground" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkipForward}
              className="size-7 items-center justify-center rounded-full border-2 border-foreground"
            >
              <Text className="text-xs font-bold">+30</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
      <FullAudioPlayer visible={isFullPlayerVisible} onClose={() => setFullPlayerVisible(false)} />
    </>
  );
};
