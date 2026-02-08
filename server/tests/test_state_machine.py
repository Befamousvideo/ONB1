import json
from uuid import uuid4

import pytest
from fastapi import HTTPException

import main


def test_next_state_sequence():
    assert main.next_state("WELCOME", {}) == "MODE_SELECT"
    assert main.next_state("MODE_SELECT", {"mode": "client"}) == "SUBMIT"
    assert main.next_state("NEEDS", {"skip_scheduling": "true"}) == "SUMMARY"
    assert main.next_state("NEEDS", {"skip_scheduling": "false"}) == "SCHEDULING"
    assert main.next_state("SUMMARY", {}) == "SUBMIT"
    assert main.next_state("SUBMIT", {}) == "SUBMIT"


def test_validate_required_fields_scheduling():
    main.validate_required_fields("SCHEDULING", {"scheduling_option": "link"})
    main.validate_required_fields(
        "SCHEDULING", {"preferred_times": "tomorrow", "timezone": "America/Los_Angeles"}
    )

    with pytest.raises(HTTPException) as excinfo:
        main.validate_required_fields("SCHEDULING", {"preferred_times": "tomorrow"})
    detail = excinfo.value.detail
    assert detail["error"] == "missing_fields"
    assert "timezone" in detail["fields"]


def test_end_and_send_forces_submit(monkeypatch):
    conversation_id = uuid4()
    old_row = {
        "id": conversation_id,
        "state": "NEEDS",
        "normalized_fields": json.dumps({"summary": "Draft"}),
    }
    updated_row = {
        "id": conversation_id,
        "state": "SUBMIT",
        "normalized_fields": json.dumps({"summary": "Done"}),
    }
    fetch_rows = [old_row, updated_row]

    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, *_args, **_kwargs):
            return None

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return FakeCursor()

    def fake_fetch(_conn, _id):
        return fetch_rows.pop(0)

    calls = {"slack": 0, "audit": 0}

    monkeypatch.setattr(main, "get_conn", lambda: FakeConn())
    monkeypatch.setattr(main, "fetch_conversation", fake_fetch)
    monkeypatch.setattr(main, "persist_intake_brief", lambda *_a, **_k: uuid4())
    monkeypatch.setattr(main, "persist_attachments", lambda *_a, **_k: None)
    monkeypatch.setattr(
        main, "log_audit", lambda *_a, **_k: calls.__setitem__("audit", calls["audit"] + 1)
    )
    monkeypatch.setattr(
        main, "maybe_post_slack", lambda *_a, **_k: calls.__setitem__("slack", calls["slack"] + 1)
    )
    monkeypatch.setattr(main, "to_conversation_model", lambda row: row)

    response = main.end_and_send(
        conversation_id, payload=main.EndAndSendRequest(summary="Done"), request=None
    )

    assert response["state"] == "SUBMIT"
    assert calls["slack"] == 1
    assert calls["audit"] == 1
