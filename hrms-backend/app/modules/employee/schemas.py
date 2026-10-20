from pydantic import EmailStr, Field

from app.schemas.common import AccessUpdate, CamelModel


class CreateEmployeeRequest(CamelModel):
    first_name: str = Field(..., alias="firstName")
    middle_name: str | None = Field(None, alias="middleName")
    last_name: str = Field(..., alias="lastName")
    email_id: EmailStr = Field(..., alias="emailId")
    personal_email: str | None = Field(None, alias="personalEmail")
    department: str
    department_id: str | None = Field(None, alias="departmentId")
    location_id: str | None = Field(None, alias="locationId")
    designation_id: str | None = Field(None, alias="designationId")
    company: str
    vendor: str | None = None
    job_rank: str | None = Field(None, alias="jobRank")
    job_description: str | None = Field(None, alias="jobDescription")
    role: str | None = None
    gender: str | None = None
    date_of_birth: str | None = Field(None, alias="dateOfBirth")
    phone_number: str | None = Field(None, alias="phoneNumber")
    password: str | None = None
    employment_type: str = Field(..., alias="employmentType")
    worker_type: str | None = Field(None, alias="workerType")
    work_schedule: str | None = Field(None, alias="workSchedule")
    employment_category: str | None = Field(None, alias="employmentCategory")
    status: str | None = None
    employment_start_date: str | None = Field(None, alias="employmentStartDate")
    date_of_joining: str | None = Field(None, alias="dateOfJoining")
    employment_end_date: str | None = Field(None, alias="employmentEndDate")
    employee_immigration_status: str | None = Field(None, alias="employeeImmigrationStatus")
    reporting_manager_id: str | None = Field(None, alias="reportingManagerId")
    work_mode: str | None = Field(None, alias="workMode")
    ethnicity: str | None = None
    payroll_start_date: str | None = Field(None, alias="payrollStartDate")
    timesheet_required: bool | None = Field(None, alias="timesheetRequired")
    leave_policy_id: str | None = Field(None, alias="leavePolicyId")
    national_id_document_type: str | None = Field(None, alias="nationalIdDocumentType")
    create_access: bool | None = Field(None, alias="createAccess")
    view_access: bool | None = Field(None, alias="viewAccess")
    edit_access: bool | None = Field(None, alias="editAccess")
    full_access: bool | None = Field(None, alias="fullAccess")

class UpdateEmployeeRequest(CreateEmployeeRequest):
    first_name: str | None = Field(None, alias="firstName")
    last_name: str | None = Field(None, alias="lastName")
    email_id: EmailStr | None = Field(None, alias="emailId")
    department: str | None = None
    company: str | None = None
    employment_type: str | None = Field(None, alias="employmentType")
    worker_type: str | None = Field(None, alias="workerType")
    work_schedule: str | None = Field(None, alias="workSchedule")
    employment_category: str | None = Field(None, alias="employmentCategory")
    employment_start_date: str | None = Field(None, alias="employmentStartDate")


class EmployeeProjectInput(CamelModel):
    employee_id: str | None = Field(None, alias="employeeId")
    project_name: str = Field(..., alias="projectName")
    project_start_date: str | None = Field(None, alias="projectStartDate")
    project_end_date: str | None = Field(None, alias="projectEndDate")
    project_role: str | None = Field(None, alias="projectRole")
    status: str | None = None
    project_type: str | None = Field(None, alias="projectType")


class EmployeeAccessUpdate(AccessUpdate):
    pass


class RejectEmployeeBody(CamelModel):
    comments: str = Field(..., min_length=1)
