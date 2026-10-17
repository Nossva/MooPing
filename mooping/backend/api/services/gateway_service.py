from api.dto.response.gateway_response import GatewayResponse
from api.repositories import gateway_repository


def list_gateways(organization_id):
    return [GatewayResponse.from_record(r) for r in gateway_repository.list_by_org(organization_id)]
