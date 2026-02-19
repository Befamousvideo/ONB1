from fastapi import FastAPI

app = FastAPI(
    title="ONB1 API",
    version="0.0.1",
    description="Bootstrap FastAPI service for ONB1.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
