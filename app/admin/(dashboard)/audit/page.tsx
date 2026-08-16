import { ADMIN_PAGE_SIZE } from '@/config/app';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { requireDb } from '@/lib/db';
import { formatDateTime } from '@/utils/format';

export const dynamic = 'force-dynamic';

/** Append-only audit trail. There is no UI, and no API, that edits it. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const db = requireDb();

  const [total, entries] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">Audit log</h1>
      <p className="text-sm text-ink-600">
        {total} entries. Entries never contain medical content or credentials.
      </p>

      {entries.length === 0 ? (
        <EmptyState title="No audit entries yet." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-ink-500">
              <tr>
                <th scope="col" className="p-3">When</th>
                <th scope="col" className="p-3">Action</th>
                <th scope="col" className="p-3">Actor</th>
                <th scope="col" className="p-3">Entity</th>
                <th scope="col" className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-3 whitespace-nowrap text-xs text-ink-500">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="p-3">
                    <Badge tone={entry.action === 'LOGIN_FAILED' ? 'danger' : 'neutral'}>
                      {entry.action}
                    </Badge>
                  </td>
                  <td className="p-3 text-ink-700">{entry.actorEmail ?? '—'}</td>
                  <td className="p-3 text-xs text-ink-600">
                    {entry.entityType ?? '—'}
                    {entry.entityId && <span className="block text-ink-400">{entry.entityId}</span>}
                  </td>
                  <td className="p-3 text-xs text-ink-600">
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <a
            href={`?page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className="text-sm text-brand-700 underline aria-disabled:pointer-events-none aria-disabled:text-ink-400"
          >
            Previous
          </a>
          <span className="text-sm text-ink-600">
            {page} / {totalPages}
          </span>
          <a
            href={`?page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
            className="text-sm text-brand-700 underline aria-disabled:pointer-events-none aria-disabled:text-ink-400"
          >
            Next
          </a>
        </nav>
      )}
    </div>
  );
}
