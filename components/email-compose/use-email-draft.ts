import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type { Attachment } from "./compose-context";

const STORAGE_KEY = "email-compose-draft-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type Draft = {
  title: string;
  html: string;
  audienceType: string;
  idempotencyKey: string;
  attachments?: Attachment[];
  sendEmails?: boolean;
  shownOnProfile?: boolean;
  allowComments?: boolean;
  savedAt: string;
};

type StoredDraft = Draft & {
  // Legacy: Wave 6.5 stored a single inline-image CDN URL here. The image is
  // already embedded in the HTML body via <img>, so on read we just drop this
  // field and rely on the HTML to carry the inline image.
  photoCdnUrl?: string;
};

const stripLegacyFields = (raw: StoredDraft): Draft => {
  const { photoCdnUrl: _photoCdnUrl, ...rest } = raw;
  return rest;
};

export const useEmailDraft = () => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as StoredDraft;
        const age = Date.now() - new Date(parsed.savedAt).getTime();
        if (age <= MAX_AGE_MS) setDraft(stripLegacyFields(parsed));
      } catch {
        // corrupted draft — ignore
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const save = useCallback(async (next: Omit<Draft, "savedAt">) => {
    const draftWithTimestamp: Draft = { ...next, savedAt: new Date().toISOString() };
    setDraft(draftWithTimestamp);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draftWithTimestamp));
  }, []);

  const clear = useCallback(async () => {
    setDraft(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { draft, save, clear, isLoaded };
};
