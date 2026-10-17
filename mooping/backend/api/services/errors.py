"""Domain errors raised by services. The traffic layer turns them into HTTP
responses (see api/traffic/exception_handler.py)."""


class ServiceError(Exception):
    status_code = 400

    def __init__(self, message):
        super().__init__(message)
        self.message = message


class InvalidInput(ServiceError):
    status_code = 400


class Unauthorized(ServiceError):
    status_code = 401


class Forbidden(ServiceError):
    status_code = 403


class NotFound(ServiceError):
    status_code = 404


class Conflict(ServiceError):
    status_code = 409
