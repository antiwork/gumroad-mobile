import { LineIcon } from "@/components/icon";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useRefToLatest } from "@/components/use-ref-to-latest";
import { useAuth } from "@/lib/auth-context";
import { formatTime } from "@/lib/format-time";
import { isMeaningfulLocation, isResumableLocation, updateMediaLocation } from "@/lib/media-location";
import { requestAPI } from "@/lib/request";
import { fetchSubtitleText, SubtitleFetchError } from "@/lib/subtitle-fetch";
import { isTransientPlaybackError, MAX_TRANSIENT_PLAYBACK_RETRIES } from "@/lib/transient-playback-error";
import { activeCueText, parseSubtitles, type SubtitleCue } from "@/lib/subtitles";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { useVideoPlayer, VideoView, type SubtitleTrack, type VideoPlayerStatus } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
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

const hideFullscreenSystemBars = async (): Promise<boolean> => {
  try {
    StatusBar.setHidden(true, "fade");
    if (Platform.OS === "android") await NavigationBar.setVisibilityAsync("hidden");
    return true;
  } catch (error) {
    StatusBar.setHidden(false, "fade");
    Sentry.captureException(error);
    return false;
  }
};

const restoreFullscreenSystemBars = () => {
  StatusBar.setHidden(false, "fade");
  if (Platform.OS === "android") {
    NavigationBar.setVisibilityAsync("visible").catch((error) => Sentry.captureException(error));
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
  const { uri, streamingUrl, title, urlRedirectId, productFileId, purchaseId, initialPosition, contentLength } =
    useLocalSearchParams<{
      uri: string;
      streamingUrl?: string;
      title?: string;
      urlRedirectId?: string;
      productFileId?: string;
      purchaseId?: string;
      initialPosition?: string;
      contentLength?: string;
    }>();

  const videoLength = contentLength ? Number(contentLength) : undefined;
  const savedPosition = initialPosition ? Number(initialPosition) : undefined;
  // A saved position at or past the end means the buyer finished the video. Seeking there stops
  // playback instantly, which reads as "the video won't play", so those restart from the start.
  // content_length is not serialised for every file, so the loaded duration is the second chance
  // to notice it, hence the state rather than a plain derivation.
  const [savedPositionIsAtEnd, setSavedPositionIsAtEnd] = useState(
    savedPosition !== undefined && !isResumableLocation(savedPosition, videoLength),
  );
  const resumePosition = savedPositionIsAtEnd ? 0 : (savedPosition ?? 0);

  const queryClient = useQueryClient();
  const { top, bottom, left, right } = useSafeAreaInsets();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState(resumePosition);
  const [videoDuration, setVideoDuration] = useState(videoLength ?? 0);
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
  const mediaIdentityRef = useRef<{ streamingUrl?: string; uri: string } | null>(null);
  const resolvedMediaIdentityRef = useRef<{ streamingUrl?: string; uri: string } | null>(null);
  const fallbackMediaIdentityRef = useRef<{ streamingUrl?: string; uri: string } | null>(null);
  const playerRef = useRef<ReturnType<typeof useVideoPlayer> | null>(null);
  const videoDurationRef = useRefToLatest(videoDuration);
  const pendingSourceResumeRef = useRef<{ position: number; wasPlaying: boolean } | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const playbackRetryCountRef = useRef(0);

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
      restoreFullscreenSystemBars();
      restoreAppOrientation();
    };
  }, [cancelCaptionRequest]);

  useEffect(() => {
    let cancelled = false;
    const previousMedia = mediaIdentityRef.current;
    const mediaChanged = previousMedia?.uri !== uri || previousMedia.streamingUrl !== streamingUrl;
    mediaIdentityRef.current = { uri, streamingUrl };

    if (mediaChanged) {
      const offSelection = { type: "off" } as const;
      fallbackMediaIdentityRef.current = null;
      pendingSourceResumeRef.current = null;
      const nextPositionIsAtEnd = savedPosition !== undefined && !isResumableLocation(savedPosition, videoLength);
      setSavedPositionIsAtEnd(nextPositionIsAtEnd);
      // Progress state belongs to one video. Carrying it into the next one shows the previous
      // video's position on screen and, worse, lets a save write that position against the new
      // video's duration, so the replacement video reopens at the wrong place.
      setCurrentPosition(nextPositionIsAtEnd ? 0 : (savedPosition ?? 0));
      setVideoDuration(videoLength ?? 0);
      playbackStartedRef.current = false;
      setPlaybackStarted(false);
      playbackRetryCountRef.current = 0;
      cancelCaptionRequest();
      fullscreenRequestIdRef.current += 1;
      if (Platform.OS !== "ios" && fullscreenOrientationActiveRef.current) {
        fullscreenOrientationActiveRef.current = false;
        fullscreenTransitionPendingRef.current = false;
        setFullscreenTransitionPending(false);
        restoreFullscreenSystemBars();
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
    }

    const resolvedMedia = resolvedMediaIdentityRef.current;
    if (!mediaChanged && resolvedMedia?.uri === uri && resolvedMedia.streamingUrl === streamingUrl) return;

    const resolveVideoUrl = async () => {
      if (!accessToken) return;
      const fallbackMedia = fallbackMediaIdentityRef.current;
      const upgradingFallback = fallbackMedia?.uri === uri && fallbackMedia.streamingUrl === streamingUrl;
      if (!upgradingFallback) setIsLoading(true);
      try {
        if (streamingUrl) {
          const streamData = await fetchStreamData(streamingUrl, accessToken);
          if (cancelled) return;
          if (upgradingFallback && streamData.playlist_url !== uri) {
            const activePlayer = playerRef.current;
            if (activePlayer) {
              withReleasedPlayerGuard(() => {
                pendingSourceResumeRef.current = {
                  position: activePlayer.currentTime,
                  wasPlaying: activePlayer.playing,
                };
              });
            }
          }
          resolvedMediaIdentityRef.current = { uri, streamingUrl };
          fallbackMediaIdentityRef.current = null;
          setVideoUrl(streamData.playlist_url);
          setExternalTracks(streamData.subtitles ?? []);
        } else {
          resolvedMediaIdentityRef.current = { uri, streamingUrl };
          fallbackMediaIdentityRef.current = null;
          setVideoUrl(uri);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("Failed to fetch streaming URL, falling back to direct URL:", error);
        Sentry.captureException(error);
        fallbackMediaIdentityRef.current = { uri, streamingUrl };
        setVideoUrl(uri);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    resolveVideoUrl();

    return () => {
      cancelled = true;
    };
  }, [accessToken, cancelCaptionRequest, streamingUrl, uri]);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.allowsExternalPlayback = true;
    player.staysActiveInBackground = Platform.OS === "ios";
    player.timeUpdateEventInterval = 0.25;
    const pendingResume = pendingSourceResumeRef.current;
    pendingSourceResumeRef.current = null;
    if (pendingResume) {
      player.currentTime = pendingResume.position;
    } else if (resumePosition) {
      player.currentTime = resumePosition;
    }
    if (pendingResume && !pendingResume.wasPlaying) {
      player.pause();
    } else {
      player.play();
    }
  });
  playerRef.current = player;
  videoUrlRef.current = videoUrl;

  const replayFromLastPosition = useCallback(() => {
    const position = Math.max(currentPositionRef.current, player.currentTime || 0);
    pendingSourceResumeRef.current = { position, wasPlaying: true };
    withReleasedPlayerGuard(() => {
      const source = videoUrlRef.current;
      const replaceable = player as { replace?: (source: string) => void };
      if (source) replaceable.replace?.(source);
      player.currentTime = position;
      player.play();
    });
  }, [currentPositionRef, player]);

  const wasPlayingBeforeBackgroundRef = useRef(false);
  const positionBeforeBackgroundRef = useRef<number | null>(null);

  useEffect(() => {
    // Scoped to Android: iOS already gets background playback via staysActiveInBackground
    // above; the media3 background session ANRs on Android (see PR #215).
    if (Platform.OS !== "android") return;

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
    withReleasedPlayerGuard(() => {
      player.allowsExternalPlayback = selection.type !== "external";
    });
  }, [player, selection.type]);

  useEffect(() => {
    const subscription = player.addListener(
      "statusChange",
      ({ status, error }: { status: VideoPlayerStatus; error?: { message: string } }) => {
        if (status === "error") {
          const message = error?.message ?? "Unknown playback error";
          if (isTransientPlaybackError(message) && playbackRetryCountRef.current < MAX_TRANSIENT_PLAYBACK_RETRIES) {
            playbackRetryCountRef.current += 1;
            replayFromLastPosition();
            return;
          }
          fullscreenRequestIdRef.current += 1;
          setFullscreenCaptionPickerOpen(false);
          setExternalFullscreenOpen(false);
          if (externalFullscreenOpen && Platform.OS === "ios") {
            fullscreenTransitionPendingRef.current = true;
            setFullscreenTransitionPending(true);
            setPendingPlaybackError(message);
          } else {
            if (fullscreenOrientationActiveRef.current) {
              fullscreenOrientationActiveRef.current = false;
              fullscreenTransitionPendingRef.current = false;
              setFullscreenTransitionPending(false);
              restoreFullscreenSystemBars();
              restoreAppOrientation();
            }
            setPlaybackError(message);
          }
        } else if (status === "readyToPlay") {
          setPlaybackError(null);
          withReleasedPlayerGuard(() => {
            setVideoDuration(player.duration || videoDurationRef.current);
            // readyToPlay fires again after every seek and rebuffer, so this must not re-run once
            // handled or a buyer rewatching a finished video gets yanked back to the start.
            if (!savedPositionIsAtEnd && savedPosition && !isResumableLocation(savedPosition, player.duration)) {
              setSavedPositionIsAtEnd(true);
              player.currentTime = 0;
              setCurrentPosition(0);
            }
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
  }, [
    cancelCaptionRequest,
    externalFullscreenOpen,
    player,
    replayFromLastPosition,
    savedPosition,
    savedPositionIsAtEnd,
    videoDurationRef,
  ]);

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
    const subscription = player.addListener("timeUpdate", ({ currentTime }: { currentTime: number }) => {
      if (!playbackStartedRef.current && currentTime > resumePosition + 0.1) {
        playbackStartedRef.current = true;
        setPlaybackStarted(true);
      }
    });
    return () => subscription.remove();
  }, [resumePosition, player]);

  const loadedMediaMatchesParams = useCallback(() => {
    const loadedMedia = resolvedMediaIdentityRef.current ?? fallbackMediaIdentityRef.current;
    return loadedMedia?.uri === uri && loadedMedia.streamingUrl === streamingUrl;
  }, [streamingUrl, uri]);

  const persistLocation = useCallback(
    (position: number, duration: number) => {
      if (!urlRedirectId || !productFileId) return null;

      // While the screen is switching to another video the player still holds the previous
      // source, so anything read off it now would be saved against the new video's file.
      if (!loadedMediaMatchesParams()) return null;

      const isEnd = duration > 0 && position >= duration - 0.5;
      // Below the threshold the position is indistinguishable from a player sitting at the
      // start, so saving it would overwrite the position the buyer actually reached.
      if (!isMeaningfulLocation(position, isEnd)) return null;

      return updateMediaLocation({
        urlRedirectId,
        productFileId,
        purchaseId,
        location: isEnd ? duration : position,
        accessToken,
      });
    },
    [urlRedirectId, productFileId, purchaseId, accessToken, loadedMediaMatchesParams],
  );

  const persistLocationRef = useRefToLatest(persistLocation);

  useEffect(
    () => () => {
      if (!urlRedirectId) return;
      persistLocationRef
        .current(currentPositionRef.current, videoDurationRef.current)
        ?.then(() => queryClient.invalidateQueries({ queryKey: ["purchase", urlRedirectId] }));
    },
    [urlRedirectId, currentPositionRef, videoDurationRef, persistLocationRef, queryClient],
  );

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      withReleasedPlayerGuard(() => {
        if (!loadedMediaMatchesParams()) return;
        const position = player.currentTime;
        const duration = player.duration || videoDurationRef.current;
        setCurrentPosition(position);
        setVideoDuration(duration);
        persistLocation(position, duration);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [player, persistLocation, videoDurationRef, loadedMediaMatchesParams]);

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
    let track = externalTracks[nextSelection.index];
    if (!track) return;

    const loadCues = async (subtitleTrack: ExternalSubtitleTrack) => {
      const cachedCues = cueCacheRef.current.get(subtitleTrack.url);
      if (cachedCues) return cachedCues;

      const controller = new AbortController();
      captionAbortControllerRef.current = controller;
      try {
        const parsedCues = parseSubtitles(await fetchSubtitleText(subtitleTrack.url, { signal: controller.signal }));
        if (parsedCues.length === 0) throw new Error("Subtitle track contains no valid cues");
        cueCacheRef.current.set(subtitleTrack.url, parsedCues);
        return parsedCues;
      } finally {
        if (captionAbortControllerRef.current === controller) captionAbortControllerRef.current = null;
      }
    };

    try {
      let cues: SubtitleCue[];
      try {
        cues = await loadCues(track);
      } catch (error) {
        if (
          !(error instanceof SubtitleFetchError) ||
          (error.status !== 401 && error.status !== 403) ||
          !streamingUrl ||
          !accessToken
        ) {
          throw error;
        }

        const refreshedStream = await fetchStreamData(streamingUrl, accessToken);
        if (captionRequestIdRef.current !== requestId) return;
        const refreshedTracks = refreshedStream.subtitles ?? [];
        track = refreshedTracks[nextSelection.index];
        if (!track) throw error;
        setExternalTracks(refreshedTracks);
        cues = await loadCues(track);
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
    const systemBarsHidden = orientationApplied ? await hideFullscreenSystemBars() : false;
    if (!mountedRef.current || fullscreenRequestIdRef.current !== requestId) {
      if (orientationApplied) restoreAppOrientation();
      if (systemBarsHidden) restoreFullscreenSystemBars();
      if (mountedRef.current) {
        fullscreenTransitionPendingRef.current = false;
        setFullscreenTransitionPending(false);
      }
      return;
    }
    if (!orientationApplied || !systemBarsHidden) {
      if (orientationApplied) restoreAppOrientation();
      fullscreenTransitionPendingRef.current = false;
      setFullscreenTransitionPending(false);
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
      restoreFullscreenSystemBars();
      restoreAppOrientation();
    }
  };

  const handleExternalFullscreenDismiss = () => {
    fullscreenOrientationActiveRef.current = false;
    fullscreenTransitionPendingRef.current = false;
    setFullscreenTransitionPending(false);
    restoreFullscreenSystemBars();
    restoreAppOrientation();
    if (pendingPlaybackError) {
      setPlaybackError(pendingPlaybackError);
      setPendingPlaybackError(null);
    }
  };

  const handleNativeFullscreenEnter = async () => {
    const requestId = ++fullscreenRequestIdRef.current;
    const orientationApplied = await prepareFullscreenOrientation();
    const barsHidden = await hideFullscreenSystemBars();
    if (!mountedRef.current || fullscreenRequestIdRef.current !== requestId) {
      if (orientationApplied) restoreAppOrientation();
      if (barsHidden) restoreFullscreenSystemBars();
      return;
    }
    fullscreenOrientationActiveRef.current = orientationApplied;
  };

  const handleNativeFullscreenExit = () => {
    fullscreenRequestIdRef.current += 1;
    fullscreenOrientationActiveRef.current = false;
    fullscreenTransitionPendingRef.current = false;
    setFullscreenTransitionPending(false);
    restoreFullscreenSystemBars();
    restoreAppOrientation();
  };

  const videoSurfaceType = externalTracks.length > 0 ? "textureView" : "surfaceView";
  const renderVideoSurface = (fullscreen: boolean) => (
    <View style={styles.videoSurface}>
      <VideoView
        key={videoSurfaceType}
        testID={fullscreen ? "fullscreen-video-player" : "video-player"}
        accessibilityLabel={playbackStarted ? "Video playback started" : "Video playback waiting"}
        accessibilityValue={{ text: `${formatTime(currentPosition)} of ${formatTime(videoDuration)}` }}
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
              Try again, or download the file from the product page instead.
            </Text>
            <Pressable
              onPress={() => {
                playbackRetryCountRef.current = 0;
                setPlaybackError(null);
                replayFromLastPosition();
              }}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              testID="retry-playback-button"
              className="mt-6 rounded-full bg-white px-5 py-3"
            >
              <Text className="text-center text-sm font-semibold text-black">Try again</Text>
            </Pressable>
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
