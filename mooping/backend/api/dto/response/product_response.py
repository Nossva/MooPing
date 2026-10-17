from dataclasses import dataclass


@dataclass
class ProductResponse:
    id: str
    name: str
    subtitle: str
    badge: str | None
    items: list[str]
    price: float
    currency: str
    free_shipping: bool

    @classmethod
    def from_record(cls, r):
        return cls(r.id, r.name, r.subtitle, r.badge, list(r.items), r.price, r.currency, r.free_shipping)
