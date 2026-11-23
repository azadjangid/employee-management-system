import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load data from the API and track loading / error state.
 *
 *   const { data, meta, loading, error, reload } = useApiQuery(
 *     (signal) => api.get("/employees", { search }, { signal }),
 *     [search]
 *   );
 *
 * `fetcher` gets an AbortSignal; a newer request cancels the previous one.
 * Pass `enabled: false` to skip loading (e.g. until a filter is chosen).
 */
export function useApiQuery(fetcher, deps, { enabled = true } = {}) {
  const [version, setVersion] = useState(0);
  // Identifies the current request; deps must be plain values (strings, numbers...).
  const key = JSON.stringify([deps, version]);
  const [result, setResult] = useState({ key: null, data: undefined, meta: undefined, error: null });

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((res) => setResult({ key, data: res?.data, meta: res?.meta, error: null }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setResult((prev) => ({ ...prev, key, error: err }));
      });
    return () => controller.abort();
  }, [key, enabled]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (updater) =>
      setResult((prev) => ({
        ...prev,
        data: typeof updater === "function" ? updater(prev.data) : updater,
      })),
    []
  );

  return {
    data: result.data,
    meta: result.meta,
    error: result.error,
    // Still loading until the response for the current key arrives.
    loading: enabled && result.key !== key,
    reload,
    setData,
  };
}

/** Debounce a fast-changing value (e.g. a search box). */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Run a mutation (create / update / delete) and track its pending + error state.
 *   const save = useMutation((body) => api.post("/employees", body));
 *   await save.run(form);   // throws on error, also sets save.error
 */
export function useMutation(fn) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (...args) => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, reset: () => setError(null) };
}
