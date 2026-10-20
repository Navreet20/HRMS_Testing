from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

ThemePreferenceValue = Literal["light", "dark", "system"]


class LoginRequest(CamelModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class LoginResponse(CamelModel):
    userDetails: dict
    token: str


class SwitchViewBody(CamelModel):
    view: Literal["superadmin", "employee"]


class ThemePreferenceRequest(CamelModel):
    themePreference: ThemePreferenceValue


class ThemePreferenceResponse(CamelModel):
    themePreference: ThemePreferenceValue


class QuickActionsPreferenceRequest(CamelModel):
    quickActionsPreference: list[str]


class QuickActionsPreferenceResponse(CamelModel):
    quickActionsPreference: list[str]
