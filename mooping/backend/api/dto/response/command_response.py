from dataclasses import dataclass


@dataclass
class CommandQueuedResponse:
    """'Enviar ping forzado': command waiting for the Pi."""
    command_id: int
    device_id: int
    status: str

    @classmethod
    def from_entity(cls, command):
        return cls(command.id, command.device_id, command.status)
