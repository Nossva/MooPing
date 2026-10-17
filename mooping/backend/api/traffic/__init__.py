"""Traffic layer: HTTP in and out. Parses/validates the request (serializers),
calls one service and turns its result into a Response. No business logic and
no database access here.
"""
