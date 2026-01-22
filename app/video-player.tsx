import { useRefToLatest } from "@/components/use-ref-to-latest";
import { useAuth } from "@/lib/auth-context";
import { updateMediaLocation } from "@/lib/media-location";
import { requestAPI } from "@/lib/request";
import { Stack, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const fetchStreamingPlaylistUrl = async (streamingUrl: string, accessToken: string): Promise<string> =>
  (await requestAPI<{ playlist_url: string }>(streamingUrl, { accessToken })).playlist_url;

export default function VideoPlayerScreen() {
  const { accessToken } = useAuth();
  const { uri, streamingUrl, title, urlRedirectId, productFileId, purchaseId, initialPosition } = useLocalSearchParams<{
    uri: string;
    streamingUrl?: string;
    title?: string;
    urlRedirectId?: string;
    productFileId?: string;
    purchaseId?: string;
    initialPosition?: string;
  }>();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(initialPosition ? Number(initialPosition) : 0);
  const currentPositionRef = useRefToLatest(currentPosition);

  useEffect(() => {
    if (!accessToken) return;

    const resolveVideoUrl = async () => {
      setIsLoading(true);
      try {
        if (streamingUrl) {
          const playlistUrl = await fetchStreamingPlaylistUrl(streamingUrl, accessToken);
          setVideoUrl(playlistUrl);
        } else {
          setVideoUrl(uri);
        }
      } catch (error) {
        console.warn("Failed to fetch streaming URL, falling back to direct URL:", error);
        setVideoUrl(uri);
      } finally {
        setIsLoading(false);
      }
    };

    resolveVideoUrl();
  }, [accessToken, streamingUrl, uri]);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    if (initialPosition) {
      player.currentTime = Number(initialPosition);
    }
    player.play();
  });

  useEffect(() => {
    return () => {
      if (!urlRedirectId || !productFileId) return;

      updateMediaLocation({
        urlRedirectId,
        productFileId,
        purchaseId,
        // We deliberately use the latest value of the ref for the latest media location
        // eslint-disable-next-line react-hooks/exhaustive-deps
        location: currentPositionRef.current,
      });
    };
  }, [urlRedirectId, productFileId, purchaseId, currentPositionRef]);

  useEffect(() => {
    if (!player || !urlRedirectId || !productFileId) return;

    const interval = setInterval(() => {
      const position = player.currentTime;
      setCurrentPosition(position);

      updateMediaLocation({
        urlRedirectId,
        productFileId,
        purchaseId,
        location: position,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [player, urlRedirectId, productFileId, purchaseId]);

  if (isLoading || !videoUrl) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: title ?? "Video" }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff90e8" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: title ?? "Video",
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
        }}
      />
      <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
