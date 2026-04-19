import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { navigate } from "../../app/navigation";
import { useSession } from "../../app/session";
import { sharingClient } from "../../services/sharingClient";
import { setPendingShareToken } from "./shareLinkStorage";

type ShareLinkPageProps = {
  token: string;
};

export function ShareLinkPage({ token }: ShareLinkPageProps) {
  const { session } = useSession();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const acceptAttemptedRef = useRef(false);

  const statusQuery = useQuery({
    queryKey: ["share-link", token],
    queryFn: () => sharingClient.getShareLinkStatus(token),
    retry: false
  });

  const acceptMutation = useMutation({
    mutationFn: () => sharingClient.acceptShareLink(token),
    onSuccess: (payload) => {
      setActionMessage(payload.message);
      navigate(`/documents/${payload.document_id}`, { replace: true });
    },
    onError: (error) => {
      setActionMessage(error instanceof Error ? error.message : "Unable to accept this share link.");
    }
  });

  useEffect(() => {
    if (!session || !statusQuery.data || acceptAttemptedRef.current || acceptMutation.isPending || acceptMutation.isSuccess) {
      return;
    }

    acceptAttemptedRef.current = true;
    acceptMutation.mutate();
  }, [acceptMutation, session, statusQuery.data]);

  if (statusQuery.isLoading) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Share link</span>
            <h1>Checking link</h1>
            <p>Validating the invitation before opening the document.</p>
          </div>
        </div>
      </section>
    );
  }

  if (statusQuery.isError) {
    const message = statusQuery.error instanceof Error ? statusQuery.error.message : "Share link is invalid.";
    return (
      <section className="page-stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Share link</span>
            <h1>Link unavailable</h1>
            <p>{message}</p>
          </div>
        </div>
      </section>
    );
  }

  const shareLink = statusQuery.data;

  if (!shareLink) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Share link</span>
            <h1>Link unavailable</h1>
            <p>Share link data could not be loaded.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Share link</span>
            <h1>Document invitation</h1>
            <p>Sign in or create an account to accept this invitation and open the document.</p>
          </div>
        </div>

        <section className="surface page-stack">
          <div className="inline-actions">
            <span className={`role-badge role-${shareLink.role}`}>{shareLink.role}</span>
            <span className="role-badge">{shareLink.login_required ? "login required" : "open link"}</span>
            <span className="role-badge">{shareLink.multi_use ? "multi use" : "single use"}</span>
          </div>

          <div className="inline-actions">
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setPendingShareToken(token);
                navigate("/login");
              }}
            >
              Login to accept
            </button>
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                setPendingShareToken(token);
                navigate("/register");
              }}
            >
              Register to accept
            </button>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Share link</span>
          <h1>Joining document</h1>
          <p>{acceptMutation.isPending ? "Granting access and opening the document." : "Preparing your document access."}</p>
        </div>
      </div>

      {actionMessage ? <div className="editor-banner editor-banner-success">{actionMessage}</div> : null}
      {acceptMutation.isError ? (
        <div className="editor-banner editor-banner-warning">
          {actionMessage ?? "Unable to accept this share link."}
        </div>
      ) : null}
    </section>
  );
}
