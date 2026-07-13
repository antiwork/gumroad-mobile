import { LineIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { type ChatMessage, type ProposedAction, executeAgentAction, streamAgentMessage } from "@/lib/agent";
import { useAuthedRequest } from "@/lib/authed-request";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

const KEYBOARD_VERTICAL_OFFSET = 88;

interface DisplayMessage extends ChatMessage {
  proposedAction?: ProposedAction;
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
    <View className={isUser ? "items-end" : "items-start"} accessibilityLabel={isUser ? "You" : "Assistant"}>
      <View className={isUser ? "max-w-[85%]" : "w-full"}>
        {isUser ? (
          <View className="rounded-2xl rounded-br-md bg-accent px-4 py-2">
            <Text className="text-accent-foreground">{message.content}</Text>
          </View>
        ) : (
          <Text className="text-foreground">{message.content}</Text>
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
  const authedRequest = useAuthedRequest();
  const [messages, setMessages] = useState<DisplayMessage[]>([{ role: "assistant", content: greeting }]);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingActionIndex, setPendingActionIndex] = useState<number | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const mutedColor = useCSSVariable("--color-muted") as string;
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  const sendMutation = useMutation({
    mutationFn: (history: ChatMessage[]) =>
      authedRequest((token) =>
        streamAgentMessage({
          messages: history,
          conversationId: conversationIdRef.current,
          accessToken: token,
          handlers: {
            onToken: (text) => setStreamingReply((prev) => (prev ?? "") + text),
            onReset: () => setStreamingReply(null),
          },
        }),
      ),
    onSuccess: ({ reply, proposedAction, conversationId }) => {
      conversationIdRef.current = conversationId;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, ...(proposedAction ? { proposedAction } : {}) },
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
    mutationFn: (action: ProposedAction) =>
      authedRequest((token) =>
        executeAgentAction({ action, conversationId: conversationIdRef.current, accessToken: token }),
      ),
  });

  const isSending = sendMutation.isPending;
  const hasText = input.trim().length > 0;

  useEffect(() => {
    const timeout = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timeout);
  }, [messages, isSending, streamingReply]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSending) return;

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

  const confirmAction = (index: number, action: ProposedAction) => {
    setPendingActionIndex(index);
    executeMutation.mutate(action, {
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
    });
  };

  const dismissAction = (index: number) => {
    setMessages((prev) => prev.map((msg, i) => (i === index ? { ...msg, actionStatus: "dismissed" } : msg)));
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <FlatList<DisplayMessage>
        ref={listRef}
        data={messages}
        className="flex-1"
        contentContainerStyle={{ gap: 16, padding: 16 }}
        accessibilityLabel="Conversation"
        keyExtractor={(_, index) => String(index)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            isPending={pendingActionIndex !== null}
            isApplying={pendingActionIndex === index}
            onConfirm={() => item.proposedAction && confirmAction(index, item.proposedAction)}
            onDismiss={() => dismissAction(index)}
          />
        )}
        ListFooterComponent={
          isSending ? (
            streamingReply ? (
              <View className="items-start">
                <View className="w-full">
                  <Text className="text-foreground">{streamingReply}</Text>
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
        <View className="flex-row flex-wrap gap-2 px-4">
          {suggestions.map((suggestion) => (
            <Button key={suggestion} variant="outline" size="sm" disabled={isSending} onPress={() => send(suggestion)}>
              <Text>{suggestion}</Text>
            </Button>
          ))}
        </View>
      ) : null}

      <View className="border-t border-border p-4">
        <View className="relative rounded border border-border bg-background">
          <TextInput
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
            <LineIcon name="arrow-up-stroke" size={20} className={hasText ? "text-accent-foreground" : "text-muted"} />
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
