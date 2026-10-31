from dataclasses import dataclass, field


@dataclass
class TelemetryAcceptedResponse:
    reading_id: int
    device_id: int
    animal_id: int | None
    has_position: bool = False
    alerts_created: list[int] = field(default_factory=list)
    ok: bool = True


@dataclass
class TelemetryRejectedResponse:
    error: str
    ok: bool = False
