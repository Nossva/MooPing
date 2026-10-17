from dataclasses import dataclass


@dataclass
class HealthResponse:
    status: str
    database: str
