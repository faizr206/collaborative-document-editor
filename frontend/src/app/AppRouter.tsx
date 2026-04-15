import { AuthPage } from "../features/auth/AuthPage";

export function AppRouter() {
  const path = window.location.pathname.toLowerCase();

  if (path === "/register") {
    return <AuthPage mode="register" />;
  }

  return <AuthPage mode="login" />;
}