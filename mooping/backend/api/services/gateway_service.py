from api.repositories import gateway_repository


def list_gateways(organization_id):
    return gateway_repository.list_by_org(organization_id)
