import { LineIcon, SolidIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { Modal, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackPlayer, { State, useActiveTrack, usePlaybackState, useProgress } from "react-native-track-player";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2, 0.5];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const FullAudioPlayer = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const { position, duration } = useProgress();
  const { top, bottom } = useSafeAreaInsets();
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const isPlaying = playbackState.state === State.Playing;
  const isBuffering = playbackState.state === State.Buffering || playbackState.state === State.Loading;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const handlePlayPause = async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const handleSkipBack = async () => {
    const { position } = await TrackPlayer.getProgress();
    const newPosition = Math.max(position - 15, 0);
    await TrackPlayer.seekTo(newPosition);
  };

  const handleSkipForward = async () => {
    const { position, duration } = await TrackPlayer.getProgress();
    const newPosition = Math.min(position + 30, duration);
    await TrackPlayer.seekTo(newPosition);
  };

  const handleClose = async () => {
    await TrackPlayer.reset();
    onClose();
  };

  const handleCycleSpeed = async () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    await TrackPlayer.setRate(newSpeed);
  };

  const handleSeek = async (locationX: number, width: number) => {
    const percentage = locationX / width;
    const newPosition = percentage * duration;
    await TrackPlayer.seekTo(newPosition);
  };

  if (!activeTrack) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-background" style={{ paddingTop: top, paddingBottom: bottom }}>
        <View className="flex-row items-center justify-between px-4 py-2">
          <TouchableOpacity onPress={onClose} className="size-10 items-center justify-center">
            <LineIcon name="chevron-down" size={28} className="text-foreground" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} className="size-10 items-center justify-center">
            <LineIcon name="x" size={28} className="text-foreground" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          {activeTrack.artwork ? (
            <StyledImage
              source={{ uri: activeTrack.artwork }}
              className="aspect-square w-full max-w-80 rounded-lg bg-muted"
            />
          ) : (
            <View className="aspect-square w-full max-w-80 items-center justify-center rounded-lg bg-muted">
              <LineIcon name="music" size={80} className="text-muted-foreground" />
            </View>
          )}

          <View className="mt-8 w-full max-w-80">
            <Text className="text-center text-xl font-bold text-foreground" numberOfLines={2}>
              {activeTrack.title || "Unknown Track"}
            </Text>
            {activeTrack.artist && (
              <Text className="mt-1 text-center text-base text-muted-foreground" numberOfLines={1}>
                {activeTrack.artist}
              </Text>
            )}
          </View>
        </View>

        <View className="px-8 pb-8">
          <TouchableOpacity
            onPress={(e) => handleSeek(e.nativeEvent.locationX, e.nativeEvent.target ? 300 : 300)}
            onLayout={() => {}}
            className="mb-2"
          >
            <View
              className="h-1 w-full rounded-full bg-muted"
              onStartShouldSetResponder={() => true}
              onResponderRelease={(e) => {
                const width = e.nativeEvent.target ? 300 : 300;
                handleSeek(e.nativeEvent.locationX, width);
              }}
            >
              <View className="h-1 rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </View>
          </TouchableOpacity>

          <View className="mb-8 flex-row justify-between">
            <Text className="text-xs text-muted-foreground">{formatTime(position)}</Text>
            <Text className="text-xs text-muted-foreground">{formatTime(duration)}</Text>
          </View>

          <View className="mb-8 flex-row items-center justify-center gap-6">
            <TouchableOpacity
              onPress={handleSkipBack}
              className="size-14 items-center justify-center rounded-full border-2 border-foreground"
            >
              <Text className="text-sm font-bold text-foreground">-15</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePlayPause}
              disabled={isBuffering}
              className="size-16 items-center justify-center rounded-full bg-primary"
            >
              <SolidIcon
                name={isPlaying ? "pause" : "play"}
                size={48}
                className="text-primary-foreground"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkipForward}
              className="size-14 items-center justify-center rounded-full border-2 border-foreground"
            >
              <Text className="text-sm font-bold text-foreground">+30</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-center">
            <TouchableOpacity onPress={handleCycleSpeed} className="h-10 min-w-16 items-center justify-center px-3">
              <Text className="font-bold text-foreground">{playbackSpeed}x</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
