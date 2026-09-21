import Link from "next/link";

export default function LocalQuarantinePage() {
  return (
    <main className="page-shell">
      <section className="conversation-panel">
        <p className="eyebrow">Quarantined</p>
        <h1 className="panel-title">/local is not the intake UI</h1>
        <p className="muted-copy">
          The old Pages Router tools page talked to a stale API contract and could shadow the App Router
          intake. Use the home page for prospect intake, and <code>scripts/smoke.sh</code> for the local
          API smoke.
        </p>
        <p>
          <Link className="primary-button" href="/">
            Go to intake
          </Link>
        </p>
      </section>
    </main>
  );
}
