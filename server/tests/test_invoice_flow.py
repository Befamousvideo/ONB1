from uuid import uuid4

import main


class ScriptedCursor:
    def __init__(self, fetches):
        self._fetches = list(fetches)
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, *_args, **_kwargs):
        self.rowcount = 1

    def fetchone(self):
        if self._fetches:
            return self._fetches.pop(0)
        return None


class ScriptedConn:
    def __init__(self, scripts):
        self._scripts = list(scripts)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        fetches = self._scripts.pop(0) if self._scripts else []
        return ScriptedCursor(fetches)


def test_approve_estimate_idempotent(monkeypatch):
    estimate_id = uuid4()
    invoice_id = uuid4()
    estimate_row = {
        "id": estimate_id,
        "request_id": uuid4(),
        "amount_cents": 10000,
        "currency": "usd",
        "status": "draft",
        "project_id": uuid4(),
        "account_id": uuid4(),
        "account_name": "Demo",
    }
    existing_invoice = {
        "id": invoice_id,
        "provider_invoice_id": "inv_123",
        "provider_invoice_url": "https://stripe.example/inv_123",
    }
    conn = ScriptedConn([[estimate_row, existing_invoice]])

    monkeypatch.setattr(main, "get_conn", lambda: conn)
    monkeypatch.setattr(
        main,
        "create_stripe_draft_invoice",
        lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("should not be called")),
    )

    response = main.approve_estimate(estimate_id)
    assert response.invoice_id == invoice_id


def test_approve_estimate_creates_invoice(monkeypatch):
    estimate_id = uuid4()
    invoice_id = uuid4()
    estimate_row = {
        "id": estimate_id,
        "request_id": uuid4(),
        "amount_cents": 25000,
        "currency": "usd",
        "status": "draft",
        "project_id": uuid4(),
        "account_id": uuid4(),
        "account_name": "Demo",
    }
    conn = ScriptedConn([[estimate_row, None], [{"id": invoice_id}]])

    monkeypatch.setattr(main, "get_conn", lambda: conn)
    monkeypatch.setattr(
        main,
        "create_stripe_draft_invoice",
        lambda *_a, **_k: {
            "provider": "stripe",
            "provider_invoice_id": "inv_999",
            "provider_invoice_url": "https://stripe.example/inv_999",
        },
    )

    response = main.approve_estimate(estimate_id)
    assert response.invoice_id == invoice_id
    assert response.provider_invoice_id == "inv_999"


def test_send_invoice_already_sent(monkeypatch):
    invoice_id = uuid4()
    invoice_row = {
        "id": invoice_id,
        "provider_invoice_id": "inv_123",
        "provider_invoice_url": "https://stripe.example/inv_123",
        "sent_at": "2024-01-01T00:00:00Z",
        "estimate_id": uuid4(),
        "project_id": uuid4(),
        "slack_ts": None,
        "request_id": None,
        "account_id": uuid4(),
    }
    conn = ScriptedConn([[invoice_row]])

    monkeypatch.setattr(main, "get_conn", lambda: conn)
    monkeypatch.setattr(
        main,
        "get_stripe_client",
        lambda: (_ for _ in ()).throw(AssertionError("stripe should not be called")),
    )

    response = main.send_invoice(invoice_id)
    assert response.status == "already_sent"


def test_send_invoice_sends_once(monkeypatch):
    invoice_id = uuid4()
    invoice_row = {
        "id": invoice_id,
        "provider_invoice_id": "inv_123",
        "provider_invoice_url": "https://stripe.example/inv_123",
        "sent_at": None,
        "estimate_id": uuid4(),
        "project_id": uuid4(),
        "slack_ts": "123.456",
        "request_id": uuid4(),
        "account_id": uuid4(),
    }
    conn = ScriptedConn([[invoice_row], []])

    sent = {"count": 0}

    class FakeStripeInvoice:
        @staticmethod
        def send_invoice(_invoice_id):
            sent["count"] += 1

    class FakeStripeClient:
        Invoice = FakeStripeInvoice

    monkeypatch.setattr(main, "get_conn", lambda: conn)
    monkeypatch.setattr(main, "get_stripe_client", lambda: FakeStripeClient())
    monkeypatch.setattr(main, "post_request_update", lambda *_a, **_k: None)

    response = main.send_invoice(invoice_id)
    assert response.status == "sent"
    assert sent["count"] == 1
