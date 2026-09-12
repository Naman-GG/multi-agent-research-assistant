"""Multi-agent research assistant pipeline.

This package NEVER imports FastAPI and does not know a web server exists.
The API layer and the evaluation harness are two independent consumers of it.
"""
from .models import *  # noqa: F401,F403
