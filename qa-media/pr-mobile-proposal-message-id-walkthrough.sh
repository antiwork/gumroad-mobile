#!/usr/bin/env bash
# Drives the real confirm path on origin/main and on this branch, and prints the request body
# the app actually POSTs to /mobile/agent/actions. Run from the repo root on the fix branch:
#
#   bash qa-media/pr-mobile-proposal-message-id-walkthrough.sh
#
# The harness never asserts on the id. It renders the chat component, streams a proposal, presses
# Confirm, and reports what left the device -- so a branch that does not fix the bug shows it.
#
# The "before" run happens in a disposable detached worktree, never in this checkout: comparing
# against origin/main by checking those files out here and back would clobber any uncommitted
# edits in lib/agent.ts or components/agent-chat.tsx, permanently if the run gets interrupted
# between the two checkouts.
set -euo pipefail

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ROOT="$PWD"
OUT="$ROOT/qa-media/pr-mobile-proposal-message-id-walkthrough.txt"
REL_HARNESS="tests/components/agent/proposal-id-walkthrough.test.tsx"
HARNESS_SRC="$(mktemp -t pmid-harness.XXXXXX)"
BEFORE_WT="$(mktemp -d -t pmid-before-worktree.XXXXXX)"

cleanup() {
  git worktree remove --force "$BEFORE_WT" 2>/dev/null || rm -rf "$BEFORE_WT"
  rm -f "$HARNESS_SRC"
  rm -f "$ROOT/$REL_HARNESS"
}
trap cleanup EXIT

cat > "$HARNESS_SRC" <<'HARNESS_EOF'
import { AgentChat } from "@/components/agent/agent-chat";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { act } from "react";
import { renderWithQueryClient } from "../../render-with-query-client";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ accessToken: "test-token" }) }));
jest.mock("@react-navigation/elements", () => ({
  ...jest.requireActual("@react-navigation/elements"),
  useHeaderHeight: () => 104,
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const mockStreamAgentMessage = jest.fn();
const mockFetchLatestAgentConversation = jest.fn();
const sentBodies: Record<string, unknown>[] = [];

// The real executeAgentAction runs; only the network boundary is faked. What we print is
// therefore the body the client genuinely builds, not a restatement of the harness's wishes.
jest.mock("@/lib/request", () => ({
  ...jest.requireActual("@/lib/request"),
  requestAPI: (_path: string, options: { data?: Record<string, unknown> }) => {
    if (options.data) sentBodies.push(options.data);
    return Promise.resolve({ success: true, message: "Created My ebook." });
  },
}));
jest.mock("@/lib/agent", () => ({
  ...jest.requireActual("@/lib/agent"),
  streamAgentMessage: (...args: unknown[]) => mockStreamAgentMessage(...args),
  fetchLatestAgentConversation: (...args: unknown[]) => mockFetchLatestAgentConversation(...args),
}));

it("walkthrough: what the app posts to /mobile/agent/actions on confirm", async () => {
  mockFetchLatestAgentConversation.mockResolvedValue(null);
  // Exactly what the server puts on the done frame: the proposal card plus its message id.
  mockStreamAgentMessage.mockResolvedValue({
    reply: "I've prepared your product.",
    conversationId: "conv-123",
    proposalMessageId: "msg-abc",
    proposedAction: {
      type: "api_write",
      params: { name: "My ebook", price: 25 },
      summary: "Create My ebook at $25",
    },
  });

  renderWithQueryClient(<AgentChat greeting="Hi!" suggestions={[]} />);
  fireEvent.changeText(screen.getByLabelText("Message"), "Create my ebook");
  await act(async () => {
    fireEvent.press(screen.getByLabelText("Send"));
  });
  await waitFor(() => expect(screen.getByText("Create My ebook at $25")).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByText("Confirm"));
  });
  await waitFor(() => expect(screen.getByText("Applied")).toBeTruthy());

  const body = sentBodies[0] ?? {};
  const id = body.proposal_message_id;
  // eslint-disable-next-line no-console
  console.log(
    [
      "  server sent proposal_message_id on done frame : msg-abc",
      `  POST body keys                                : ${Object.keys(body).sort().join(", ")}`,
      `  POST body proposal_message_id                 : ${id ?? "ABSENT"}`,
      `  server confirm path                           : ${id ? "id match (idempotent)" : "legacy fuzzy match"}`,
      `  same intent staged twice, two taps            : ${id ? "second rejected, ACTION_ALREADY_CONFIRMED" : "BOTH EXECUTE -> duplicate product"}`,
    ].join("\n"),
  );
});
HARNESS_EOF

# $1 = directory to run the harness in.
report_in() {
  (cd "$1" && npx jest --forceExit --silent=false "$REL_HARNESS" 2>&1) |
    grep -E "^ +(server sent|POST body|server confirm|same intent)" |
    sed -E 's/^ +/  /' || echo "  (harness did not report)"
}

{
  echo "Walkthrough: mobile store-agent confirm, proposal_message_id binding"
  echo "gumroad-private#1727 — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "One harness, two branches. It renders the real chat component, streams a proposal whose"
  echo "done frame carries proposal_message_id=msg-abc, presses Confirm, and prints the request"
  echo "body the client actually built. Only the network boundary is faked."
  echo
} > "$OUT"

# Before: a disposable detached worktree checked out at origin/main, with node_modules borrowed
# via symlink so npx jest doesn't need its own install. This checkout is never touched.
git worktree add --detach --quiet "$BEFORE_WT" origin/main
ln -s "$ROOT/node_modules" "$BEFORE_WT/node_modules"
mkdir -p "$BEFORE_WT/$(dirname "$REL_HARNESS")"
cp "$HARNESS_SRC" "$BEFORE_WT/$REL_HARNESS"
{
  echo "=== origin/main (before) ==="
  report_in "$BEFORE_WT"
  echo
} >> "$OUT"

# After: this branch's own code, same harness, run in place -- nothing here is checked out
# over or restored, so an interrupted run leaves this checkout exactly as the caller had it.
mkdir -p "$ROOT/$(dirname "$REL_HARNESS")"
cp "$HARNESS_SRC" "$ROOT/$REL_HARNESS"
{
  echo "=== $BRANCH (after) ==="
  report_in "$ROOT"
  echo
} >> "$OUT"
rm -f "$ROOT/$REL_HARNESS"

cat "$OUT"
