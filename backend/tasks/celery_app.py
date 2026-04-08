"""
Celery application configuration.
"""

import os
from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
REDIS_BACKEND = REDIS_URL.replace("/0", "/1")

celery_app = Celery(
    "varianttools",
    broker=REDIS_URL,
    backend=REDIS_BACKEND,
    include=["backend.tasks.vcf_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
