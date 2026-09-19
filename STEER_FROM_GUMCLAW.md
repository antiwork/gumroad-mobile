# STEER FROM GUMCLAW (2026-09-19T02:2x UTC) — do this before you finish

Greptile reviewed PR #363 at head `f9d0756` and left ONE finding (P2). It is valid and it is yours to fix.

Finding: `.github/workflows/e2e.yml` — the "Upload smoke artifacts" step
(`actions/upload-artifact@v4`, artifact name `maestro-smoke-results`) still lists only the PDF
suite's report paths. The new image-connectivity suite you added
(`:expo-image:testDebugUnitTest`, step "Test native image connectivity") is not covered, so a
failing image test discards its structured HTML/XML reports and diagnosis is stuck with the raw
Gradle log.

Required change (same block, same style as the two existing pdf lines):

```
            node_modules/expo-image/android/build/reports/tests/testDebugUnitTest/**
            node_modules/expo-image/android/build/test-results/testDebugUnitTest/**
```

Also confirm the PDF lines' behaviour is unchanged and `if-no-files-found: warn` stays.

Then, in the SAME session, before you exit:
- include the fix in the PR #363 branch (`gumclaw/android-image-connectivity`) and push normally (NEVER force-push);
- update the PR body status surface so the review line reflects the round and the head SHA
  (`Premerge review: clean @ <head-sha>` only once the panel is actually clean at that head);
- the premerge panel must run IN THE FOREGROUND and be waited on; do not exit while the verdict file
  is still a PENDING marker or under 2 KB.

Do not open a second PR and do not touch anything outside `.github/workflows/e2e.yml` for this finding.
If you have already exited the code work for this PR and cannot pick this up, leave a note at the
bottom of this file with the reason rather than silently skipping it.
