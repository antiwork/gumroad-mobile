type UploadedFile = { created_at?: string };

const uploadTime = (file: UploadedFile) => {
  const parsed = file.created_at ? Date.parse(file.created_at) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

// A purchase page lists audio files in the seller's layout: for an album or a course that layout is
// the running order and playback follows it. A catalog that opens with several newest-first files is
// a feed (a podcast listing), so playback follows upload time instead. One newer file at the top is a
// replaced track, not a feed.
const FEED_HEAD_RUN = 3;

const opensAsFeed = (files: UploadedFile[]) => {
  if (files.length < FEED_HEAD_RUN) return false;

  for (let index = 1; index < FEED_HEAD_RUN; index += 1) {
    if (uploadTime(files[index - 1]) <= uploadTime(files[index])) return false;
  }

  return true;
};

export const orderAudioFilesForPlayback = <T extends UploadedFile>(files: T[]): T[] => {
  if (!opensAsFeed(files)) return files;

  return [...files].sort((a, b) => uploadTime(a) - uploadTime(b));
};
