from dataclasses import dataclass


@dataclass
class LoginRequest:
    email: str
    password: str


@dataclass
class PasswordChangeRequest:
    current_password: str
    new_password: str
