import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "../../app/session";
import { profileClient } from "../../services/profileClient";

export function ProfilePage() {
  const { session } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileClient.get(session),
    enabled: Boolean(session)
  });

  const saveMutation = useMutation({
    mutationFn: () => profileClient.save({ displayName, avatarUrl })
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setDisplayName(profileQuery.data.displayName);
    setAvatarUrl(profileQuery.data.avatarUrl);
  }, [profileQuery.data]);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Profile</span>
          <h1>Account preferences</h1>
          <p>Local profile controls are separated from session auth so future `/users/me` integration is isolated.</p>
        </div>
      </div>

      <section className="surface profile-card">
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>

        <label className="field">
          <span>Avatar URL</span>
          <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
        </label>

        <div className="inline-actions">
          <button className="primary-action" type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save profile"}
          </button>
          {saveMutation.isSuccess ? <span className="helper-copy">Saved to frontend profile storage.</span> : null}
        </div>
      </section>
    </section>
  );
}
