import json

import pytest
from fastapi import HTTPException

import main
import staff_packs


def test_pack_document_is_v12():
    doc = staff_packs.load_pack_document()
    assert doc["version"] == "1.2.0"
    assert doc["invitePolicy"]["doNotSend"] is True
    assert doc["invitePolicy"]["staff_ceo"] == "execOnly"
    assert doc["quotePolicy"]["default"] == "named"
    assert doc["quotePolicy"]["anonymousKeepsRole"] is True
    assert doc["staffLinkPolicy"]["alwaysCarryClientInvoiceId"] is True


def test_catalog_encodes_all_packs_and_vince_locations():
    catalog = staff_packs.catalog()
    ids = [pack["id"] for pack in catalog["packs"]]
    assert ids == [
        "staff_ceo",
        "staff_hr",
        "staff_sales",
        "staff_finance",
        "staff_admin",
        "staff_foh",
        "staff_boh",
        "staff_other",
    ]
    assert "Fashion Island" in catalog["locations"]
    assert "Santa Monica" in catalog["locations"]
    assert "Westlake" in catalog["locations"]
    assert any("Irvine HQ" in item for item in catalog["locations"])
    assert "Other" in catalog["locations"]
    assert catalog["locationLock"] == [
        "Fashion Island",
        "Santa Monica",
        "Westlake",
        "Irvine HQ",
        "Other",
    ]
    ceo = next(pack for pack in catalog["packs"] if pack["id"] == "staff_ceo")
    assert ceo["invitePath"] == "execOnly"
    assert ceo["onAllStaffLinks"] is False
    assert catalog["doNotSend"] is True
    assert catalog["invitePolicy"]["softLaunchRoles"] == [
        "staff_ceo",
        "staff_admin",
        "staff_foh",
        "staff_boh",
    ]


def test_each_pack_is_loadable():
    for role in staff_packs.encode_all_roles():
        detail = staff_packs.pack_detail(role)
        assert detail["id"] == role
        assert detail["entryNode"]
        assert any(node["id"] == detail["entryNode"] for node in detail["nodes"])


def test_work_phone_role_gate():
    assert staff_packs.work_phone_required("staff_admin") is True
    assert staff_packs.work_phone_required("staff_ceo") is True
    assert staff_packs.work_phone_required("staff_other") is True
    assert staff_packs.work_phone_required("staff_foh") is False
    assert staff_packs.work_phone_required("staff_boh") is False
    assert staff_packs.work_phone_required("") is False


def test_general_invite_hides_ceo_and_rejects_ceo_answer():
    fields = staff_packs.start_staff_session({"mode": "staff", "client_id": "red-o", "invoice_id": "202609-22-RED-111"})
    options = staff_packs.q4_options_for_invite(fields)
    assert "staff_ceo" not in [item["value"] for item in options]
    with pytest.raises(HTTPException) as excinfo:
        staff_packs.apply_staff_step("Q4", fields, {"role": "staff_ceo"}, "staff_ceo")
    assert excinfo.value.detail["error"] == "staff_ceo_exec_only"


def test_exec_invite_locks_ceo_and_skips_q4():
    fields = staff_packs.start_staff_session(
        {
            "mode": "staff",
            "invite": "exec",
            "client_id": "red-o",
            "invoice_id": "202609-22-RED-111",
        }
    )
    assert fields["staff_role"] == "staff_ceo"
    assert fields["invite"] == "exec"
    fields["full_name"] = "Ada"
    fields["email"] = "ada@example.com"
    fields["work_phone"] = "555-0100"
    fields["company_location"] = "Irvine HQ / corporate"
    nxt, fields = staff_packs.apply_staff_step("Q3", fields, {"answer": "Irvine HQ / corporate"}, "Irvine HQ / corporate")
    assert nxt == "Q4c"
    nxt, fields = staff_packs.apply_staff_step("Q4c", fields, {}, "")
    assert nxt == "CEO-P1"
    assert fields["anonymity"] == "named"


def test_staff_links_always_carry_client_invoice():
    fields = staff_packs.start_staff_session({"mode": "staff"})
    assert fields["client_id"] == "red-o"
    assert fields["invoice_id"] == "202609-22-RED-111"
    assert fields["client_invoice_id"] == "red-o/202609-22-RED-111"
    url = staff_packs.staff_link_url(fields)
    assert "client=red-o" in url
    assert "invoice=202609-22-RED-111" in url
    assert "clientInvoiceId=red-o/202609-22-RED-111" in url


def test_quote_opt_in_anonymous_keeps_role():
    fields = staff_packs.start_staff_session(
        {"mode": "staff", "pack": "staff_admin", "client_id": "red-o", "invoice_id": "202609-22-RED-111"}
    )
    nxt, fields = staff_packs.apply_staff_step(
        "Q4c",
        fields,
        {"anonymity": "anonymous_keep_role"},
        "Role + location only (no name)",
    )
    assert nxt == "ADMIN-P1"
    assert fields["anonymity"] == "anonymous_keep_role"
    assert fields["staff_role"] == "staff_admin"
    export = staff_packs.nora_export(fields)
    assert export["anonymity"] == "anonymous_keep_role"
    assert export["anonymous_keeps_role"] is True


def test_export_contract_on_paragraph():
    fields = staff_packs.start_staff_session(
        {"mode": "staff", "invite": "exec", "client_id": "red-o", "invoice_id": "202609-22-RED-111"}
    )
    fields["company_location"] = "Fashion Island"
    fields["anonymity"] = "named"
    nxt, fields = staff_packs.apply_staff_step(
        "CEO-P2",
        fields,
        {"answer": "Margin is late and I distrust last week's export."},
        "Margin is late and I distrust last week's export.",
    )
    assert nxt == "CEO-P3"
    export = staff_packs.nora_export(fields)
    quote = export["staff_quotes"][0]
    assert set(quote) == {"speaker_role", "quote_text", "location", "anonymity", "node_id", "lens"}
    assert quote["speaker_role"] == "staff_ceo"
    assert quote["location"] == "Fashion Island"
    assert quote["node_id"] == "CEO-P2"
    assert "$" not in quote["quote_text"]


def test_sys_product_name_required():
    fields = staff_packs.start_staff_session({"mode": "staff", "pack": "staff_admin"})
    with pytest.raises(HTTPException) as excinfo:
        staff_packs.apply_staff_step("ADMIN-SYS", fields, {"answer": "Email"}, "Email")
    assert excinfo.value.detail["error"] == "product_name_required"
    nxt, fields = staff_packs.apply_staff_step(
        "ADMIN-SYS",
        fields,
        {"answer": "Email", "product_names": {"Email": "Outlook"}},
        "Email",
    )
    assert nxt == "ADMIN-X1"
    stack = staff_packs.nora_export(fields)["software_stack"]
    assert stack[0]["productName"] == "Outlook"


def test_create_staff_conversation_starts_pack_q1():
    conversation = main.create_conversation(
        main.CreateConversationRequest(
            mode="staff",
            client_id="red-o",
            invoice_id="202609-22-RED-111",
        )
    )
    assert conversation["state"] == "Q1"
    assert conversation["current_node"]["id"] == "Q1"
    assert "not a performance review" in conversation["current_node"]["prompt"].lower()
    assert conversation["staff_link"]["client_invoice_id"] == "red-o/202609-22-RED-111"
    assert conversation["staff_link"]["do_not_send"] is True
    assert conversation["pack_version"] == "1.2.0"


def test_foh_can_advance_and_submit_without_work_phone():
    conversation = main.create_conversation(
        main.CreateConversationRequest(
            mode="staff",
            pack="staff_foh",
            client_id="red-o",
            invoice_id="202609-22-RED-111",
        )
    )
    conversation = main.create_conversation_message(
        conversation["id"],
        main.CreateMessageRequest(content="Begin discovery", fields={}),
    )
    assert conversation["state"] == "Q2"
    conversation = main.create_conversation_message(
        conversation["id"],
        main.CreateMessageRequest(
            content="Pat | pat@example.com",
            fields={"full_name": "Pat", "email": "pat@example.com"},
        ),
    )
    assert conversation["state"] == "Q3"
    assert not conversation["normalized_fields"].get("work_phone")
    ended = main.end_and_send(
        conversation["id"],
        payload=main.EndAndSendRequest(summary="FOH notes"),
        request=None,
    )
    assert ended["state"] == "SUBMIT"
    assert ended["intake_brief"]["do_not_send"] is True
    assert ended["intake_brief"]["client_invoice_id"] == "red-o/202609-22-RED-111"


def test_hq_admin_submit_still_requires_work_phone():
    conversation = main.create_conversation(
        main.CreateConversationRequest(
            mode="staff",
            pack="staff_admin",
            client_id="red-o",
            invoice_id="202609-22-RED-111",
        )
    )
    main.create_conversation_message(
        conversation["id"],
        main.CreateMessageRequest(content="Begin discovery", fields={}),
    )
    with pytest.raises(HTTPException) as excinfo:
        main.create_conversation_message(
            conversation["id"],
            main.CreateMessageRequest(
                content="Ada | ada@example.com",
                fields={"full_name": "Ada", "email": "ada@example.com"},
            ),
        )
    assert excinfo.value.detail["fields"] == ["work_phone"]
