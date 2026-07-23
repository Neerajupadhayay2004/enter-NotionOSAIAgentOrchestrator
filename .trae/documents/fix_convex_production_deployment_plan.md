# Convex Production Deployment Fix Plan

## Repo Research Conclusion

- This is a Vite app, confirmed by [package.json](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/package.json#L6-L17), [vite.config.ts](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/vite.config.ts#L1-L28), and the use of `import.meta.env` in [src/App.tsx](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/App.tsx#L10-L11).
- The production Convex failure comes from [src/App.tsx](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/App.tsx#L10-L11), which currently creates `ConvexReactClient` with a fallback placeholder URL:
  - `const convex = new ConvexReactClient(convexUrl || "https://placeholder.convex.cloud");`
- The project already types `VITE_CONVEX_URL` in [src/env.d.ts](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/env.d.ts#L3-L8).
- The search across the repo found no current usage of `NEXT_PUBLIC_CONVEX_URL`, and no other Convex placeholder URL outside [src/App.tsx](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/App.tsx#L10-L11).
- `.env.local` currently contains both:
  - `CONVEX_DEPLOYMENT=dev:efficient-toucan-423`
  - `VITE_CONVEX_URL=https://vibrant-peacock-196.convex.cloud`
  This means the frontend should read `VITE_CONVEX_URL`, while local Convex CLI still uses `CONVEX_DEPLOYMENT`.

## Files To Edit

- [src/App.tsx](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/App.tsx)
- [.env.example](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/.env.example)

## Planned Changes

1. Update [src/App.tsx](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/App.tsx) to:
   - keep using `import.meta.env.VITE_CONVEX_URL`
   - remove the `https://placeholder.convex.cloud` fallback completely
   - throw a clear startup error when `VITE_CONVEX_URL` is missing or blank
   - keep the rest of the app wiring unchanged

2. Update [.env.example](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/.env.example) so the sample Convex env guidance reflects production-ready usage of `VITE_CONVEX_URL`, without implying a placeholder fallback is acceptable.

3. Re-scan the repo after edits to confirm:
   - no `https://placeholder.convex.cloud` remains except ordinary form placeholders unrelated to Convex
   - no `NEXT_PUBLIC_CONVEX_URL` usage exists
   - Convex initialization is consistently Vite-based

4. Verify with a production build:
   - run `npm run build:prod`

## Dependencies / Considerations

- Do not change business logic, routing, or data flow.
- Do not modify `CONVEX_DEPLOYMENT` behavior for CLI tooling unless the audit shows a direct production bug.
- The frontend and Convex CLI use different env variables for different purposes:
  - frontend runtime: `VITE_CONVEX_URL`
  - Convex CLI/dev tooling: `CONVEX_DEPLOYMENT`

## Risk Handling

- If any file besides [src/App.tsx](file:///home/neeraj/Downloads/enter-NotionOSAIAgentOrchestrator/src/App.tsx) initializes a Convex client, I will align it to the same fail-fast pattern.
- If the build reveals a missing-env compile/runtime assumption, I will keep the fix limited to configuration handling, not application behavior.
