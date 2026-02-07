from fastapi import FastAPI

app = FastAPI(title="ONB1 API")

@app.get("/health")
def health():
    return {"status": "ok"}
