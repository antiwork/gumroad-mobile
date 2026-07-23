import { LineIcon } from "@/components/icon";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useRefToLatest } from "@/components/use-ref-to-latest";
import { useAuth } from "@/lib/auth-context";
import { updateMediaLocation } from "@/lib/media-location";
import { requestAPI } from "@/lib/request";
import { activeCueText, parseSubtitles, type SubtitleCue } from "@/lib/subtitles";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView, type SubtitleTrack, type VideoPlayerStatus } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, FlatList, Pressable, StyleSheet, View } from "react-native";

type ExternalSubtitleTrack = {
  url: string;
  language: string;
};

type StreamResponse = {
  playlist_url: string;
  subtitles?: ExternalSubtitleTrack[];
};

const fetchStreamData = async (streamingUrl: string, accessToken: string): Promise<StreamResponse> =>
  requestAPI<StreamResponse>(streamingUrl, { accessToken });

const isReleasedPlayerError = (error: unknown): boolean => {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code === "ERR_USING_RELEASED_SHARED_OBJECT" || code === "ERR_NATIVE_SHARED_OBJECT_NOT_FOUND") return true;
  return /shared object that was already released|find the native shared object/i.test(message ?? "");
};

const withReleasedPlayerGuard = (operation: () => void) => {
  try {
    operation();
  } catch (error) {
    if (isReleasedPlayerError(error)) return;
    throw error;
  }
};

type CaptionSelection =
  | { type: "off" }
  | { type: "embedded"; track: SubtitleTrack }
  | { type: "external"; index: number };

// SubtitleTrack.id is Android-only, so fall back to the label + language pair to tell tracks apart on iOS.
const subtitleTrackKey = (track: SubtitleTrack): string => track.id ?? `${track.label}|${track.language}`;

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

  const queryClient = useQueryClient();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState(initialPosition ? Number(initialPosition) : 0);
  const currentPositionRef = useRefToLatest(currentPosition);

  const [externalTracks, setExternalTracks] = useState<ExternalSubtitleTrack[]>([]);
  const [embeddedTracks, setEmbeddedTracks] = useState<SubtitleTrack[]>([]);
  const [selection, setSelection] = useState<CaptionSelection>({ type: "off" });
  const [externalCues, setExternalCues] = useState<SubtitleCue[]>([]);
  const [currentCueText, setCurrentCueText] = useState<string | null>(null);
  const [captionSheetOpen, setCaptionSheetOpen] = useState(false);
  const cueCacheRef = useRef<Map<string, SubtitleCue[]>>(new Map());

  useEffect(() => {
    if (!accessToken) return;

    const resolveVideoUrl = async () => {
      setIsLoading(true);
      try {
        if (streamingUrl) {
          const streamData = await fetchStreamData(streamingUrl, accessToken);
          setVideoUrl(streamData.playlist_url);
          setExternalTracks(streamData.subtitles ?? []);
        } else {
          setVideoUrl(uri);
        }
      } catch (error) {
        console.warn("Failed to fetch streaming URL, falling back to direct URL:", error);
        Sentry.captureException(error);
        setVideoUrl(uri);
      } finally {
        setIsLoading(false);
      }
    };

    resolveVideoUrl();
  }, [accessToken, streamingUrl, uri]);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.staysActiveInBackground = false;
    player.timeUpdateEventInterval = 0.25;
    if (initialPosition) {
      player.currentTime = Number(initialPosition);
    }
    player.play();
  });

  const wasPlayingBeforeBackgroundRef = useRef(false);
  const positionBeforeBackgroundRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      withReleasedPlayerGuard(() => {
        if (nextState === "background" || nextState === "inactive") {
          wasPlayingBeforeBackgroundRef.current = player.playing;
          positionBeforeBackgroundRef.current = player.currentTime;
          player.pause();
        } else if (nextState === "active") {
          const savedPosition = positionBeforeBackgroundRef.current;
          if (savedPosition !== null && player.currentTime < savedPosition - 1) {
            player.currentTime = savedPosition;
          }
          positionBeforeBackgroundRef.current = null;
          if (wasPlayingBeforeBackgroundRef.current) {
            player.play();
            wasPlayingBeforeBackgroundRef.current = false;
          }
        }
      });
    });

    return () => subscription.remove();
  }, [player]);

  useEffect(() => () => withReleasedPlayerGuard(() => player.pause()), [player]);

  useEffect(() => {
    const subscription = player.addListener(
      "statusChange",
      ({ status, error }: { status: VideoPlayerStatus; error?: { message: string } }) => {
        if (status === "error") {
          setPlaybackError(error?.message ?? "Unknown playback error");
        } else if (status === "readyToPlay") {
          setPlaybackError(null);
          withReleasedPlayerGuard(() => setEmbeddedTracks(player.availableSubtitleTracks));
        }
      },
    );
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener(
      "availableSubtitleTracksChange",
      ({ availableSubtitleTracks }: { availableSubtitleTracks: SubtitleTrack[] }) => {
        setEmbeddedTracks(availableSubtitleTracks);
      },
    );
    return () => subscription.remove();
  }, [player]);

  // The native controls expose their own subtitle menu for embedded tracks. If the buyer enables
  // an embedded track there while an external track is displayed, drop the external overlay so the
  // two caption sources never render on top of each other.
  useEffect(() => {
    const subscription = player.addListener(
      "subtitleTrackChange",
      ({ subtitleTrack }: { subtitleTrack: SubtitleTrack | null }) => {
        if (subtitleTrack) {
          setSelection({ type: "embedded", track: subtitleTrack });
          setExternalCues([]);
          setCurrentCueText(null);
        }
      },
    );
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (externalCues.length === 0) {
      setCurrentCueText(null);
      return;
    }
    const subscription = player.addListener("timeUpdate", ({ currentTime }: { currentTime: number }) => {
      setCurrentCueText(activeCueText(externalCues, currentTime));
    });
    return () => subscription.remove();
  }, [player, externalCues]);

  useEffect(
    () => () => {
      if (!urlRedirectId || !productFileId) return;

      updateMediaLocation({
        urlRedirectId,
        productFileId,
        purchaseId,
        // We deliberately use the latest value of the ref for the latest media location

        location: currentPositionRef.current,
        accessToken,
      }).then(() => queryClient.invalidateQueries({ queryKey: ["purchase", urlRedirectId] }));
    },
    [urlRedirectId, productFileId, purchaseId, currentPositionRef, accessToken, queryClient],
  );

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
        accessToken,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [player, urlRedirectId, productFileId, purchaseId, accessToken]);

  const selectCaptionTrack = async (nextSelection: CaptionSelection) => {
    setCaptionSheetOpen(false);
    setSelection(nextSelection);

    if (nextSelection.type !== "external") {
      setExternalCues([]);
      setCurrentCueText(null);
      withReleasedPlayerGuard(() => {
        player.subtitleTrack = nextSelection.type === "embedded" ? nextSelection.track : null;
      });
      return;
    }

    withReleasedPlayerGuard(() => {
      player.subtitleTrack = null;
    });
    const track = externalTracks[nextSelection.index];
    if (!track) return;
    try {
      const cached = cueCacheRef.current.get(track.url);
      const cues = cached ?? parseSubtitles(await (await fetch(track.url)).text());
      cueCacheRef.current.set(track.url, cues);
      setExternalCues(cues);
      setCurrentCueText(activeCueText(cues, player.currentTime));
    } catch (error) {
      Sentry.captureException(error);
      setSelection({ type: "off" });
    }
  };

  const hasCaptionOptions = externalTracks.length > 0 || embeddedTracks.length > 0;

  if (isLoading || !videoUrl) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: title ?? "Video" }} />
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
        </View>
      </View>
    );
  }

  if (playbackError) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: title ?? "Video",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#fff",
          }}
        />
        <View style={styles.errorContainer}>
          <Text className="text-center text-lg font-semibold text-white">This video failed to load</Text>
          <Text className="mt-2 text-center text-sm text-white/70">
            Try downloading the file from the product page instead.
          </Text>
          <Text className="mt-4 text-center text-xs text-white/50">{playbackError}</Text>
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
          headerRight: hasCaptionOptions
            ? () => (
                <Pressable
                  onPress={() => setCaptionSheetOpen(true)}
                  accessibilityLabel="Captions"
                  testID="captions-button"
                  className="p-2"
                >
                  <LineIcon name="captions" size={24} className="text-white" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <VideoView
        style={styles.video}
        player={player}
        allowsPictureInPicture
        fullscreenOptions={{ enable: true, orientation: "landscape", autoExitOnRotate: true }}
      />
      {currentCueText ? (
        <View pointerEvents="none" style={styles.subtitleOverlay} testID="subtitle-overlay">
          <Text style={styles.subtitleText}>{currentCueText}</Text>
        </View>
      ) : null}
      <Sheet open={captionSheetOpen} onOpenChange={setCaptionSheetOpen}>
        <SheetHeader onClose={() => setCaptionSheetOpen(false)}>
          <SheetTitle>Captions</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={[
              { key: "off", label: "Off", isSelected: selection.type === "off", select: { type: "off" } as const },
              ...embeddedTracks.map((track, index) => ({
                key: `embedded-${index}`,
                label: track.label || track.language || "Embedded",
                isSelected:
                  selection.type === "embedded" && subtitleTrackKey(selection.track) === subtitleTrackKey(track),
                select: { type: "embedded", track } as const,
              })),
              ...externalTracks.map((track, index) => ({
                key: `external-${index}`,
                label: track.language || "Captions",
                isSelected: selection.type === "external" && selection.index === index,
                select: { type: "external", index } as const,
              })),
            ]}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => selectCaptionTrack(item.select)}
                className={cn("flex-row items-center justify-between px-4 py-3", item.isSelected && "bg-muted/20")}
              >
                <Text className={cn("flex-1", item.isSelected && "font-bold")}>{item.label}</Text>
                {item.isSelected ? <LineIcon name="check" size={20} className="text-foreground" /> : null}
              </Pressable>
            )}
          />
        </SheetContent>
      </Sheet>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  video: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  subtitleOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    alignItems: "center",
  },
  subtitleText: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: "center",
    overflow: "hidden",
    borderRadius: 4,
  },
});
