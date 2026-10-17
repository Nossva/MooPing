from api.dto.response.product_response import ProductResponse
from api.repositories import product_repository


def list_products():
    return [ProductResponse.from_record(r) for r in product_repository.list_all()]
