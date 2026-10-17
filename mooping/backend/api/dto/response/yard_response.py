from dataclasses import dataclass


@dataclass
class YardResponse:
    id: int
    name: str
    area_ha: float
    boundary: dict
    animal_count: int

    @classmethod
    def from_record(cls, r):
        return cls(r.id, r.name, r.area_ha, r.boundary, r.animal_count)
