import Link from "next/link";

export default function LocalQuarantinePage() {
  return (
    <main className="page-shell">
      <section className="conversation-panel">
        <p className="eyebrow">Quarantined</p>
        <h1 className="panel-title">/local is not the discovery UI</h1>
        <p className="muted-copy">
          The old Pages Router tools page talked to a stale API contract and could shadow the App Router
          home page. Use the home page for ROIA discovery, and <code>scripts/smoke.sh</code> for the local
          API smoke.
        </p>
        <p>
          <Link className="primary-button" href="/">
            Go to discovery
          </Link>
        </p>
      </section>
    </main>
  );
}
