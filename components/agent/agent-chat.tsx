import { LineIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import {
  type ChatMessage,
  type AgentStreamResult,
  type AgentTurnStatus,
  type ProposedAction,
  AgentStreamInterruptedError,
  executeAgentAction,
  fetchAgentTurnStatus,
  fetchLatestAgentConversation,
  streamAgentMessage,
} from "@/lib/agent";
import { useAuthedRequest } from "@/lib/authed-request";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, type NativeScrollEvent, Platform, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

const IOS_KEYBOARD_VERTICAL_OFFSET = 88;
const AUTOSCROLL_BOTTOM_THRESHOLD = 24;
// After a stream breaks, how long to keep asking the server what became of the turn. The server
// tolerates up to 120 seconds of model silence across as many as 25 tool iterations, so recovery
// keeps polling for as long as it reports "in_progress"; the cap only guards a marker that never
// resolves.
const TURN_RECOVERY_POLL_INTERVAL_MS = 3000;
const TURN_RECOVERY_MAX_POLLS = 60;
// "unknown" means neither a stored turn nor a liveness marker, which is normally conclusive — but a
// Redis blip can produce one spuriously, so take a couple of confirming looks before giving up.
const TURN_RECOVERY_MAX_CONSECUTIVE_UNKNOWNS = 2;

const isNearBottom = ({ contentOffset, contentSize, layoutMeasurement }: NativeScrollEvent) =>
  contentSize.height - contentOffset.y - layoutMeasurement.height <= AUTOSCROLL_BOTTOM_THRESHOLD;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The id only has to distinguish this turn from the seller's other turns, so a timestamp plus
// randomness is enough — the server accepts any hex-and-dash string up to 64 characters.
const TURN_ID_RANDOM_SEGMENTS = 4;
const generateTurnId = () =>
  [
    Date.now().toString(16),
    ...Array.from({ length: TURN_ID_RANDOM_SEGMENTS }, () =>
      Math.floor(Math.random() * 0x10000)
        .toString(16)
        .padStart(4, "0"),
    ),
  ].join("-");

// Ask the server what became of a turn whose stream broke, identified by the id the app generated
// before sending. Without this, an interruption is indistinguishable from a failure, so a turn the
// server went on to persist is shown as an error and re-sending it duplicates the whole exchange.
const recoverTurn = async (
  clientTurnId: string,
  authedRequest: <T>(request: (token: string) => Promise<T>) => Promise<T>,
): Promise<AgentStreamResult> => {
  let consecutiveUnknowns = 0;
  for (let poll = 0; poll < TURN_RECOVERY_MAX_POLLS; poll++) {
    await sleep(TURN_RECOVERY_POLL_INTERVAL_MS);
    let turn: AgentTurnStatus;
    try {
      turn = await authedRequest((token) => fetchAgentTurnStatus(clientTurnId, token));
    } catch {
      // The same flaky network that broke the stream may still be down, so keep asking.
      continue;
    }
    switch (turn.status) {
      case "persisted":
        return {
          reply: turn.message.content,
          proposedAction: turn.message.proposed_action ?? null,
          proposalMessageId: turn.message.proposal_message_id ?? null,
          conversationId: turn.conversationId,
        };
      case "failed":
        throw new Error("Agent turn failed");
      case "in_progress":
        consecutiveUnknowns = 0;
        continue;
      case "unknown":
        consecutiveUnknowns += 1;
        if (consecutiveUnknowns >= TURN_RECOVERY_MAX_CONSECUTIVE_UNKNOWNS) throw new Error("Agent turn was lost");
        continue;
    }
  }
  throw new Error("Agent turn recovery timed out");
};

interface DisplayMessage extends ChatMessage {
  proposedAction?: ProposedAction;
  // Binds a confirm to the exact stored proposal the seller saw. Without it the server falls back
  // to matching on payload, which cannot tell two near-identical proposals apart and has
  // double-created products when the model staged the same intent twice.
  proposalMessageId?: string;
  actionStatus?: "applied" | "dismissed";
}

interface Props {
  greeting: string;
  suggestions: string[];
}

const ProposedActionCard = ({
  action,
  status,
  isPending,
  isApplying,
  onConfirm,
  onDismiss,
}: {
  action: ProposedAction;
  status?: "applied" | "dismissed";
  isPending: boolean;
  isApplying: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) => (
  <View className="mt-2 rounded border border-border bg-card">
    <View className="gap-2 p-4">
      <Text className="font-sans font-semibold text-foreground">{action.title ?? "Proposed change"}</Text>
      {action.fields && action.fields.length > 0 ? (
        <View className="gap-1">
          {action.fields.map((field, i) => (
            <View key={`${i}-${field.label}`} className="flex-row gap-2">
              <Text className="text-sm text-muted">{field.label}</Text>
              <Text className="flex-1 text-right text-sm text-foreground">{field.value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-foreground">{action.summary}</Text>
      )}
    </View>
    <View className="flex-row items-center justify-end gap-2 border-t border-border p-3">
      {status === "applied" ? (
        <Text className="mr-auto text-accent" role="status">
          Applied
        </Text>
      ) : status === "dismissed" ? (
        <Text className="mr-auto text-muted" role="status">
          Dismissed
        </Text>
      ) : (
        <>
          <Button variant="outline" size="sm" disabled={isPending} onPress={onDismiss}>
            <Text>Dismiss</Text>
          </Button>
          <Button variant="accent" size="sm" disabled={isPending} onPress={onConfirm}>
            <Text>{isApplying ? "Applying..." : "Confirm"}</Text>
          </Button>
        </>
      )}
    </View>
  </View>
);

const MessageBubble = ({
  message,
  isPending,
  isApplying,
  onConfirm,
  onDismiss,
}: {
  message: DisplayMessage;
  isPending: boolean;
  isApplying: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) => {
  const isUser = message.role === "user";
  return (
    <View
      className={isUser ? "items-end" : "items-start"}
      accessibilityLabel={isUser ? "You" : "Assistant"}
      testID={isUser ? "agent-user-message" : "agent-assistant-message"}
    >
      <View className={isUser ? "max-w-[85%]" : "w-full"}>
        {isUser ? (
          <View className="rounded-2xl rounded-br-md bg-accent px-4 py-2">
            <Text className="text-accent-foreground" testID="agent-user-message-content">
              {message.content}
            </Text>
          </View>
        ) : (
          <Text className="text-foreground" testID="agent-assistant-message-content">
            {message.content}
          </Text>
        )}
        {message.proposedAction ? (
          <ProposedActionCard
            action={message.proposedAction}
            status={message.actionStatus}
            isPending={isPending}
            isApplying={isApplying}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        ) : null}
      </View>
    </View>
  );
};

export const AgentChat = ({ greeting, suggestions }: Props) => {
  const headerHeight = useHeaderHeight();
  const authedRequest = useAuthedRequest();
  const [messages, setMessages] = useState<DisplayMessage[]>([{ role: "assistant", content: greeting }]);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingActionIndex, setPendingActionIndex] = useState<number | null>(null);
  const [hasContentGrownSinceReaderScroll, setHasContentGrownSinceReaderScroll] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const hasSentMessageRef = useRef(false);
  const mutedColor = useCSSVariable("--color-muted") as string;
  const listRef = useRef<FlatList<DisplayMessage>>(null);
  const isAtBottomRef = useRef(true);
  const isReaderDraggingRef = useRef(false);
  const isReaderMomentumPendingRef = useRef(false);
  const isReaderMomentumRef = useRef(false);
  const programmaticScrollCountRef = useRef(0);
  const ignoresInterruptedReaderMomentumRef = useRef(false);
  const lastScrollOffsetRef = useRef(0);
  const momentumHandoffFrameRef = useRef<number | null>(null);
  const hasDeferredBottomGrowthRef = useRef(false);
  const shouldFollowAfterGestureRef = useRef(false);
  const isBottomBounceRef = useRef(false);

  // Resume the latest stored conversation on open. If the seller sends a message before this
  // resolves, their new chat wins and we skip hydration.
  useEffect(() => {
    let cancelled = false;
    void authedRequest((token) => fetchLatestAgentConversation(token))
      .then((conversation) => {
        if (cancelled || !conversation || conversation.messages.length === 0 || hasSentMessageRef.current) return;
        setMessages([
          { role: "assistant", content: greeting },
          ...conversation.messages.map(
            (message): DisplayMessage => ({
              role: message.role,
              content: message.content,
              ...(message.proposed_action ? { proposedAction: message.proposed_action } : {}),
              ...(message.proposal_message_id ? { proposalMessageId: message.proposal_message_id } : {}),
              ...(message.action_status
                ? { actionStatus: message.action_status }
                : // A proposal that was never confirmed is stale after resuming, so show it as dismissed.
                  message.proposed_action
                  ? { actionStatus: "dismissed" as const }
                  : {}),
            }),
          ),
        ]);
        conversationIdRef.current = conversation.id;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume runs once, on mount
  }, []);

  const sendMutation = useMutation({
    mutationFn: async (history: ChatMessage[]) => {
      const clientTurnId = generateTurnId();
      try {
        return await authedRequest((token) =>
          streamAgentMessage({
            messages: history,
            conversationId: conversationIdRef.current,
            clientTurnId,
            accessToken: token,
            handlers: {
              onToken: (text) => setStreamingReply((prev) => (prev ?? "") + text),
              onReset: () => setStreamingReply(null),
            },
          }),
        );
      } catch (error) {
        if (!(error instanceof AgentStreamInterruptedError)) throw error;
        return await recoverTurn(clientTurnId, authedRequest);
      }
    },
    onSuccess: ({ reply, proposedAction, proposalMessageId, conversationId }) => {
      conversationIdRef.current = conversationId;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          ...(proposedAction ? { proposedAction } : {}),
          ...(proposalMessageId ? { proposalMessageId } : {}),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I ran into a problem. Please try again." },
      ]);
    },
    onSettled: () => setStreamingReply(null),
  });

  const executeMutation = useMutation({
    mutationFn: ({ action, proposalMessageId }: { action: ProposedAction; proposalMessageId?: string }) =>
      authedRequest((token) =>
        executeAgentAction({
          action,
          conversationId: conversationIdRef.current,
          proposalMessageId,
          accessToken: token,
        }),
      ),
  });

  const isSending = sendMutation.isPending;
  const hasText = input.trim().length > 0;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSending) return;

    hasSentMessageRef.current = true;
    isAtBottomRef.current = true;
    if (momentumHandoffFrameRef.current !== null) cancelAnimationFrame(momentumHandoffFrameRef.current);
    momentumHandoffFrameRef.current = null;
    const interruptsReaderMomentum = isReaderMomentumPendingRef.current || isReaderMomentumRef.current;
    isReaderDraggingRef.current = false;
    isReaderMomentumPendingRef.current = false;
    isReaderMomentumRef.current = false;
    hasDeferredBottomGrowthRef.current = false;
    shouldFollowAfterGestureRef.current = false;
    isBottomBounceRef.current = false;
    ignoresInterruptedReaderMomentumRef.current = interruptsReaderMomentum;
    programmaticScrollCountRef.current += interruptsReaderMomentum ? 2 : 1;
    setHasContentGrownSinceReaderScroll(false);
    listRef.current?.scrollToEnd({ animated: true });

    const userMessage: DisplayMessage = { role: "user", content: trimmed };
    const history: ChatMessage[] = [...messages, userMessage].map(
      ({ role, content }): ChatMessage => ({
        role,
        content,
      }),
    );
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    sendMutation.mutate(history);
  };

  const confirmAction = (index: number, action: ProposedAction, proposalMessageId?: string) => {
    setPendingActionIndex(index);
    executeMutation.mutate(
      { action, proposalMessageId },
      {
        onSuccess: () => {
          setMessages((prev) => prev.map((msg, i) => (i === index ? { ...msg, actionStatus: "applied" } : msg)));
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, I couldn't apply that change. Please try again." },
          ]);
        },
        onSettled: () => setPendingActionIndex(null),
      },
    );
  };

  const dismissAction = (index: number) => {
    setMessages((prev) => prev.map((msg, i) => (i === index ? { ...msg, actionStatus: "dismissed" } : msg)));
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? IOS_KEYBOARD_VERTICAL_OFFSET : headerHeight}
    >
      <FlatList<DisplayMessage>
        ref={listRef}
        data={messages}
        className="flex-1"
        contentContainerStyle={{ gap: 16, padding: 16 }}
        accessibilityLabel="Conversation"
        keyExtractor={(_, index) => String(index)}
        keyboardShouldPersistTaps="handled"
        // Scrolling on content growth keeps up with streaming tokens, which arrive faster than a debounce would fire.
        onContentSizeChange={() => {
          const readerOwnsScroll =
            isReaderDraggingRef.current ||
            isReaderMomentumPendingRef.current ||
            isReaderMomentumRef.current ||
            !isAtBottomRef.current;
          if (readerOwnsScroll) {
            if (
              (isReaderDraggingRef.current || isReaderMomentumPendingRef.current || isReaderMomentumRef.current) &&
              shouldFollowAfterGestureRef.current
            )
              hasDeferredBottomGrowthRef.current = true;
            setHasContentGrownSinceReaderScroll(true);
            return;
          }
          programmaticScrollCountRef.current += 1;
          listRef.current?.scrollToEnd({ animated: true });
        }}
        onScrollBeginDrag={() => {
          const startedAtBottom = isAtBottomRef.current;
          if (momentumHandoffFrameRef.current !== null) cancelAnimationFrame(momentumHandoffFrameRef.current);
          momentumHandoffFrameRef.current = null;
          programmaticScrollCountRef.current = 0;
          ignoresInterruptedReaderMomentumRef.current = false;
          setHasContentGrownSinceReaderScroll(false);
          isReaderDraggingRef.current = true;
          isReaderMomentumPendingRef.current = false;
          isReaderMomentumRef.current = false;
          hasDeferredBottomGrowthRef.current = false;
          shouldFollowAfterGestureRef.current = startedAtBottom;
          isBottomBounceRef.current = false;
          isAtBottomRef.current = false;
        }}
        onScroll={({ nativeEvent }) => {
          const currentOffset = nativeEvent.contentOffset.y;
          const movedUp = currentOffset < lastScrollOffsetRef.current;
          lastScrollOffsetRef.current = currentOffset;
          const maximumOffset = Math.max(0, nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height);
          const isPastBottom = currentOffset > maximumOffset;
          const isBottomBounceBack = isBottomBounceRef.current && movedUp && !isReaderDraggingRef.current;
          if (isPastBottom) isBottomBounceRef.current = true;
          if (ignoresInterruptedReaderMomentumRef.current) return;
          if (
            programmaticScrollCountRef.current > 0 &&
            !movedUp &&
            !isReaderDraggingRef.current &&
            !isReaderMomentumPendingRef.current &&
            !isReaderMomentumRef.current
          )
            return;
          const isAtBottom = isNearBottom(nativeEvent);
          if (movedUp) {
            programmaticScrollCountRef.current = 0;
            if (
              !isBottomBounceBack &&
              !isAtBottom &&
              (isReaderDraggingRef.current || isReaderMomentumPendingRef.current || isReaderMomentumRef.current)
            )
              shouldFollowAfterGestureRef.current = false;
            if (isReaderDraggingRef.current && !isAtBottom) isBottomBounceRef.current = false;
          }
          if ((isReaderDraggingRef.current && isAtBottom) || (isReaderMomentumRef.current && !movedUp && isAtBottom))
            shouldFollowAfterGestureRef.current = true;
          isAtBottomRef.current = isAtBottom;
        }}
        onScrollEndDrag={({ nativeEvent }) => {
          const movedUpAtRelease = nativeEvent.contentOffset.y < lastScrollOffsetRef.current;
          lastScrollOffsetRef.current = nativeEvent.contentOffset.y;
          isAtBottomRef.current = isNearBottom(nativeEvent);
          if (movedUpAtRelease && !isAtBottomRef.current) shouldFollowAfterGestureRef.current = false;
          isReaderDraggingRef.current = false;
          isReaderMomentumPendingRef.current = true;
          shouldFollowAfterGestureRef.current =
            isAtBottomRef.current || (hasDeferredBottomGrowthRef.current && shouldFollowAfterGestureRef.current);
          momentumHandoffFrameRef.current = requestAnimationFrame(() => {
            isReaderMomentumPendingRef.current = false;
            momentumHandoffFrameRef.current = null;
            const shouldCatchUp = hasDeferredBottomGrowthRef.current && shouldFollowAfterGestureRef.current;
            hasDeferredBottomGrowthRef.current = false;
            shouldFollowAfterGestureRef.current = false;
            isBottomBounceRef.current = false;
            if (!shouldCatchUp) return;
            programmaticScrollCountRef.current += 1;
            listRef.current?.scrollToEnd({ animated: true });
          });
        }}
        onMomentumScrollBegin={() => {
          if (!isReaderMomentumPendingRef.current) return;
          if (momentumHandoffFrameRef.current !== null) cancelAnimationFrame(momentumHandoffFrameRef.current);
          momentumHandoffFrameRef.current = null;
          isReaderMomentumPendingRef.current = false;
          isReaderMomentumRef.current = true;
        }}
        onMomentumScrollEnd={({ nativeEvent }) => {
          if (isReaderDraggingRef.current || isReaderMomentumPendingRef.current) return;
          isBottomBounceRef.current = false;
          if (ignoresInterruptedReaderMomentumRef.current) {
            ignoresInterruptedReaderMomentumRef.current = false;
            programmaticScrollCountRef.current = Math.max(0, programmaticScrollCountRef.current - 1);
            return;
          }
          if (isReaderMomentumRef.current) {
            const shouldCatchUp = hasDeferredBottomGrowthRef.current && shouldFollowAfterGestureRef.current;
            hasDeferredBottomGrowthRef.current = false;
            shouldFollowAfterGestureRef.current = false;
            if (shouldCatchUp) {
              isAtBottomRef.current = true;
              isReaderMomentumRef.current = false;
              programmaticScrollCountRef.current += 1;
              listRef.current?.scrollToEnd({ animated: true });
              return;
            }
            isAtBottomRef.current = isNearBottom(nativeEvent);
            isReaderMomentumRef.current = false;
            return;
          }
          if (programmaticScrollCountRef.current === 0) return;
          programmaticScrollCountRef.current -= 1;
          if (programmaticScrollCountRef.current > 0) return;
          isAtBottomRef.current = isNearBottom(nativeEvent);
        }}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            isPending={pendingActionIndex !== null}
            isApplying={pendingActionIndex === index}
            onConfirm={() => item.proposedAction && confirmAction(index, item.proposedAction, item.proposalMessageId)}
            onDismiss={() => dismissAction(index)}
          />
        )}
        ListFooterComponent={
          isSending ? (
            streamingReply ? (
              <View className="items-start">
                <View className="w-full">
                  <Text className="text-foreground" testID="agent-streaming-reply">
                    {streamingReply}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2" role="status" accessibilityLabel="Working on it">
                <LoadingSpinner size="small" />
                <Text className="text-sm text-muted">Working on it...</Text>
              </View>
            )
          ) : null
        }
      />

      {messages.length <= 1 ? (
        <View testID="suggested-actions" className="flex-row flex-wrap gap-2 px-4 pb-1">
          {suggestions.map((suggestion) => (
            <Button key={suggestion} variant="outline" size="sm" disabled={isSending} onPress={() => send(suggestion)}>
              <Text>{suggestion}</Text>
            </Button>
          ))}
        </View>
      ) : null}

      <View className="border-t border-border p-4">
        <View
          className="relative rounded border border-border bg-background"
          onTouchEnd={() => setHasContentGrownSinceReaderScroll(false)}
          testID={hasContentGrownSinceReaderScroll ? "agent-content-growth-observed" : "agent-content-growth-pending"}
        >
          <TextInput
            testID={isSending ? "agent-message-input-sending" : "agent-message-input-ready"}
            className="max-h-32 py-3 pr-16 pl-3 font-sans text-base text-foreground"
            placeholder="Ask about your store or describe a change..."
            placeholderTextColor={mutedColor}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isSending}
            autoFocus
            accessibilityLabel="Message"
          />
          <Button
            variant={hasText ? "accent" : "default"}
            size="icon"
            className="absolute right-1.5 bottom-1.5 size-11 rounded-full"
            disabled={isSending || !hasText}
            onPress={() => send(input)}
            accessibilityLabel="Send"
          >
            <LineIcon
              name="arrow-up-stroke"
              size={20}
              className={hasText ? "text-accent-foreground" : "text-primary-foreground"}
            />
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
