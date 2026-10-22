"""Safe installer checks; never installs packages or starts services."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
INSTALLER = ROOT / "scripts/instalar-vps.sh"


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / "project"
        (self.project / "scripts").mkdir(parents=True)

    def run_check(self):
        return subprocess.run(
            ["bash", str(INSTALLER), "--check", str(self.project)],
            text=True, capture_output=True,
            env={k: v for k, v in os.environ.items() if not k.startswith("VITE_SUPABASE_")},
        )

    def prepare_project(self):
        (self.project / "package.json").write_text("{}")
        (self.project / "vite.config.ts").write_text("export default {}")
        shutil.copy(ROOT / "scripts/ecosystem.config.cjs", self.project / "scripts")

    def test_missing_project_stops_before_installing(self):
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("projeto completo", result.stderr)

    def test_missing_env_stops_before_installing(self):
        self.prepare_project()
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Falta o arquivo .env", result.stderr)

    def test_incomplete_cloud_config_is_rejected(self):
        self.prepare_project()
        (self.project / ".env").write_text("VITE_SUPABASE_URL=...\n")
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ausentes ou incompletas", result.stderr)

    def test_pm2_uses_loopback_and_public_key_fallback(self):
        self.prepare_project()
        (self.project / ".env").write_text(
            "VITE_SUPABASE_URL=https://example.invalid\n"
            "VITE_SUPABASE_PUBLISHABLE_KEY=public-test-key\n"
            "VITE_SUPABASE_PROJECT_ID=test-project\n"
        )
        env = {k: v for k, v in os.environ.items() if not (
            k.startswith("SUPABASE_") or k.startswith("VITE_SUPABASE_") or k == "LOVABLE_API_KEY"
        )}
        result = subprocess.run([
            "node", "-e",
            "console.log(JSON.stringify(require(process.argv[1]).apps[0]))",
            str(self.project / "scripts/ecosystem.config.cjs"),
        ], text=True, capture_output=True, env=env, check=True)
        app = json.loads(result.stdout)
        self.assertEqual(app["env"]["HOST"], "127.0.0.1")
        self.assertEqual(app["env"]["NITRO_HOST"], "127.0.0.1")
        self.assertEqual(app["env"]["PORT"], "3000")
        self.assertEqual(app["env"]["SUPABASE_PUBLISHABLE_KEY"], "public-test-key")
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", app["env"])
        self.assertEqual(app["cwd"], str(self.project))


if __name__ == "__main__":
    unittest.main()