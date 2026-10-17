from dataclasses import dataclass


@dataclass
class YardCreateRequest:
    name: str
    boundary: dict                      # GeoJSON Polygon (lng, lat)


@dataclass
class YardUpdateRequest:
    name: str | None = None
    boundary: dict | None = None
