from api.repositories import product_repository


def list_products():
    return product_repository.list_all()
