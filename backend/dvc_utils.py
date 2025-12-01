import subprocess
from pathlib import Path
from typing import List, Optional

class DVCManager:
    """Wrapper for DVC commands"""
    
    def __init__(self, repo_dir: Path):
        self.repo_dir = repo_dir
    
    def _run_dvc(self, args: List[str]) -> bool:
        try:
            subprocess.run(
                ["dvc"] + args,
                cwd=self.repo_dir,
                check=True,
                capture_output=True
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"DVC Error: {e.stderr.decode()}")
            return False
    
    def init(self) -> bool:
        """Initialize DVC"""
        return self._run_dvc(["init", "--subdir"])
    
    def add(self, path: str) -> bool:
        """Add file/directory to DVC"""
        return self._run_dvc(["add", path])
    
    def push(self) -> bool:
        """Push to remote storage"""
        return self._run_dvc(["push"])
    
    def pull(self) -> bool:
        """Pull from remote storage"""
        return self._run_dvc(["pull"])
    
    def commit(self, message: str) -> bool:
        """Commit DVC changes to Git"""
        # This assumes DVC files are staged and committed to git
        # For now, we just run dvc commit if needed, but usually dvc add is enough
        return self._run_dvc(["commit", "-m", message])
