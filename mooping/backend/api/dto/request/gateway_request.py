from dataclasses import dataclass

from api.dto.request.base import UNSET, PatchRequest


@dataclass
class GatewayCreateRequest:
    gateway_uid: str
    name: str | None = None
    kind: str = 'gateway'
    power_source: str | None = None
    radio: str | None = None
    coverage_ha: float | None = None

    def fields_to_set(self):
        """Optional attributes the client sent (gateway_uid excluded)."""
        values = {
            'name': self.name, 'kind': self.kind, 'power_source': self.power_source,
            'radio': self.radio, 'coverage_ha': self.coverage_ha,
        }
        return {k: v for k, v in values.items() if v is not None}


@dataclass
class GatewayUpdateRequest(PatchRequest):
    name: str = UNSET
    kind: str = UNSET
    power_source: str | None = UNSET
    radio: str | None = UNSET
    coverage_ha: float | None = UNSET
