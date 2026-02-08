from uuid import uuid4

import main


class ClaimingCursor:
    def __init__(self, claim_results):
        self._claim_results = claim_results
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, *_args, **_kwargs):
        if "SET slack_post_id" in sql:
            self.rowcount = self._claim_results.pop(0)
        else:
            self.rowcount = 1


class ClaimingConn:
    def __init__(self, claim_results):
        self._claim_results = claim_results

    def cursor(self):
        return ClaimingCursor(self._claim_results)


def test_maybe_post_slack_idempotent(monkeypatch):
    sent = {"count": 0}
    conversation_id = uuid4()

    def fake_send(_payload):
        sent["count"] += 1

    monkeypatch.setattr(main, "send_slack_webhook", fake_send)

    conn_first = ClaimingConn([1])
    main.maybe_post_slack(conn_first, conversation_id, {"summary": "hi"})
    assert sent["count"] == 1

    conn_second = ClaimingConn([0])
    main.maybe_post_slack(conn_second, conversation_id, {"summary": "hi"})
    assert sent["count"] == 1
