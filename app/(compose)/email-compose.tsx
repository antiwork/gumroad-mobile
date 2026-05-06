import { useCompose } from "@/components/email-compose/compose-context";
import { PhotoAttachment } from "@/components/email-compose/photo-attachment";
import { RestoreDraftBanner } from "@/components/email-compose/restore-draft-banner";
import { RichTextBody, useRichTextBody } from "@/components/email-compose/rich-text-body";
import type { Channel } from "@/components/email-compose/settings-sheet";
import { SettingsSheet } from "@/components/email-compose/settings-sheet";
import type { AudienceType } from "@/components/email-compose/use-audience-options";
import { useAudienceOptions } from "@/components/email-compose/use-audience-options";
import type { Draft } from "@/components/email-compose/use-email-draft";
import { useEmailDraft } from "@/components/email-compose/use-email-draft";
import { useFileUpload } from "@/components/email-compose/use-file-upload";
import { usePublishEmail } from "@/components/email-compose/use-publish-email";
import { LineIcon } from "@/components/icon";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

const STALE_DRAFT_MS = 60 * 60 * 1000;

// TenTap emits structural HTML like "<p></p>" or "<p><br></p>" when the editor
// is focused-but-empty. Strip tags + non-breaking whitespace before deciding
// whether the body has visible content.
const isHtmlEmpty = (html: string): boolean =>
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").replace(/ /g, "").trim().length === 0;

const channelSummary = (audienceType: AudienceType, channel: Channel) => {
  const profileVisible = audienceType === "audience" && channel.profile;
  if (channel.email && profileVisible) return "Email + Post";
  if (channel.email) return "Email";
  if (profileVisible) return "Post";
  return "—";
};

export default function EmailComposeScreen() {
  const { isCreator } = useAuth();
  const router = useRouter();
  const audienceQuery = useAudienceOptions();
  const { draft: storedDraft, isLoaded: draftIsLoaded, save: saveDraft, clear: clearDraft } = useEmailDraft();
  const photoUpload = useFileUpload();
  const publish = usePublishEmail();
  const { attachments, setAttachments } = useCompose();

  const [title, setTitle] = useState("");
  const [audienceType, setAudienceTypeState] = useState<AudienceType>("audience");
  const [channel, setChannel] = useState<Channel>({ email: true, profile: true });
  const [allowComments, setAllowComments] = useState(true);
  const [html, setHtml] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => Crypto.randomUUID());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<Draft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editor = useRichTextBody({ initialHtml: "", onChange: setHtml });

  const setAudienceType = useCallback((next: AudienceType) => {
    setAudienceTypeState((prev) => {
      if (next === "audience" && prev !== "audience") {
        setChannel((current) => ({ ...current, profile: true }));
      }
      return next;
    });
  }, []);

  const initialDraftHandled = useRef(false);
  useEffect(() => {
    if (initialDraftHandled.current || !draftIsLoaded) return;
    initialDraftHandled.current = true;
    if (storedDraft) {
      setRestoreCandidate(storedDraft);
    } else {
      // No draft to restore — clear any state held over by the root-scoped
      // ComposeProvider from a prior compose session in the same app run.
      setAttachments([]);
    }
  }, [draftIsLoaded, storedDraft, setAttachments]);

  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftIsLoaded) return;
    if (!title && isHtmlEmpty(html) && attachments.length === 0) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      saveDraft({
        title,
        html,
        audienceType,
        idempotencyKey,
        attachments,
        sendEmails: channel.email,
        shownOnProfile: channel.profile,
        allowComments,
      });
    }, 1000);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [draftIsLoaded, saveDraft, title, html, audienceType, idempotencyKey, attachments, channel.email, channel.profile, allowComments]);

  const lastPublishWasError = useRef(false);
  useEffect(() => {
    if (publish.isError) lastPublishWasError.current = true;
  }, [publish.isError]);
  const publishReset = publish.reset;
  useEffect(() => {
    if (lastPublishWasError.current && (title || html)) {
      lastPublishWasError.current = false;
      setIdempotencyKey(Crypto.randomUUID());
      setErrorMessage(null);
      publishReset();
    }
  }, [title, html, audienceType, publishReset]);

  const eligibility = audienceQuery.data?.eligibility;
  const options = audienceQuery.data?.options ?? [];
  const hasProfileSections = audienceQuery.data?.has_profile_sections ?? false;
  const selectedOption = useMemo(() => options.find((o) => o.type === audienceType), [options, audienceType]);

  const audienceLabel = selectedOption?.label ?? "Everyone";
  const summary = `${audienceLabel} · ${channelSummary(audienceType, channel)} · Comments: ${allowComments ? "ON" : "OFF"}`;

  const effectiveProfile = audienceType === "audience" && channel.profile;
  const hasChannel = channel.email || effectiveProfile;
  const canPublish = !!eligibility?.can_send_emails && title.trim().length > 0 && !isHtmlEmpty(html) && hasChannel && !publish.isPending;

  const handleCancelPress = useCallback(() => {
    if (!title.trim() && isHtmlEmpty(html) && attachments.length === 0) {
      router.dismiss();
      return;
    }
    Alert.alert(
      "Cancel email?",
      "Your draft will be saved unless you discard it.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Save as draft",
          onPress: () => {
            if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
            saveDraft({
              title,
              html,
              audienceType,
              idempotencyKey,
              attachments,
              sendEmails: channel.email,
              shownOnProfile: channel.profile,
              allowComments,
            });
            router.dismiss();
          },
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
            await clearDraft();
            setAttachments([]);
            router.dismiss();
          },
        },
      ],
    );
  }, [title, html, attachments, audienceType, idempotencyKey, channel.email, channel.profile, allowComments, saveDraft, clearDraft, router]);

  const handlePublish = useCallback(async () => {
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await publish.mutateAsync({
        title,
        html,
        audienceType,
        attachments,
        idempotencyKey,
        sendEmails: channel.email,
        shownOnProfile: effectiveProfile,
        allowComments,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
      await clearDraft();
      setAttachments([]);
      router.dismiss();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to publish");
    }
  }, [publish, title, html, audienceType, attachments, idempotencyKey, channel.email, effectiveProfile, allowComments, clearDraft, router]);

  const handlePickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });
    if (!result.assets?.length) return;
    for (const asset of result.assets) {
      const upload = await photoUpload.upload(asset);
      if (upload) editor.setImage(upload.cdnUrl);
    }
  }, [photoUpload, editor]);

  const handleRestoreContinue = useCallback(() => {
    if (!restoreCandidate) return;
    setTitle(restoreCandidate.title);
    setAudienceTypeState(restoreCandidate.audienceType as AudienceType);
    const age = Date.now() - new Date(restoreCandidate.savedAt).getTime();
    if (age > STALE_DRAFT_MS) {
      setIdempotencyKey(Crypto.randomUUID());
    } else {
      setIdempotencyKey(restoreCandidate.idempotencyKey);
    }
    setAttachments(restoreCandidate.attachments ?? []);
    setChannel({
      email: restoreCandidate.sendEmails ?? true,
      profile: restoreCandidate.shownOnProfile ?? true,
    });
    setAllowComments(restoreCandidate.allowComments ?? true);
    editor.setContent(restoreCandidate.html);
    setHtml(restoreCandidate.html);
    setRestoreCandidate(null);
  }, [restoreCandidate, editor, setAttachments]);

  const handleRestoreDiscard = useCallback(async () => {
    await clearDraft();
    setRestoreCandidate(null);
  }, [clearDraft]);

  if (!isCreator) {
    return (
      <Screen>
        <Banner variant="error" message="Only creator accounts can compose emails." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "New email",
          headerLeft: () => (
            <Pressable
              onPress={handleCancelPress}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}
            >
              <Text className="text-base text-accent">Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handlePublish}
              disabled={!canPublish}
              accessibilityRole="button"
              accessibilityLabel="Publish email"
              accessibilityState={{ disabled: !canPublish }}
              testID="email-publish-button"
              hitSlop={8}
            >
              <Text className={canPublish ? "text-base font-semibold text-accent" : "text-base font-semibold text-muted-foreground"}>
                {publish.isPending ? "Publishing…" : "Publish"}
              </Text>
            </Pressable>
          ),
        }}
      />

      {audienceQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      ) : null}

      {audienceQuery.isError ? (
        <Banner
          variant="error"
          message="Couldn't load audience options. Pull to retry."
          actionLabel="Retry"
          onAction={() => audienceQuery.refetch()}
        />
      ) : null}

      {restoreCandidate ? (
        <RestoreDraftBanner draft={restoreCandidate} onContinue={handleRestoreContinue} onDiscard={handleRestoreDiscard} />
      ) : null}

      {eligibility && !eligibility.can_send_emails ? (
        <Banner variant="error" message={eligibility.reason ?? "You can't send emails yet."} />
      ) : null}

      {errorMessage ? <Banner variant="error" message={errorMessage} /> : null}

      <View className="px-4 py-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor="#999"
          accessibilityLabel="Email title"
          testID="email-subject-input"
          className="border-b border-border py-3 text-lg text-foreground"
        />
      </View>

      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Settings: ${summary}`}
        testID="email-settings-chip"
        className="mx-4 my-2 flex-row items-center justify-between rounded border border-border bg-card px-4 py-3"
      >
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">Settings</Text>
          <Text className="text-base" numberOfLines={1}>{summary}</Text>
        </View>
        <LineIcon name="chevron-right" size={20} className="text-muted-foreground" />
      </Pressable>

      <Pressable
        onPress={() => router.push("/email-attachments")}
        accessibilityRole="button"
        accessibilityLabel={`Attachments: ${attachments.length} ${attachments.length === 1 ? "file" : "files"}`}
        testID="email-attachments-chip"
        className="mx-4 my-2 flex-row items-center justify-between rounded border border-border bg-card px-4 py-3"
      >
        <View className="flex-row items-center gap-3">
          <LineIcon name="paperclip" size={20} className="text-foreground" />
          <Text className="text-base">
            Attachments ({attachments.length})
          </Text>
        </View>
        <LineIcon name="chevron-right" size={20} className="text-muted-foreground" />
      </Pressable>

      <View className="mx-4 my-2 flex-row gap-2">
        <Button variant="outline" size="sm" onPress={handlePickPhoto}>
          <LineIcon name="image" size={16} className="text-foreground" />
          <Text>Add photo</Text>
        </Button>
      </View>

      <PhotoAttachment status={photoUpload.status} onRemove={() => photoUpload.reset()} onRetry={handlePickPhoto} />

      <RichTextBody editor={editor} />

      <SettingsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        options={options}
        audienceType={audienceType}
        onSelectAudience={setAudienceType}
        hasProfileSections={hasProfileSections}
        channel={channel}
        onChangeChannel={setChannel}
        allowComments={allowComments}
        onChangeAllowComments={setAllowComments}
      />
    </Screen>
  );
}
