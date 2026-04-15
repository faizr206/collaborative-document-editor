import type { ReactNode } from "react";
import { navigate, useRoute } from "./navigation";
import { useSession } from "./session";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/documents", label: "Documents" },
  { href: "/profile", label: "Profile" }
];

export function AppShell({ children }: AppShellProps) {
  const route = useRoute();
  const { session, logout } = useSession();
  const activePath = route.name === "document" || route.name === "settings" ? "/documents" : `/${route.name}`;
  const immersiveDocumentRoute = route.name === "document";

  if (immersiveDocumentRoute) {
    return <main>{children}</main>;
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button className="brand-lockup" type="button" onClick={() => navigate("/documents")}>
          <span className="brand-mark">CD</span>
          <span className="brand-copy">
            <span className="brand-label">Collaborative Document Editor</span>
            <span className="brand-caption">Frontend final-product shell</span>
          </span>
        </button>

        <nav className="app-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.href}
              className={`nav-chip${activePath === item.href ? " is-active" : ""}`}
              type="button"
              onClick={() => navigate(item.href)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-session">
          {session ? (
            <>
              <div className="session-card">
                <span className="session-label">Signed in</span>
                <strong>{session.user.displayName}</strong>
              </div>
              <button className="secondary-action" type="button" onClick={() => void logout()}>
                Logout
              </button>
            </>
          ) : (
            <button className="primary-action" type="button" onClick={() => navigate("/login")}>
              Login
            </button>
          )}
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
