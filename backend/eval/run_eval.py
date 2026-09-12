"""Runs the full evaluation study.

    python -m eval.run_eval --questions eval/dataset/questions.yaml --systems both

Protocol:
  1. Run both systems over the same question set with the same retrieved papers.
  2. Pool all claims from both, strip the system label, shuffle.
  3. Three raters label independently and blind.
  4. Compute metrics per system, plus Fleiss' kappa across raters.

Blind labeling and a reported agreement score are cheap and disproportionately raise
how seriously the study is assessed. Do not skip the blinding to save time.

TODO(Track C): implement.
"""
from __future__ import annotations


def main() -> None:
    raise NotImplementedError("TODO(Track C)")


if __name__ == "__main__":
    main()
