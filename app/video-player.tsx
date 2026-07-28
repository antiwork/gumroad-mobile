import { LineIcon } from "@/components/icon";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useRefToLatest } from "@/components/use-ref-to-latest";
import { useAuth } from "@/lib/auth-context";
import { updateMediaLocation } from "@/lib/media-location";
import { requestAPI } from "@/lib/request";
import { fetchSubtitleText } from "@/lib/subtitle-fetch";
import { activeCueText, parseSubtitles, type SubtitleCue } from "@/lib/subtitles";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useVideoPlayer, VideoView, type SubtitleTrack, type VideoPlayerStatus } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, FlatList, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const restoreAppOrientation = () => {
  const request =
    Platform.OS === "ios" && Platform.isPad
      ? ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  request.catch((error) => Sentry.captureException(error));
};

const prepareFullscreenOrientation = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "ios" && Platform.isPad) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    return true;
  } catch (error) {
    Sentry.captureException(error);
    return false;
  }
};

type CaptionSelection =
  | { type: "off" }
  | { type: "embedded"; track: SubtitleTrack }
  | { type: "external"; index: number };

type CaptionOption = {
  key: string;
  label: string;
  isSelected: boolean;
  select: CaptionSelection;
};

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
  const { top, bottom, left, right } = useSafeAreaInsets();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState(initialPosition ? Number(initialPosition) : 0);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const playbackStartedRef = useRef(false);
  const currentPositionRef = useRefToLatest(currentPosition);

  const [externalTracks, setExternalTracks] = useState<ExternalSubtitleTrack[]>([]);
  const [embeddedTracks, setEmbeddedTracks] = useState<SubtitleTrack[]>([]);
  const [selection, setSelection] = useState<CaptionSelection>({ type: "off" });
  const [externalCues, setExternalCues] = useState<SubtitleCue[]>([]);
  const [currentCueText, setCurrentCueText] = useState<string | null>(null);
  const [captionSheetOpen, setCaptionSheetOpen] = useState(false);
  const [externalFullscreenOpen, setExternalFullscreenOpen] = useState(false);
  const [fullscreenCaptionPickerOpen, setFullscreenCaptionPickerOpen] = useState(false);
  const [fullscreenTransitionPending, setFullscreenTransitionPending] = useState(false);
  const [pendingPlaybackError, setPendingPlaybackError] = useState<string | null>(null);
  const cueCacheRef = useRef<Map<string, SubtitleCue[]>>(new Map());
  const captionRequestIdRef = useRef(0);
  const captionAbortControllerRef = useRef<AbortController | null>(null);
  const fullscreenRequestIdRef = useRef(0);
  const fullscreenOrientationActiveRef = useRef(false);
  const fullscreenTransitionPendingRef = useRef(false);
  const mountedRef = useRef(true);
  const selectionRef = useRef<CaptionSelection>({ type: "off" });

  const cancelCaptionRequest = useCallback(() => {
    captionRequestIdRef.current += 1;
    captionAbortControllerRef.current?.abort();
    captionAbortControllerRef.current = null;
    return captionRequestIdRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fullscreenRequestIdRef.current += 1;
      fullscreenOrientationActiveRef.current = false;
      fullscreenTransitionPendingRef.current = false;
      cancelCaptionRequest();
      restoreAppOrientation();
    };
  }, [cancelCaptionRequest]);

  useEffect(() => {
    let cancelled = false;
    const offSelection = { type: "off" } as const;
    cancelCaptionRequest();
    fullscreenRequestIdRef.current += 1;
    if (Platform.OS !== "ios" && fullscreenOrientationActiveRef.current) {
      fullscreenOrientationActiveRef.current = false;
      fullscreenTransitionPendingRef.current = false;
      setFullscreenTransitionPending(false);
      restoreAppOrientation();
    } else if (Platform.OS === "ios" && fullscreenOrientationActiveRef.current) {
      fullscreenTransitionPendingRef.current = true;
      setFullscreenTransitionPending(true);
    }
    selectionRef.current = offSelection;
    setSelection(offSelection);
    setExternalTracks([]);
    setEmbeddedTracks([]);
    setExternalCues([]);
    setCurrentCueText(null);
    setCaptionSheetOpen(false);
    setExternalFullscreenOpen(false);
    setFullscreenCaptionPickerOpen(false);
    setPendingPlaybackError(null);

    const resolveVideoUrl = async () => {
      if (!accessToken) return;
      setIsLoading(true);
      try {
        if (streamingUrl) {
          const streamData = await fetchStreamData(streamingUrl, accessToken);
          if (cancelled) return;
          setVideoUrl(streamData.playlist_url);
          setExternalTracks(streamData.subtitles ?? []);
        } else {
          setVideoUrl(uri);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("Failed to fetch streaming URL, falling back to direct URL:", error);
        Sentry.captureException(error);
        setVideoUrl(uri);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    resolveVideoUrl();

    return () => {
      cancelled = true;
      cancelCaptionRequest();
    };
  }, [accessToken, cancelCaptionRequest, streamingUrl, uri]);

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
          fullscreenRequestIdRef.current += 1;
          setFullscreenCaptionPickerOpen(false);
          setExternalFullscreenOpen(false);
          const message = error?.message ?? "Unknown playback error";
          if (externalFullscreenOpen && Platform.OS === "ios") {
            fullscreenTransitionPendingRef.current = true;
            setFullscreenTransitionPending(true);
            setPendingPlaybackError(message);
          } else {
            if (fullscreenOrientationActiveRef.current) {
              fullscreenOrientationActiveRef.current = false;
              fullscreenTransitionPendingRef.current = false;
              setFullscreenTransitionPending(false);
              restoreAppOrientation();
            }
            setPlaybackError(message);
          }
        } else if (status === "readyToPlay") {
          setPlaybackError(null);
          withReleasedPlayerGuard(() => {
            setEmbeddedTracks(player.availableSubtitleTracks);
            const subtitleTrack = player.subtitleTrack;
            if (subtitleTrack && selectionRef.current.type !== "external") {
              const embeddedSelection = { type: "embedded", track: subtitleTrack } as const;
              cancelCaptionRequest();
              selectionRef.current = embeddedSelection;
              setSelection(embeddedSelection);
              setExternalCues([]);
              setCurrentCueText(null);
            }
          });
        }
      },
    );
    return () => subscription.remove();
  }, [cancelCaptionRequest, externalFullscreenOpen, player]);

  useEffect(() => {
    const subscription = player.addListener(
      "availableSubtitleTracksChange",
      ({ availableSubtitleTracks }: { availableSubtitleTracks: SubtitleTrack[] }) => {
        setEmbeddedTracks(availableSubtitleTracks);
      },
    );
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener(
      "subtitleTrackChange",
      ({ subtitleTrack }: { subtitleTrack: SubtitleTrack | null }) => {
        if (subtitleTrack) {
          const embeddedSelection = { type: "embedded", track: subtitleTrack } as const;
          cancelCaptionRequest();
          selectionRef.current = embeddedSelection;
          setSelection(embeddedSelection);
          setExternalCues([]);
          setCurrentCueText(null);
        } else if (selectionRef.current.type !== "external") {
          const offSelection = { type: "off" } as const;
          cancelCaptionRequest();
          selectionRef.current = offSelection;
          setSelection(offSelection);
          setExternalCues([]);
          setCurrentCueText(null);
        }
      },
    );
    return () => subscription.remove();
  }, [cancelCaptionRequest, player]);

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

  useEffect(() => {
    const startingPosition = initialPosition ? Number(initialPosition) : 0;
    const subscription = player.addListener("timeUpdate", ({ currentTime }: { currentTime: number }) => {
      if (!playbackStartedRef.current && currentTime > startingPosition + 0.1) {
        playbackStartedRef.current = true;
        setPlaybackStarted(true);
      }
    });
    return () => subscription.remove();
  }, [initialPosition, player]);

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
    setFullscreenCaptionPickerOpen(false);
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    const requestId = cancelCaptionRequest();

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
    setExternalCues([]);
    setCurrentCueText(null);
    const track = externalTracks[nextSelection.index];
    if (!track) return;
    try {
      let cues = cueCacheRef.current.get(track.url);
      if (!cues) {
        const controller = new AbortController();
        captionAbortControllerRef.current = controller;
        try {
          cues = parseSubtitles(await fetchSubtitleText(track.url, { signal: controller.signal }));
        } finally {
          if (captionAbortControllerRef.current === controller) captionAbortControllerRef.current = null;
        }
        if (cues.length === 0) throw new Error("Subtitle track contains no valid cues");
        cueCacheRef.current.set(track.url, cues);
      }
      if (captionRequestIdRef.current !== requestId) return;
      setExternalCues(cues);
      setCurrentCueText(activeCueText(cues, player.currentTime));
    } catch (error) {
      if (captionRequestIdRef.current !== requestId) return;
      Sentry.captureException(error);
      const offSelection = { type: "off" } as const;
      selectionRef.current = offSelection;
      setSelection(offSelection);
    }
  };

  const hasCaptionOptions = externalTracks.length > 0 || embeddedTracks.length > 0;
  const externalCaptionSelected = selection.type === "external";
  const captionOptions: CaptionOption[] = [
    { key: "off", label: "Off", isSelected: selection.type === "off", select: { type: "off" } },
    ...embeddedTracks.map((track, index) => ({
      key: `embedded-${index}`,
      label: track.label || track.language || "Embedded",
      isSelected: selection.type === "embedded" && subtitleTrackKey(selection.track) === subtitleTrackKey(track),
      select: { type: "embedded", track } as const,
    })),
    ...externalTracks.map((track, index) => ({
      key: `external-${index}`,
      label: track.language || "Captions",
      isSelected: selection.type === "external" && selection.index === index,
      select: { type: "external", index } as const,
    })),
  ];

  const renderCaptionOption = ({ item }: { item: CaptionOption }, fullscreen = false) => (
    <Pressable
      onPress={() => selectCaptionTrack(item.select)}
      accessibilityRole="radio"
      accessibilityState={{ checked: item.isSelected }}
      className={cn(
        "flex-row items-center justify-between px-4 py-3",
        item.isSelected && (fullscreen ? "bg-white/10" : "bg-muted/20"),
      )}
    >
      <Text className={cn("flex-1", fullscreen && "text-white", item.isSelected && "font-bold")}>{item.label}</Text>
      {item.isSelected ? (
        <LineIcon name="check" size={20} className={fullscreen ? "text-white" : "text-foreground"} />
      ) : null}
    </Pressable>
  );

  const enterExternalFullscreen = async () => {
    if (fullscreenTransitionPendingRef.current) return;
    fullscreenTransitionPendingRef.current = true;
    setFullscreenTransitionPending(true);
    const requestId = ++fullscreenRequestIdRef.current;
    const orientationApplied = await prepareFullscreenOrientation();
    if (!mountedRef.current || fullscreenRequestIdRef.current !== requestId) {
      if (orientationApplied) restoreAppOrientation();
      if (mountedRef.current) {
        fullscreenTransitionPendingRef.current = false;
        setFullscreenTransitionPending(false);
      }
      return;
    }
    fullscreenOrientationActiveRef.current = orientationApplied;
    setExternalFullscreenOpen(true);
    fullscreenTransitionPendingRef.current = false;
    setFullscreenTransitionPending(false);
  };

  const exitExternalFullscreen = () => {
    fullscreenRequestIdRef.current += 1;
    setFullscreenCaptionPickerOpen(false);
    setExternalFullscreenOpen(false);
    if (Platform.OS === "ios") {
      fullscreenTransitionPendingRef.current = true;
      setFullscreenTransitionPending(true);
    } else {
      fullscreenOrientationActiveRef.current = false;
      fullscreenTransitionPendingRef.current = false;
      setFullscreenTransitionPending(false);
      restoreAppOrientation();
    }
  };

  const handleExternalFullscreenDismiss = () => {
    fullscreenOrientationActiveRef.current = false;
    fullscreenTransitionPendingRef.current = false;
    setFullscreenTransitionPending(false);
    restoreAppOrientation();
    if (pendingPlaybackError) {
      setPlaybackError(pendingPlaybackError);
      setPendingPlaybackError(null);
    }
  };

  const handleNativeFullscreenEnter = async () => {
    const requestId = ++fullscreenRequestIdRef.current;
    const orientationApplied = await prepareFullscreenOrientation();
    if (!mountedRef.current || fullscreenRequestIdRef.current !== requestId) {
      if (orientationApplied) restoreAppOrientation();
      return;
    }
    fullscreenOrientationActiveRef.current = orientationApplied;
  };

  const handleNativeFullscreenExit = () => {
    fullscreenRequestIdRef.current += 1;
    fullscreenOrientationActiveRef.current = false;
    fullscreenTransitionPendingRef.current = false;
    setFullscreenTransitionPending(false);
    restoreAppOrientation();
  };

  const videoSurfaceType = externalTracks.length > 0 ? "textureView" : "surfaceView";
  const renderVideoSurface = (fullscreen: boolean) => (
    <View style={styles.videoSurface}>
      <VideoView
        key={videoSurfaceType}
        testID={fullscreen ? "fullscreen-video-player" : "video-player"}
        accessibilityLabel={playbackStarted ? "Video playback started" : "Video playback waiting"}
        style={styles.video}
        player={player}
        allowsPictureInPicture={!externalCaptionSelected}
        surfaceType={videoSurfaceType}
        onFullscreenEnter={handleNativeFullscreenEnter}
        onFullscreenExit={handleNativeFullscreenExit}
        fullscreenOptions={{
          enable: !externalCaptionSelected && !fullscreen,
          orientation: "landscape",
          autoExitOnRotate: true,
        }}
      />
      {currentCueText ? (
        <View
          pointerEvents="none"
          style={[
            styles.subtitleOverlay,
            fullscreen
              ? {
                  left: left + 16,
                  right: right + 16,
                  bottom: bottom + 96,
                }
              : undefined,
          ]}
          testID="subtitle-overlay"
        >
          <Text style={styles.subtitleText}>{currentCueText}</Text>
        </View>
      ) : null}
      {fullscreen ? (
        <View
          style={[
            styles.fullscreenHeader,
            {
              top: top + 12,
              left: left + 12,
              right: right + 12,
            },
          ]}
          testID="fullscreen-header"
        >
          <Pressable
            onPress={exitExternalFullscreen}
            accessibilityRole="button"
            accessibilityLabel="Exit fullscreen"
            style={styles.fullscreenAction}
          >
            <LineIcon name="fullscreen-exit" size={24} className="text-white" />
          </Pressable>
          {hasCaptionOptions ? (
            <Pressable
              onPress={() => setFullscreenCaptionPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Captions"
              testID="fullscreen-captions-button"
              style={styles.fullscreenAction}
            >
              <LineIcon name="captions" size={24} className="text-white" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {fullscreen && fullscreenCaptionPickerOpen ? (
        <View
          style={[
            styles.fullscreenCaptionPicker,
            {
              paddingTop: top + 24,
              paddingBottom: bottom + 24,
              paddingLeft: left + 24,
              paddingRight: right + 24,
            },
          ]}
          testID="fullscreen-caption-picker"
        >
          <View style={styles.fullscreenCaptionPanel}>
            <View style={styles.fullscreenCaptionHeader}>
              <Text style={styles.fullscreenCaptionTitle}>Captions</Text>
              <Pressable
                onPress={() => setFullscreenCaptionPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close captions"
                style={styles.fullscreenCaptionClose}
              >
                <LineIcon name="x" size={24} className="text-white" />
              </Pressable>
            </View>
            <FlatList
              data={captionOptions}
              keyExtractor={(item) => item.key}
              renderItem={(item) => renderCaptionOption(item, true)}
              style={styles.fullscreenCaptionList}
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  const externalFullscreenModal = (
    <Modal
      visible={externalFullscreenOpen}
      testID="external-caption-fullscreen"
      animationType="fade"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
      onRequestClose={exitExternalFullscreen}
      onDismiss={handleExternalFullscreenDismiss}
    >
      <View style={styles.container}>{renderVideoSurface(true)}</View>
    </Modal>
  );

  if (isLoading || !videoUrl) {
    return (
      <>
        <View style={styles.container}>
          <Stack.Screen options={{ title: title ?? "Video" }} />
          <View style={styles.loadingContainer}>
            <LoadingSpinner size="large" />
          </View>
        </View>
        {externalFullscreenModal}
      </>
    );
  }

  if (playbackError) {
    return (
      <>
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
        {externalFullscreenModal}
      </>
    );
  }

  return (
    <>
      <View style={[styles.container, { paddingBottom: bottom }]} testID="video-player-container">
        <Stack.Screen
          options={{
            title: title ?? "Video",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#fff",
            headerRight: hasCaptionOptions
              ? () => (
                  <View className="flex-row items-center">
                    {externalCaptionSelected ? (
                      <Pressable
                        onPress={enterExternalFullscreen}
                        disabled={fullscreenTransitionPending}
                        accessibilityRole="button"
                        accessibilityLabel="Enter fullscreen"
                        accessibilityState={{ disabled: fullscreenTransitionPending }}
                        testID="enter-fullscreen-button"
                        className="p-2"
                      >
                        <LineIcon name="fullscreen" size={24} className="text-white" />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => setCaptionSheetOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Captions"
                      testID="captions-button"
                      className="p-2"
                    >
                      <LineIcon name="captions" size={24} className="text-white" />
                    </Pressable>
                  </View>
                )
              : undefined,
          }}
        />
        {externalFullscreenOpen ? null : renderVideoSurface(false)}
        <Sheet open={captionSheetOpen} onOpenChange={setCaptionSheetOpen}>
          <SheetHeader onClose={() => setCaptionSheetOpen(false)}>
            <SheetTitle>Captions</SheetTitle>
          </SheetHeader>
          <SheetContent>
            <FlatList data={captionOptions} keyExtractor={(item) => item.key} renderItem={renderCaptionOption} />
          </SheetContent>
        </Sheet>
      </View>
      {externalFullscreenModal}
    </>
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
  videoSurface: {
    flex: 1,
  },
  fullscreenHeader: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fullscreenAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCaptionPicker: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCaptionPanel: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#1c1c1e",
  },
  fullscreenCaptionHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
    paddingLeft: 16,
    paddingRight: 6,
  },
  fullscreenCaptionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  fullscreenCaptionClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCaptionList: {
    flexGrow: 0,
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
