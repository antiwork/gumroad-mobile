import { FullAudioPlayer } from "@/components/full-audio-player";
import { LineIcon, SolidIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Text } from "@/components/ui/text";
import { withPlayerReady } from "@/components/use-audio-player-sync";
import { player } from "@/lib/audio-player";
import { useActiveTrack } from "@/lib/audio-player-hooks";
import { useAudioPlayerStatus } from "expo-audio";
import { useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";

const MiniAudioPlayerBase = () => {
  const status = useAudioPlayerStatus(player);
  const activeTrack = useActiveTrack();
  const [isFullPlayerVisible, setFullPlayerVisible] = useState(false);

  const isPlaying = status.playing;
  const isBuffering = status.isBuffering;
  const progress = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSkipForward = () => {
    const newPosition = Math.min(player.currentTime + 30, player.duration);
    player.seekTo(newPosition);
  };

  if (!activeTrack) {
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

export const MiniAudioPlayer = withPlayerReady(MiniAudioPlayerBase);
