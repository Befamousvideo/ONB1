import json
from uuid import uuid4

import pytest
from fastapi import HTTPException

import main


def test_next_state_sequence():
    assert main.next_state("WELCOME", {}) == "MODE_SELECT"
    assert main.next_state("MODE_SELECT", {"mode": "staff", "role": "Admin / Ops"}) == "IDENTITY"
    assert main.next_state("MODE_SELECT", {"mode": "prospect"}) == "IDENTITY"
    assert main.next_state("BUSINESS_CONTEXT", {}) == "ARCHETYPE"
    assert main.next_state("ARCHETYPE", {}) == "PAIN_POINTS"
    assert main.next_state("NEEDS", {"skip_scheduling": "true"}) == "SUMMARY"
    assert main.next_state("PAIN_POINTS", {"skip_scheduling": "false"}) == "SCHEDULING"
    assert main.next_state("SUMMARY", {}) == "SUBMIT"
    assert main.next_state("SUBMIT", {}) == "SUBMIT"


def test_canonical_mode_defaults_to_staff():
    assert main.canonical_mode({}) == "staff"
    assert main.canonical_mode("employee") == "staff"
    assert main.canonical_mode("staff") == "staff"
    assert main.canonical_mode({"mode": "prospect"}) == "prospect"


def test_staff_ceo_prompts_differ_from_prospect_ceo():
    staff = main.prompt_for_state("T_OK", {"mode": "staff", "role": "staff_ceo", "invite": "exec"})
    prospect = main.prompt_for_state("SUBMIT", {"mode": "prospect", "role": "Owner / CEO"})
    assert "ROIA" in staff
    assert "Automation ROI Analysis" in prospect
    assert staff != prospect
    assert "prospect" not in staff.lower()


def test_mode_select_accepts_role_or_mode():
    main.validate_required_fields("MODE_SELECT", {"role": "Sales"})
    main.validate_required_fields("MODE_SELECT", {"mode": "staff"})
    main.validate_required_fields("MODE_SELECT", {"mode": "prospect"})
    with pytest.raises(HTTPException) as excinfo:
        main.validate_required_fields("MODE_SELECT", {})
    assert excinfo.value.detail["fields"] == ["role"]


def test_staff_identity_work_phone_is_role_gated():
    main.validate_required_fields(
        "IDENTITY",
        {
            "mode": "staff",
            "role": "staff_admin",
            "full_name": "Ada",
            "email": "ada@example.com",
            "work_phone": "555-0100",
        },
    )
    aliased = {
        "mode": "staff",
        "role": "Admin / Ops",
        "full_name": "Ada",
        "email": "ada@example.com",
        "phone": "555-0199",
    }
    main.validate_required_fields("IDENTITY", aliased)
    assert aliased["work_phone"] == "555-0199"
    main.validate_required_fields(
        "IDENTITY",
        {"mode": "staff", "role": "staff_foh", "full_name": "Pat", "email": "pat@example.com"},
    )
    with pytest.raises(HTTPException) as excinfo:
        main.validate_required_fields(
            "IDENTITY",
            {"mode": "staff", "role": "staff_admin", "full_name": "Ada", "email": "ada@example.com"},
        )
    assert excinfo.value.detail["fields"] == ["work_phone"]


def test_prospect_identity_phone_optional():
    main.validate_required_fields(
        "IDENTITY",
        {"mode": "prospect", "full_name": "Bea", "email": "bea@example.com"},
    )


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


def test_end_and_send_staff_hq_requires_work_phone(monkeypatch):
    conversation_id = uuid4()
    row = {
        "id": conversation_id,
        "state": "SUMMARY",
        "normalized_fields": json.dumps(
            {
                "mode": "staff",
                "staff_role": "staff_admin",
                "full_name": "Ada",
                "email": "ada@example.com",
                "client_invoice_id": "red-o/202609-22-RED-111",
            }
        ),
    }

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            raise AssertionError("should fail before cursor work")

    monkeypatch.setattr(main, "get_conn", lambda: FakeConn())
    monkeypatch.setattr(main, "fetch_conversation", lambda *_a, **_k: row)

    with pytest.raises(HTTPException) as excinfo:
        main.end_and_send(conversation_id, payload=main.EndAndSendRequest(summary="Done"), request=None)
    assert excinfo.value.detail["fields"] == ["work_phone"]


def test_end_and_send_forces_submit(monkeypatch):
    conversation_id = uuid4()
    old_row = {
        "id": conversation_id,
        "state": "NEEDS",
        "normalized_fields": json.dumps(
            {
                "summary": "Draft",
                "mode": "staff",
                "full_name": "Ada",
                "email": "ada@example.com",
                "work_phone": "555-0100",
            }
        ),
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
