import TrackPlayer from "react-native-track-player";
import { playbackService } from "./components/track-player-service";

TrackPlayer.registerPlaybackService(() => playbackService);

// Register Android widget task handler
import "./components/revenue-widget-android-handler";

// Start the app after registering services (needs to be done before running any app code on Android)
// eslint-disable-next-line import/first
import "expo-router/entry";
