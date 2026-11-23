import { api } from "../lib/api";
import { useApiQuery } from "./useApi";

/** Department list for filters and dropdowns. */
export function useDepartments() {
  const { data, loading, error, reload } = useApiQuery(
    (signal) => api.get("/departments", undefined, { signal }),
    []
  );
  return { departments: data ?? [], loading, error, reload };
}

/** Employees the current user can pick from (admins/managers), for "on behalf of" fields. */
export function useEmployeeOptions(enabled = true) {
  const { data, loading } = useApiQuery(
    (signal) => api.get("/employees", { limit: 100, status: undefined }, { signal }),
    [],
    { enabled }
  );
  return { employees: data ?? [], loading };
}
