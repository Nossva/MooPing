"""DTO layer: every request that reaches a service and every response that
leaves the API is one of these dataclasses.

    dto/request/   <resource>_request.py   built by traffic, consumed by services
    dto/response/  <resource>_response.py  returned by services, rendered by traffic
"""
