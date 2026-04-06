import { LineIcon, SolidIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Text } from "@/components/ui/text";
import { safeOpenURL } from "@/lib/open-url";
import { useCallback, useEffect, useState } from "react";
import { Modal, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackPlayer, {
  RepeatMode,
  State,
  useActiveTrack,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";
import * as SecureStore from "expo-secure-store";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2, 0.5];
const PLAYBACK_SPEED_KEY = "audio_playback_speed";
const LOOP_ENABLED_KEY = "audio_loop_enabled";

export const getStoredPlaybackSpeed = async () => {
  const stored = await SecureStore.getItemAsync(PLAYBACK_SPEED_KEY);
  if (stored) {
    const speed = parseFloat(stored);
    if (PLAYBACK_SPEEDS.includes(speed)) return speed;
  }
};

const setStoredPlaybackSpeed = (speed: number) => SecureStore.setItemAsync(PLAYBACK_SPEED_KEY, speed.toString());

export const getStoredLoopEnabled = async () => {
  const stored = await SecureStore.getItemAsync(LOOP_ENABLED_KEY);
  return stored !== "false";
};

const setStoredLoopEnabled = (enabled: boolean) => SecureStore.setItemAsync(LOOP_ENABLED_KEY, enabled.toString());

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const FullAudioPlayer = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const { position, duration } = useProgress();
  const { top, bottom } = useSafeAreaInsets();
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [queueLength, setQueueLength] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const updateQueueState = useCallback(async () => {
    const queue = await TrackPlayer.getQueue();
    setQueueLength(queue.length);
    const index = await TrackPlayer.getActiveTrackIndex();
    setCurrentIndex(index ?? 0);
  }, []);

  useEffect(() => {
    if (visible) updateQueueState();
  }, [visible, activeTrack?.url, updateQueueState]);

  useEffect(() => {
    const loadSettings = async () => {
      const speed = await TrackPlayer.getRate();
      if (PLAYBACK_SPEEDS.includes(speed)) setPlaybackSpeed(speed);
      const loop = await getStoredLoopEnabled();
      setLoopEnabled(loop);
    };
    if (visible) loadSettings();
  }, [visible]);

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
    await setStoredPlaybackSpeed(newSpeed);
  };

  const handleToggleLoop = async () => {
    const newValue = !loopEnabled;
    setLoopEnabled(newValue);
    await TrackPlayer.setRepeatMode(newValue ? RepeatMode.Queue : RepeatMode.Off);
    await setStoredLoopEnabled(newValue);
  };

  const handlePreviousTrack = async () => {
    if (hasPrevious) await TrackPlayer.skipToPrevious();
    await updateQueueState();
  };

  const handleNextTrack = async () => {
    if (hasNext) await TrackPlayer.skipToNext();
    await updateQueueState();
  };

  const hasPrevious = queueLength > 1 && currentIndex > 0;
  const hasNext = queueLength > 1 && currentIndex < queueLength - 1;

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
              className="aspect-square size-72 rounded-lg bg-muted md:size-96"
            />
          ) : (
            <View className="aspect-square size-72 items-center justify-center rounded-lg bg-muted md:size-96">
              <LineIcon name="music" size={80} className="text-muted-foreground" />
            </View>
          )}

          <View className="mt-8 w-72 md:w-96">
            <Text className="text-center text-xl font-bold text-foreground" numberOfLines={2}>
              {activeTrack.title || "Unknown Track"}
            </Text>
            {activeTrack.artist && (
              <TouchableOpacity
                disabled={!activeTrack.artistUrl}
                onPress={() => activeTrack.artistUrl && safeOpenURL(activeTrack.artistUrl)}
              >
                <Text className="mt-1 text-center text-base text-muted-foreground" numberOfLines={1}>
                  {activeTrack.artist}
                </Text>
              </TouchableOpacity>
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

          <View className="mb-8 flex-row items-center justify-center gap-4">
            <TouchableOpacity
              onPress={handlePreviousTrack}
              disabled={!hasPrevious}
              className="size-10 items-center justify-center"
              style={{ opacity: hasPrevious ? 1 : 0.3 }}
            >
              <SolidIcon name="skip-previous" size={24} className="text-foreground" />
            </TouchableOpacity>

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
              <SolidIcon name={isPlaying ? "pause" : "play"} size={48} className="text-primary-foreground" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkipForward}
              className="size-14 items-center justify-center rounded-full border-2 border-foreground"
            >
              <Text className="text-sm font-bold text-foreground">+30</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNextTrack}
              disabled={!hasNext}
              className="size-10 items-center justify-center"
              style={{ opacity: hasNext ? 1 : 0.3 }}
            >
              <SolidIcon name="skip-next" size={24} className="text-foreground" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-center gap-6">
            <TouchableOpacity onPress={handleCycleSpeed} className="h-10 min-w-16 items-center justify-center px-3">
              <Text className="font-bold text-foreground">{playbackSpeed}x</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleLoop}
              className="h-10 min-w-16 flex-row items-center justify-center gap-2 px-3"
            >
              <LineIcon name="repeat-alt-2" size={22} className={loopEnabled ? "text-accent" : "text-foreground"} />
              {!loopEnabled && <Text>Off</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
