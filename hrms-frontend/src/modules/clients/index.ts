export { ClientsModule } from "./ClientsModule";

export {
  createDefaultActor,
  CLIENT_INDUSTRIES,
  CLIENT_LOCATION_REGIONS,
  CLIENT_INVOICE_ACCOUNT_TYPES,
  CLIENT_STATUS_LABELS,
  CLIENTS_LIST_ROLES,
  DEFAULT_CLIENTS_ROLE,
  DEFAULT_CLIENTS_THEME,
  DEFAULT_DIRECTORY_PAGE_SIZE,
  DIRECTORY_PAGE_SIZES,
  EXTRA_CONTACT_TYPE_LABELS,
  EXTRA_CONTACT_TYPES,
  FULL_ACCESS_FLAGS,
  INTERNAL_CLIENT_NAME,
  isInternalClientName,
  NET_PAY_TERMS,
  NO_ACCESS_FLAGS,
  VIEW_ONLY_ACCESS_FLAGS,
  emptyAddress,
} from "./constants";

export {
  createClientsState,
  clientsReducer,
  INITIAL_CLIENTS_REDUCER_STATE,
} from "./reducer";

export {
  canCreateClient,
  canDeactivateClient,
  canEditClient,
  canListClients,
  canViewClient,
  createDefaultDirectoryQuery,
  isClientActor,
  isClientsTheme,
  selectClientById,
  selectDirectoryPage,
  selectEmployeesForClient,
  validateClientDraft,
  validateMsaDates,
} from "./selectors";

export {
  clientsDirectoryFiltersActive,
  clientsDirectoryIsBrowsing,
  createDefaultClientsDirectoryQuery,
  formatClientId,
  formatLocationId,
  formatStakeholderId,
  selectClientsDirectoryGroups,
  selectClientsDirectoryPage,
  selectClientsIndustryOptions,
  selectClientsRegionOptions,
} from "./clientsDirectory";

export type {
  AddressFields,
  ClientLocationRecord,
  ClientAccessFlags,
  ClientActor,
  ClientDraft,
  ClientDraftError,
  ClientEmployeeLink,
  ClientRecord,
  ClientsAction,
  ClientsDestination,
  ClientsModuleData,
  ClientsModuleProps,
  ClientsReducerState,
  ClientsUiState,
  ClientsView,
  ClientStatus,
  DirectoryPageResult,
  DirectoryPageSize,
  DirectoryQuery,
  DirectorySortDirection,
  DirectorySortKey,
  ExtraContact,
  ExtraContactType,
  NetPayTerm,
} from "./types";

export type {
  ClientsDirectoryGroup,
  ClientsDirectoryGroupsPageResult,
  ClientsDirectoryPageResult,
  ClientsDirectoryQuery,
  ClientsDirectoryRow,
  ClientsDirectorySortDirection,
  ClientsDirectorySortKey,
  ClientsFilterOption,
  ClientsRowKind,
} from "./clientsDirectory";

export type { ClientsGateway } from "./gateway";
export { createHttpClientsGateway } from "./gateway";
export type {
  ClientsRequest,
  HttpClientsGatewayOptions,
} from "./gateway";
export {
  CLIENT_CATEGORIES,
  CLIENT_CATEGORY_LABELS,
  clientNameWithCategory,
  parseClientCategory,
  resolveClientCategory,
} from "./clientCategory";
export type { ClientCategory } from "./clientCategory";
export {
  clientCategoryDraftPatch,
  createClientDraftToClientDraft,
  createClientToApiBody,
  clientRecordToCreateClientDraft,
  emptyClientLocationDraft,
  emptyCreateClientDraft,
  nestedSaveFromCreateDraft,
  normalizeIndustryCatalog,
  validateCreateClientDraft,
} from "./createClientDraft";
export type {
  ClientLocationDraft,
  ClientStakeholderDraft,
  CreateClientDraft,
} from "./createClientDraft";