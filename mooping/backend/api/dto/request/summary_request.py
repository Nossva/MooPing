from dataclasses import dataclass


@dataclass
class YardQueryRequest:
    yard_id: int | None = None
