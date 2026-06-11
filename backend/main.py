from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from virtual_fs.core import VirtualFileSystem

app = FastAPI(title="Linux Academy Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global VFS instance — one per session
vfs = VirtualFileSystem()

class CommandRequest(BaseModel):
    command: str

@app.post("/api/execute")
async def execute_command(req: CommandRequest):
    result = vfs.execute(req.command)
    result["pwd"] = vfs.pwd_path
    result["contents"] = [
        {"name": name, "is_dir": node.is_dir}
        for name, node in vfs.current_dir.children.items()
    ]
    return result

@app.post("/api/reset")
async def reset_game():
    """Reset the VFS to initial state for a new game."""
    global vfs
    vfs = VirtualFileSystem()
    return {"status": "success", "message": "VFS reset"}

@app.get("/api/health")
async def health():
    return {"status": "ok", "pwd": vfs.pwd_path}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
