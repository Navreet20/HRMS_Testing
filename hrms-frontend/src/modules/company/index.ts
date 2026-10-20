export { CompanyModule } from "./CompanyModule";

export { CompanyLogo } from "./components/CompanyLogo";
export type {
  CompanyLogoEmptyDisplay,
  CompanyLogoProps,
  CompanyLogoSize,
  CompanyLogoTile,
} from "./components/CompanyLogo";
export {
  companyInitials,
  companyInitialsHue,
} from "./companyInitials";

export {
  createDefaultActor,
  COMPANY_CREATE_ROLES,
  COMPANY_LIST_ROLES,
  COMPANY_PROFILE_ROLES,
  COMPANY_STATUS_LABELS,
  COMPANY_TYPE_SUGGESTIONS,
  COMPANY_TYPES,
  COMPANY_WRITE_ROLES,
  DEFAULT_COMPANY_ROLE,
  DEFAULT_COMPANY_THEME,
  DEFAULT_DIRECTORY_PAGE_SIZE,
  DIRECTORY_PAGE_SIZES,
  FULL_ACCESS_FLAGS,
  isCompanyType,
  isAllowedCompanyLogoFile,
  LOGO_ACCEPT,
  LOGO_HINT,
  MAX_LOGO_BYTES,
  MAX_LOGO_LABEL,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
} from "./constants";

export {
  companyReducer,
  createCompanyState,
  INITIAL_COMPANY_REDUCER_STATE,
} from "./reducer";

export {
  canCreateCompany,
  canDeactivateCompany,
  canEditCompany,
  canEditCompanyConfiguration,
  canListCompanies,
  canViewCompany,
  createDefaultDirectoryQuery,
  headquartersOptionLabel,
  isCompanyActor,
  isCompanyTheme,
  selectCompanyById,
  selectCompanyProfile,
  selectDirectoryPage,
  validateCompanyDraft,
} from "./selectors";

export type {
  CompanyAccessFlags,
  CompanyAction,
  CompanyActor,
  CompanyDestination,
  CompanyDraft,
  CompanyDraftError,
  CompanyModuleData,
  CompanyModuleProps,
  CompanyRecord,
  CompanyReducerState,
  CompanyStatus,
  CompanyUiState,
  DirectoryPageResult,
  DirectoryPageSize,
  DirectoryQuery,
  DirectorySortDirection,
  DirectorySortKey,
} from "./types";

export {
  COMPANY_WEBSITE_INVALID_MESSAGE,
  normalizeCompanyWebsite,
} from "./website";
export type { CompanyType } from "./constants";

export type { CompanyGateway } from "./gateway";
export { createHttpCompanyGateway } from "./gateway";
export type {
  CompanyRequest,
  HttpCompanyGatewayOptions,
} from "./gateway";