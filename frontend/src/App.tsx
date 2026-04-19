import { useEffect } from "react";
import { AppShell } from "./app/AppShell";
import { SessionProvider, useSession } from "./app/session";
import { navigate, useRoute } from "./app/navigation";
import { AuthPage } from "./features/auth/AuthPage";
import { DocumentsDashboardPage } from "./features/documents/DocumentsDashboardPage";
import { DocumentWorkspacePage } from "./features/editor/DocumentWorkspacePage";
import { DocumentSettingsPage } from "./features/settings/DocumentSettingsPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { ShareLinkPage } from "./features/settings/ShareLinkPage";
import { getPendingShareToken } from "./features/settings/shareLinkStorage";

function AppContent() {
  const route = useRoute();
  const { session, isBootstrapping } = useSession();
  const isAuthRoute = route.name === "login" || route.name === "register";
  const isPublicRoute = isAuthRoute || route.name === "share";

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (!session && !isPublicRoute) {
      navigate("/login", { replace: true });
      return;
    }

    if (session && isAuthRoute && !getPendingShareToken()) {
      navigate("/documents", { replace: true });
    }
  }, [isAuthRoute, isBootstrapping, isPublicRoute, session]);

  if (isBootstrapping) {
    return <main className="auth-page">Loading workspace...</main>;
  }

  if (!session) {
    if (route.name === "share") {
      return <ShareLinkPage token={route.token} />;
    }

    return <AuthPage mode={route.name === "register" ? "register" : "login"} />;
  }

  let page;

  switch (route.name) {
    case "document":
      page = <DocumentWorkspacePage documentId={route.documentId} />;
      break;
    case "settings":
      page = <DocumentSettingsPage documentId={route.documentId} />;
      break;
    case "profile":
      page = <ProfilePage />;
      break;
    case "share":
      page = <ShareLinkPage token={route.token} />;
      break;
    default:
      page = <DocumentsDashboardPage />;
      break;
  }

  return <AppShell>{page}</AppShell>;
}

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
