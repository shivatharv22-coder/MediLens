/** Shared typography for the legal and help pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="card space-y-4 p-5 text-sm leading-relaxed text-ink-700 [&_h2]:mt-6 [&_h2]:text-base
                 [&_h2]:font-semibold [&_h2]:text-ink-900 [&_h2:first-child]:mt-0
                 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink-900
                 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5
                 [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2"
    >
      {children}
    </div>
  );
}

export function LastUpdated({ date }: { date: string }) {
  return <p className="text-xs text-ink-500">Last updated: {date}</p>;
}
