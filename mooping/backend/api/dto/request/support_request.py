from dataclasses import dataclass


@dataclass
class SupportRequestCreateRequest:
    category: str                      # collar | gateway | app | other
    message: str
