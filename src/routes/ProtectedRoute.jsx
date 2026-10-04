import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute() {
  const authData = localStorage.getItem(
    "employeehub_auth"
  );

  let isAuthenticated = false;

  try {
    const parsedData = JSON.parse(authData);

    isAuthenticated =
      parsedData?.isAuthenticated === true;
  } catch {
    isAuthenticated = false;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;