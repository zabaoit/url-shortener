import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type ShortenResponse = {
  code: string;
  shortUrl: string;
  originalUrl: string;
  expiresAt?: string;
  createdAt?: string;
  clickCount?: number;
};

type StatsResponse = {
  code: string;
  clickCount: number;
  totalEvents: number;
  clicksByDay: Array<{ day: string; clicks: number }>;
};

export function App() {
  const [url, setUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [created, setCreated] = useState<ShortenResponse | null>(null);
  const [statsCode, setStatsCode] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [history, setHistory] = useState<ShortenResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  const codePreview = useMemo(() => created?.code ?? statsCode, [created, statsCode]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const { data } = await api.get<ShortenResponse[]>('/api/links?limit=30');
      setHistory(data);
    } catch {
      // keep UI usable even if history fails
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: any = { url };
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();
      const { data } = await api.post<ShortenResponse>('/api/shorten', payload);
      setCreated(data);
      setStatsCode(data.code);
      setHistory((prev) => [data, ...prev.filter((x) => x.code !== data.code)].slice(0, 30));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  async function onGetStats() {
    if (!statsCode) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get<StatsResponse>(`/api/links/${statsCode}/stats`);
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Stats failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Lịch sử link</h2>
            <button
              onClick={loadHistory}
              disabled={loadingHistory}
              className="rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs disabled:opacity-50"
            >
              {loadingHistory ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>

          <div className="mt-3 max-h-[70vh] overflow-auto space-y-2 pr-1">
            {history.map((item) => (
              <button
                key={item.code}
                onClick={() => setStatsCode(item.code)}
                className="w-full text-left rounded-md border border-slate-700 bg-slate-950/70 p-2 hover:border-sky-600"
              >
                <p className="text-sky-300 font-semibold">/{item.code}</p>
                <p className="text-xs text-slate-300 truncate">{item.originalUrl}</p>
                <a
                  href={item.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-300 underline break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.shortUrl}
                </a>
              </button>
            ))}

            {!history.length && <p className="text-sm text-slate-400">Chưa có short link nào.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-2">
          <h1 className="text-2xl font-bold">URL Shortener (Bitly Clone)</h1>
          <p className="text-slate-400 mt-1">Create short links, redirect fast, track stats.</p>

          <form onSubmit={onCreate} className="mt-4 space-y-3">
            <div>
              <label className="text-sm text-slate-300">Original URL</label>
              <input
                className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2"
                placeholder="https://example.com/very/long/link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Expiration (optional)</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <button
              disabled={loading}
              className="rounded-md bg-orange-500 hover:bg-orange-400 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Create Short Link'}
            </button>
          </form>

          {created && (
            <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/30 p-3">
              <div className="text-sm text-slate-300">Short URL</div>
              <a href={created.shortUrl} target="_blank" className="text-emerald-300 underline break-all" rel="noreferrer">
                {created.shortUrl}
              </a>
            </div>
          )}

          {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
        </section>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-1">
          <h2 className="text-lg font-semibold">Stats</h2>
          <input
            className="mt-2 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2"
            placeholder="short code"
            value={statsCode}
            onChange={(e) => setStatsCode(e.target.value)}
          />
          <button
            onClick={onGetStats}
            disabled={loading || !statsCode}
            className="mt-2 w-full rounded-md bg-sky-600 hover:bg-sky-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Load Stats
          </button>

          {stats && (
            <div className="mt-4 space-y-2 text-sm">
              <p><b>Code:</b> {stats.code}</p>
              <p><b>Click count:</b> {stats.clickCount}</p>
              <p><b>Total events:</b> {stats.totalEvents}</p>
              <div>
                <p className="font-semibold mb-1">Clicks by day</p>
                <ul className="space-y-1 text-slate-300">
                  {stats.clicksByDay?.map((d, i) => <li key={i}>{d.day}: {d.clicks}</li>)}
                </ul>
              </div>
            </div>
          )}

          {!stats && codePreview && <p className="mt-3 text-slate-400 text-sm">Code ready: {codePreview}</p>}
        </aside>
      </div>
    </div>
  );
}
