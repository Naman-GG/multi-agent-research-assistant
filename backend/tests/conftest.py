import json
from pathlib import Path

import pytest

from research_agent.models import Run

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "sample_run.json"


@pytest.fixture(scope="session")
def sample_run() -> Run:
    """The hand-written run all three tracks build against."""
    return Run.model_validate_json(FIXTURE.read_text())


@pytest.fixture(scope="session")
def fixture_raw() -> dict:
    return json.loads(FIXTURE.read_text())
