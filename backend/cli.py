"""Drive the pipeline with no UI. The fastest way to test anything.

    python -m backend.cli run "Do statins reduce dementia risk?" --max-papers 8
    python -m backend.cli replay RUN-SAMPLE-001
    python -m backend.cli show RUN-SAMPLE-001 --rejected

`replay` re-serves a completed run from the database with zero API calls. Record one
the night before each review -- it is the demo's insurance policy.

TODO(Track A): implement with argparse.
"""
from __future__ import annotations


def main() -> None:
    raise NotImplementedError("TODO(Track A)")


if __name__ == "__main__":
    main()
