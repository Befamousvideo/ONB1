from fastapi.testclient import TestClient

import main


def test_preflight_allows_local_port_3001():
    client = TestClient(main.app)

    response = client.options(
        "/api/conversations",
        headers={
            "Origin": "http://localhost:3001",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3001"
