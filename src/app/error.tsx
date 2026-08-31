"use client";

// Without this, any render throw in the board — 1,200 lines of client component
// over upstream data — was a permanent white screen with no way back. Next
// needs a client component here; it cannot be a server one.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold tracking-tight">
        The board stopped loading
      </h1>
      <p className="text-sm text-muted">
        Something broke on our side, not with your search. Trying again usually
        works.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
      >
        Try again
      </button>
      {/* The digest is what makes a report traceable in the server logs; the
          message itself never reaches the user. */}
      {error.digest && (
        <p className="text-[11px] text-muted">Reference: {error.digest}</p>
      )}
    </main>
  );
}
