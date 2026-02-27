"""
Local development entry point.

Run with:
    cd agent
    pip install -r requirements.txt
    uvicorn src.main:app --reload --port 8001
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
    )
