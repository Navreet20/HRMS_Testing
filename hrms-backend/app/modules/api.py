from fastapi import APIRouter, Depends

from app.dependencies import csrf_header_scheme, get_current_user
from app.modules.admin import router as admin
from app.modules.company import router as companies
from app.modules.config import router as config
from app.modules.clients import router as clients
from app.modules.dashboard import router as dashboard
from app.modules.employee import me_router as employee_me
from app.modules.employee import router as employees
from app.modules.geocode import router as geocode
from app.modules.notifications import router as notifications
from app.modules.holidays import router as holidays
from app.modules.leave import router as leave_types
from app.modules.leave_approvals import router as leave_approvals
from app.modules.leave_policies import router as leave_policies
from app.modules.leave_requests import router as leave_requests
from app.modules.national_id import router as national_id
from app.modules.org import router as org
from app.modules.rbac import router as rbac
from app.modules.projects import router as projects
from app.modules.timesheet import router as timesheets
from app.modules import awaiting
from app.modules.assets import router as assets
from app.modules.workflow import router as workflow

router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(get_current_user), Depends(csrf_header_scheme)],
)

router.include_router(timesheets.router)
router.include_router(notifications.router)
router.include_router(employee_me.router)
router.include_router(employees.router)
router.include_router(admin.router)
router.include_router(leave_types.router)
router.include_router(leave_policies.router)
router.include_router(leave_requests.router)
router.include_router(leave_approvals.router)
router.include_router(holidays.router)
router.include_router(companies.router)
router.include_router(projects.router)
router.include_router(clients.router, prefix="/clients")
router.include_router(assets.router)
router.include_router(workflow.router)
router.include_router(dashboard.router)
router.include_router(config.router)
router.include_router(org.router)
router.include_router(geocode.router)
router.include_router(national_id.router)
router.include_router(rbac.router)
# Awaiting Refinement (vendors, expenses, payrolls, schedule, skills, users, billing, revenue, attendance):
# no tables yet, so reads return [] and writes 501. See app/modules/awaiting.py.
router.include_router(awaiting.router)
