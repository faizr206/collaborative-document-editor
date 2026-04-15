import { AppShell } from "./AppShell";
import { navigate, useRoute } from "./navigation";
import { useSession } from "./session";
import { AuthPage } from "../features/auth/AuthPage";
import { DocumentsDashboardPage } from "../features/documents/DocumentsDashboardPage";
import { DocumentWorkspacePage } from "../features/editor/DocumentWorkspacePage";
import { DocumentSettingsPage } from "../features/settings/DocumentSettingsPage";
import { ProfilePage } from "../features/profile/ProfilePage";

export function AppRouter() {
  const route = useRoute();
  const { session, isBootstrapping } = useSession();

  if (isBootstrapping) {
    return <div className="boot-screen">Loading workspace...</div>;
  }

  if (!session) {
    if (route.name !== "login" && route.name !== "register") {
      navigate("/login", { replace: true });
      return <div className="boot-screen">Redirecting to login...</div>;
    }

    return <AuthPage mode={route.name === "register" ? "register" : "login"} />;
  }

  if (route.name === "login" || route.name === "register") {
    navigate("/documents", { replace: true });
    return <div className="boot-screen">Redirecting to documents...</div>;
  }

  return (
    <AppShell>
      {route.name === "documents" ? <DocumentsDashboardPage /> : null}
      {route.name === "document" ? <DocumentWorkspacePage documentId={route.documentId} /> : null}
      {route.name === "settings" ? <DocumentSettingsPage documentId={route.documentId} /> : null}
      {route.name === "profile" ? <ProfilePage /> : null}
    </AppShell>
  );
}
