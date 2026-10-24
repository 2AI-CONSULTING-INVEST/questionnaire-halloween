"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withBase } from "@/lib/base-path";
import { PAGE_SIZE, type Page } from "@/lib/paging";

export { PAGE_SIZE };

/**
 * Liste paginée par curseur (100 par page) d'une route admin : première page à chaque changement
 * de paramètres, « charger 100 de plus », et, à chaque actualisation (`tick`), rechargement des
 * pages déjà affichées sans perdre le filtre ni le défilement.
 */
export function usePage<T>(path: string, params: Record<string, string>, tick: number) {
  const [page, setPage] = useState<Page<T>>({ rows: [], nextCursor: null, total: 0 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = new URLSearchParams(params).toString();
  const shown = useRef(0);
  const prevKey = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<Page<T>> => {
      const qs = new URLSearchParams(key);
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(withBase(`${path}?${qs}`), { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      return res.json();
    },
    [path, key],
  );

  useEffect(() => {
    const count = prevKey.current === key ? Math.max(shown.current, PAGE_SIZE) : PAGE_SIZE;
    prevKey.current = key;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const rows: T[] = [];
        let cursor: string | null = null;
        let total = 0;
        do {
          const p: Page<T> = await fetchPage(cursor);
          rows.push(...p.rows);
          cursor = p.nextCursor;
          total = p.total;
        } while (cursor && rows.length < count);
        if (cancelled) return;
        shown.current = rows.length;
        setPage({ rows, nextCursor: cursor, total });
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [key, tick, fetchPage]);

  const loadMore = useCallback(async () => {
    const cursor = page.nextCursor;
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const p = await fetchPage(cursor);
      shown.current += p.rows.length;
      setPage((prev) => ({ rows: [...prev.rows, ...p.rows], nextCursor: p.nextCursor, total: p.total }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [page.nextCursor, loading, fetchPage]);

  return { ...page, loading, failed, loadMore };
}
