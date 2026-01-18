import TrackPlayer from "react-native-track-player";
import { playbackService } from "./components/track-player-service";

TrackPlayer.registerPlaybackService(() => playbackService);

// Start the app after registering the playback service (needs to be done before running any app code on Android)
// eslint-disable-next-line import/first
import "expo-router/entry";
