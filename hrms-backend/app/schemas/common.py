from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class CommentsBody(CamelModel):
    comments: str = Field(..., min_length=1)


class MessageResponse(CamelModel):
    message: str


class AccessUpdate(CamelModel):
    create_access: bool | None = Field(None, alias="createAccess")
    view_access: bool | None = Field(None, alias="viewAccess")
    edit_access: bool | None = Field(None, alias="editAccess")
    full_access: bool | None = Field(None, alias="fullAccess")


class PasswordResetBody(CamelModel):
    password: str
    temp_password: str | None = Field(None, alias="tempPassword")


class ForgotPasswordBody(CamelModel):
    email_id: str = Field(..., alias="emailId")


class StatusUpdateBody(CamelModel):
    status: str | None = None
    end_date: str | None = Field(None, alias="endDate")
