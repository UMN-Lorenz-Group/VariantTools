"""
VariantTools FastAPI application entry point.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import merge, stats
from backend.api import liftover, fixref
from backend.api import generator, slurm
from backend.db.models import create_db_and_tables, seed_chain_files


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure required directories and DB tables exist
    Path("data/uploads").mkdir(parents=True, exist_ok=True)
    Path("data/outputs").mkdir(parents=True, exist_ok=True)
    Path("data/chains").mkdir(parents=True, exist_ok=True)
    create_db_and_tables()
    seed_chain_files()
    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title="VariantTools API",
    version="0.3.0",
    description="Genomics variant processing web application backend.",
    lifespan=lifespan,
)

# CORS — allow the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stats.router)
app.include_router(merge.router)
app.include_router(liftover.router)
app.include_router(fixref.router)
app.include_router(generator.router)
app.include_router(slurm.router)


@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
