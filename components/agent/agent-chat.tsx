import { LineIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { type ChatMessage, type ProposedAction, executeAgentAction, sendAgentMessage } from "@/lib/agent";
import { useAuth } from "@/lib/auth-context";
import { assertDefined } from "@/lib/assert";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

const KEYBOARD_VERTICAL_OFFSET = 88;

interface DisplayMessage extends ChatMessage {
  // A proposed change attached to an assistant turn. Once the seller acts on it, we record the
  // outcome so the confirmation card collapses into a status line and can't be triggered twice.
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
  <View className="mt-2 gap-2 rounded-2xl border border-dashed border-border p-4">
    <Text className="font-sans font-semibold text-foreground">Proposed change</Text>
    <Text className="text-foreground">{action.summary}</Text>
    {status === "applied" ? (
      <Text className="text-accent" role="status">
        Applied
      </Text>
    ) : status === "dismissed" ? (
      <Text className="text-muted" role="status">
        Dismissed
      </Text>
    ) : (
      <View className="flex-row gap-2">
        <Button variant="accent" size="sm" disabled={isPending} onPress={onConfirm}>
          <Text>{isApplying ? "Applying..." : "Confirm"}</Text>
        </Button>
        <Button variant="outline" size="sm" disabled={isPending} onPress={onDismiss}>
          <Text>Dismiss</Text>
        </Button>
      </View>
    )}
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
      <View className="max-w-[85%]">
        <View className={`rounded-2xl px-4 py-2 ${isUser ? "bg-accent" : "border border-border bg-card"}`}>
          <Text className={isUser ? "text-accent-foreground" : "text-foreground"}>{message.content}</Text>
        </View>
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
  const { accessToken } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [pendingActionIndex, setPendingActionIndex] = useState<number | null>(null);
  const mutedColor = useCSSVariable("--color-muted") as string;
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  const sendMutation = useMutation({
    mutationFn: (history: ChatMessage[]) =>
      sendAgentMessage({ messages: history, accessToken: assertDefined(accessToken) }),
    onSuccess: ({ reply, proposedAction }) => {
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
  });

  const executeMutation = useMutation({
    mutationFn: (action: ProposedAction) => executeAgentAction({ action, accessToken: assertDefined(accessToken) }),
  });

  const isSending = sendMutation.isPending;

  useEffect(() => {
    const timeout = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timeout);
  }, [messages, isSending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSending) return;

    // Only the plain role/content pairs go to the server; UI-only fields stay local.
    const userMessage: DisplayMessage = { role: "user", content: trimmed };
    const history: ChatMessage[] = [...messages, userMessage].map(
      ({ role, content }): ChatMessage => ({ role, content }),
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
            <View className="items-start">
              <View className="bg-filled flex-row items-center gap-2 rounded-2xl border border-border px-4 py-2">
                <LoadingSpinner size="small" />
                <Text className="text-muted">Thinking...</Text>
              </View>
            </View>
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

      <View className="flex-row items-end gap-2 border-t border-border p-4">
        <TextInput
          className="max-h-32 flex-1 rounded-2xl border border-border bg-background px-4 py-3 font-sans text-base text-foreground"
          placeholder="Ask about your store or describe a change..."
          placeholderTextColor={mutedColor}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!isSending}
          accessibilityLabel="Message"
        />
        <Button
          variant="accent"
          size="icon"
          className="rounded-2xl"
          disabled={isSending || input.trim().length === 0}
          onPress={() => send(input)}
          accessibilityLabel="Send"
        >
          <LineIcon name="arrow-right-stroke" size={20} className="text-accent-foreground" />
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};
