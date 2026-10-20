import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

import { useBodyScrollLock } from "@/shared/ui/useBodyScrollLock";
import { PhotoControls } from "@/modules/employees/components/PhotoControls";
import { LocationFormFields } from "@/modules/locations/components/LocationFormFields";
import { CatalogSearchSelect } from "@/modules/org/catalogFields";
import {
  addClientLocationBlocker,
  clientLocationsNewestFirst,
  emptyClientLocationDraft,
  emptyCreateClientDraft,
  clientLocationToLocationDraft,
  locationDraftToClientLocation,
  clientCategoryDraftPatch,
  clientRecordToCreateClientDraft,
  validateCreateClientDraft,
  type CreateClientDraft,
  DUPLICATE_CLIENT_NAME_MESSAGE,
  isDuplicateActiveClientName,
} from "../createClientDraft";
import { initialsFor } from "../clientInitials";
import { useClientLogoUrl } from "../hooks/useClientLogoUrl";
import type { ClientRecord } from "../types";
import type { LocationRecord } from "@/modules/org";
import { CloseIcon } from "./icons";
import { ClientCategoryCheckboxes } from "./ClientCategoryCheckboxes";
import { ClientsFieldLabel } from "./ClientsFieldLabel";
import { InternalClientLocationFields } from "./InternalClientLocationFields";
import { clientsUi as ui } from "../uiClasses";

export interface CreateClientAccountOwnerOption {
  readonly id: string;
  readonly displayName: string;
}

export interface CreateClientLogoIntent {
  readonly file: File | null;
  readonly remove: boolean;
}

interface CreateClientModalProps {
  readonly mode?: "create" | "edit";
  readonly client?: ClientRecord | null;
  readonly clients: readonly ClientRecord[];
  readonly industries: readonly string[];
  readonly accountOwners: readonly CreateClientAccountOwnerOption[];
  /** Searches the server for owners as the picker is used (null when it closes). */
  readonly onOwnerSearch?: (query: string | null) => void;
  readonly ownersLoading?: boolean;
  readonly orgLocations?: readonly LocationRecord[];
  readonly error?: string | null;
  readonly busy?: boolean;
  readonly fetchLogoBlob?: (clientId: string, version?: string) => Promise<Blob>;
  readonly onClose: () => void;
  readonly onSave: (
    draft: CreateClientDraft,
    logo: CreateClientLogoIntent,
  ) => void | Promise<void>;
}

export function CreateClientModal({
  mode = "create",
  client = null,
  clients,
  industries,
  accountOwners,
  onOwnerSearch,
  ownersLoading = false,
  orgLocations = [],
  error,
  busy = false,
  fetchLogoBlob,
  onClose,
  onSave,
}: CreateClientModalProps) {
  const titleId = useId();
  const isEdit = mode === "edit";
  const [draft, setDraft] = useState(() =>
    isEdit && client
      ? clientRecordToCreateClientDraft(client)
      : emptyCreateClientDraft(),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [addLocationError, setAddLocationError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoRemove, setLogoRemove] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [existingLogoBroken, setExistingLogoBroken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useBodyScrollLock();

  const existingLogoSrc = useClientLogoUrl(
    !logoFile && !logoRemove ? client?.id : null,
    !logoFile && !logoRemove ? client?.logoObjectKey : null,
    fetchLogoBlob,
  );

  const previewSrc = logoPreviewUrl || existingLogoSrc;
  const showUploadedPreview = Boolean(previewSrc) && !existingLogoBroken;

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const industrySelectOptions = useMemo(() => {
    const values =
      draft.industry && !industries.includes(draft.industry)
        ? [draft.industry, ...industries]
        : industries;
    return values.map((industry) => ({
      value: industry,
      label: industry,
    }));
  }, [draft.industry, industries]);

  const accountOwnerSelectOptions = useMemo(
    () =>
      accountOwners.map((owner) => ({
        value: owner.id,
        label: owner.displayName,
      })),
    [accountOwners],
  );

  function patch(partial: Partial<CreateClientDraft>) {
    if (partial.locations) {
      setAddLocationError(null);
    }
    setDraft((current) => ({ ...current, ...partial }));
  }

  function syncNameError(name: string) {
    setNameError(
      isDuplicateActiveClientName(name, clients, client?.id)
        ? DUPLICATE_CLIENT_NAME_MESSAGE
        : null,
    );
  }

  function handleLogoUpload(file: File) {
    setLogoError(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoRemove(false);
    setExistingLogoBroken(false);
  }

  function handleLogoRemove() {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoRemove(Boolean(client?.logoObjectKey));
    setExistingLogoBroken(false);
    setLogoError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting) {
      return;
    }
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const errors = validateCreateClientDraft(draft, clients, {
      excludeClientId: client?.id,
      industries,
    });
    if (errors.length > 0) {
      const duplicateNameError = errors.find(
        (item) =>
          item.field === "name" &&
          item.message === DUPLICATE_CLIENT_NAME_MESSAGE,
      );
      if (duplicateNameError) {
        setNameError(duplicateNameError.message);
      }
      setLocalError(errors[0]!.message);
      return;
    }
    if (logoError) {
      return;
    }
    setLocalError(null);
    setNameError(null);
    setSubmitting(true);
    try {
      await onSave(draft, { file: logoFile, remove: logoRemove });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to save client.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const alert = localError || error || null;
  const saveDisabled = busy || submitting;

  const modal = (
    <div
      className={ui.createOverlay}
      data-module="clients"
      data-theme={
        typeof document !== "undefined"
          ? document.documentElement.dataset.theme
          : undefined
      }
      role="presentation"
    >
      <form
        className={ui.createModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <header className={ui.createModalHeader}>
          <div>
            <h2 id={titleId} className={ui.createModalTitle}>{isEdit ? "Edit Client" : "Create New Client"}</h2>
            <p className={ui.createModalSubtitle}>
              {isEdit
                ? draft.isInternal
                  ? "Update the internal client account and office location"
                  : "Update the client account and operating locations"
                : draft.isInternal
                  ? "Add an internal client linked to an office location"
                  : "Add a client account with at least one operating location"}
            </p>
          </div>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className={ui.createModalBody}>
          {alert ? (
            <p className={ui.error} role="alert">
              {alert}
            </p>
          ) : null}

          <section className={ui.createSection}>
            <h3 className={ui.createSectionTitle}>Basic information</h3>
            <div className={ui.createGrid}>
              <label className={ui.fieldModal}>
                <ClientsFieldLabel required>Client name</ClientsFieldLabel>
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  placeholder="e.g., Nova Therapeutics Inc."
                  aria-label="Client Name"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={
                    nameError ? "create-client-name-error" : undefined
                  }
                  onChange={(event) => {
                    const name = event.target.value;
                    patch({ name });
                    syncNameError(name);
                    if (localError) {
                      setLocalError(null);
                    }
                  }}
                />
                {nameError ? (
                  <span
                    id="create-client-name-error"
                    className="text-emp-critical"
                    role="alert"
                  >
                    {nameError}
                  </span>
                ) : null}
              </label>
              <div className={ui.fieldModal}>
                <ClientsFieldLabel required>Industry</ClientsFieldLabel>
                <CatalogSearchSelect
                  required
                  value={draft.industry}
                  options={industrySelectOptions}
                  aria-label="Industry"
                  placeholder="Select industry"
                  searchPlaceholder="Search industry…"
                  onChange={(industry) => patch({ industry })}
                />
              </div>
              <div className={ui.fieldModal}>
                <ClientsFieldLabel optional>Account owner</ClientsFieldLabel>
                <CatalogSearchSelect
                  value={draft.accountOwnerId}
                  options={accountOwnerSelectOptions}
                  onQueryChange={onOwnerSearch}
                  loading={ownersLoading}
                  selectedLabel={client?.accountOwnerName || undefined}
                  aria-label="Account owner"
                  placeholder="Select employee"
                  searchPlaceholder="Search employee…"
                  onChange={(accountOwnerId) => patch({ accountOwnerId })}
                />
              </div>
              <div className={ui.fieldModal}>
                <ClientsFieldLabel optional>Client logo</ClientsFieldLabel>
                <div className={ui.logoTile}>
                  <div className={ui.logoPreviewWrap}>
                    <div
                      className={ui.logoPreview}
                      aria-hidden="true"
                    >
                      {showUploadedPreview && previewSrc ? (
                        <img
                          src={previewSrc}
                          alt=""
                          onError={() => setExistingLogoBroken(true)}
                        />
                      ) : (
                        <span>{initialsFor(draft.name || "Client")}</span>
                      )}
                    </div>
                    <PhotoControls
                      variant="overlay"
                      canEdit
                      hasPhoto={showUploadedPreview}
                      currentPhotoSrc={
                        showUploadedPreview ? previewSrc : null
                      }
                      editorTitle="Edit client logo"
                      uploadLabel="Upload logo"
                      replaceLabel="Replace logo"
                      removeLabel="Remove logo"
                      onUpload={handleLogoUpload}
                      onRemove={handleLogoRemove}
                      onError={(message) => setLogoError(message)}
                    />
                  </div>
                  <div className={ui.logoMeta}>
                    <span className={ui.logoHint}>
                      Click the logo to upload. Drag and zoom to adjust framing
                      — same as employee photos. JPEG, PNG, or WebP up to 2 MB.
                    </span>
                    {logoError ? (
                      <span className="text-emp-critical" role="alert">
                        {logoError}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <ClientCategoryCheckboxes
                value={draft.clientCategory}
                onChange={(clientCategory) => {
                  patch(clientCategoryDraftPatch(draft, clientCategory));
                  if (localError) {
                    setLocalError(null);
                  }
                }}
              />
            </div>
          </section>

          <section className={ui.createSection}>
            <div className={ui.createSectionBar}>
              <h3 className={ui.createSectionTitle}>Operating Locations</h3>
              {!draft.isInternal ? (
                <button
                  type="button"
                  className={ui.createAdd}
                  onClick={() => {
                    const blocker = addClientLocationBlocker(draft.locations);
                    if (blocker) {
                      setAddLocationError(blocker);
                      return;
                    }
                    patch({
                      locations: [
                        ...draft.locations,
                        emptyClientLocationDraft(),
                      ],
                    });
                  }}
                >
                  + Add location
                </button>
              ) : null}
            </div>
            {addLocationError && !draft.isInternal ? (
              <p className={ui.error} role="alert">
                {addLocationError}
              </p>
            ) : null}
            {draft.isInternal ? (
              draft.locations.map((location, index) => (
                <div
                  key={location.id ?? `location-${index}`}
                  className={ui.createCard}
                  data-testid="client-location-card"
                >
                  <div className={ui.createCardBar}>
                    <strong>Location {index + 1}</strong>
                  </div>
                  <InternalClientLocationFields
                    location={location}
                    orgLocations={orgLocations}
                    strongControls
                    fieldIdPrefix={`client-location-${index + 1}`}
                    onChange={(next) =>
                      patch({
                        locations: draft.locations.map((row, rowIndex) =>
                          rowIndex === index ? next : row,
                        ),
                      })
                    }
                  />
                </div>
              ))
            ) : (
              clientLocationsNewestFirst(draft.locations).map(({ location, index }) => (
                <div
                  key={location.id ?? `location-${index}`}
                  className={ui.createCard}
                  data-testid="client-location-card"
                >
                  <div className={ui.createCardBar}>
                    <strong>Location {index + 1}</strong>
                    {draft.locations.length > 1 ? (
                      <button
                        type="button"
                        className={ui.iconBtn}
                        aria-label={`Remove location ${index + 1}`}
                        onClick={() =>
                          patch({
                            locations: draft.locations.filter(
                              (_, row) => row !== index,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <LocationFormFields
                    value={clientLocationToLocationDraft(location)}
                    fieldIdPrefix={`client-location-${index + 1}`}
                    lockLocationType="Client site"
                    showOfficeDetails={false}
                    requireAddressDetails={false}
                    onChange={(next) =>
                      patch({
                        locations: draft.locations.map((row, rowIndex) =>
                          rowIndex === index
                            ? locationDraftToClientLocation(next, row)
                            : row,
                        ),
                      })
                    }
                  />
                </div>
              ))
            )}
          </section>
        </div>

        <footer className={ui.createModalFooter}>
          <div className={ui.createModalActions}>
            <button
              type="button"
              className={ui.btnGhost}
              disabled={saveDisabled}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
              disabled={saveDisabled}
            >
              {saveDisabled ? "Saving…" : "Save Client"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }
  return createPortal(modal, document.body);
}
