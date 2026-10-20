import {
  useEffect,
  useRef,
  useState,
  useId,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Folder,
  Globe2,
  MapPin,
  Search,
  UserRound,
} from "lucide-react";

import { ClickToViewHint } from "@/shared/ui";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import { cx, empUi as ui } from "@/shared/ui/empUi";
import { clientsUi } from "../uiClasses";
import { CLIENT_STATUS_LABELS } from "../constants";
import { initialsFor } from "../clientInitials";
import { CLIENT_CATEGORY_LABELS, resolveClientCategory } from "../clientCategory";
import { useClientLogoUrl } from "../hooks/useClientLogoUrl";
import {
  regionLabel,
  type ClientsDirectoryGroup,
  type ClientsDirectoryRow,
} from "../clientsDirectory";
import type { ClientActor, ClientRecord, ClientStatus } from "../types";
import type { ProjectRecord } from "@/modules/projects/types";
import {
  canDeactivateClient,
  canEditClient,
  canViewClient,
} from "../selectors";
import { MoreIcon } from "./icons";

export type ClientsActionKind =
  | "details"
  | "edit"
  | "archive"
  | "restore"
  | "allocate";

interface DirectoryTableProps {
  readonly groups: readonly ClientsDirectoryGroup[];
  readonly actor: ClientActor;
  readonly emptyKind: "idle" | "none" | "filtered";
  /** The server page is on its way; shown only while there is nothing to list. */
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly fetchClientLogo?: (clientId: string, version?: string) => Promise<Blob>;
  readonly onOpen: (row: ClientsDirectoryRow) => void;
  readonly onAction: (kind: ClientsActionKind, row: ClientsDirectoryRow) => void;
  readonly onClearFilters: () => void;
}

function clientStatusTone(status: ClientStatus): StatusTone {
  return status === "ACTIVE" ? "success" : "danger";
}

function activeProjectCount(projects: readonly ProjectRecord[]): number {
  return projects.filter((project) => project.status === "ACTIVE").length;
}

function ActionMenu({
  row,
  actor,
  client,
  onAction,
}: {
  readonly row: ClientsDirectoryRow;
  readonly actor: ClientActor;
  readonly client: ClientRecord | null;
  readonly onAction: (kind: ClientsActionKind, row: ClientsDirectoryRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const canView = canViewClient(actor);
  const showEdit = Boolean(client && canEditClient(actor, client));
  const showArchive = Boolean(
    client &&
      canDeactivateClient(actor, client) &&
      client.status === "ACTIVE",
  );
  const showRestore = Boolean(
    client &&
      canDeactivateClient(actor, client) &&
      client.status === "INACTIVE",
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [open]);

  if (!canView) {
    return null;
  }

  return (
    <div
      className={clientsUi.rowMenu}
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
          return;
        }
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className={clientsUi.rowMenuTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Actions for ${row.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div
          id={menuId}
          className={clientsUi.rowMenuPanel}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className={clientsUi.rowMenuItem}
            onClick={() => {
              onAction(showEdit ? "edit" : "details", row);
              setOpen(false);
            }}
          >
            View/Edit
          </button>
          {showArchive ? (
            <button
              type="button"
              role="menuitem"
              className={clientsUi.rowMenuItemDanger}
              onClick={() => {
                onAction("archive", row);
                setOpen(false);
              }}
            >
              Archive
            </button>
          ) : null}
          {showRestore ? (
            <button
              type="button"
              role="menuitem"
              className={clientsUi.rowMenuItem}
              onClick={() => {
                onAction("restore", row);
                setOpen(false);
              }}
            >
              Restore
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ClientDirectoryCard({
  group,
  actor,
  fetchClientLogo,
  onOpen,
  onAction,
}: {
  readonly group: ClientsDirectoryGroup;
  readonly actor: ClientActor;
  readonly fetchClientLogo?: (clientId: string, version?: string) => Promise<Blob>;
  readonly onOpen: (row: ClientsDirectoryRow) => void;
  readonly onAction: (kind: ClientsActionKind, row: ClientsDirectoryRow) => void;
}) {
  const { client, clientRow, projects } = group;
  const industry = clientRow.industry.trim();
  const locationsLabel = clientRow.locationsLabel.trim();
  const locationCount = client.locations.length;
  const region = regionLabel(clientRow.region) || clientRow.region;
  const owner = clientRow.accountOwnerName.trim();
  const activeCount =
    group.activeProjectCount ??
    activeProjectCount(projects.map((entry) => entry.project));
  const kindLabel = CLIENT_CATEGORY_LABELS[resolveClientCategory(client)];
  const [logoBroken, setLogoBroken] = useState(false);
  const logoSrc = useClientLogoUrl(
    client.id,
    client.logoObjectKey,
    fetchClientLogo,
  );
  const showLogo = Boolean(logoSrc) && !logoBroken;
  const canOpen = canViewClient(actor);

  useEffect(() => {
    setLogoBroken(false);
  }, [client.id, client.logoObjectKey]);

  function stop(event: ReactMouseEvent | ReactKeyboardEvent) {
    event.stopPropagation();
  }

  function openCard() {
    if (!canOpen) {
      return;
    }
    onOpen(clientRow);
  }

  return (
    <article
      className={cx(
        canOpen ? ui.dirCardInteractive : ui.dirCard,
        clientsUi.dirCardSpacious,
      )}
      aria-label={`${client.name} client card`}
      {...(canOpen
        ? {
            tabIndex: 0,
            onClick: openCard,
            onKeyDown: (event: ReactKeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard();
              }
            },
          }
        : {})}
    >
      {canOpen ? <ClickToViewHint /> : null}
      <div className={ui.profileHeroRow}>
        <div className={ui.profileHeroAvatarCol}>
          <div className={ui.profileHeroAvatarWrap}>
            <span className={ui.profileHeroAvatar} aria-hidden="true">
              {showLogo && logoSrc ? (
                <img
                  className={clientsUi.cardAvatar}
                  src={logoSrc}
                  alt=""
                  onError={() => setLogoBroken(true)}
                />
              ) : (
                initialsFor(client.name)
              )}
            </span>
          </div>
        </div>
        <div className={ui.profileHeroBody}>
          <h2 className={ui.profileHeroName}>{client.name}</h2>
          <p className={ui.profileHeroRole}>
            {[industry, kindLabel].filter(Boolean).join(" · ")}
          </p>
          {locationsLabel || region || owner ? (
            <p className={ui.profileHeroMeta}>
              {locationsLabel ? (
                <span className={ui.profileHeroMetaItem}>
                  <MapPin size={13} className={ui.profileHeroMetaIcon} />
                  {locationsLabel}
                </span>
              ) : null}
              {region ? (
                <span className={ui.profileHeroMetaItem}>
                  <Globe2 size={13} className={ui.profileHeroMetaIcon} />
                  {region}
                </span>
              ) : null}
              {owner ? (
                <span className={ui.profileHeroMetaItem}>
                  <UserRound size={13} className={ui.profileHeroMetaIcon} />
                  {owner}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className={ui.profileHeroPills}>
            <StatusBadge
              label={CLIENT_STATUS_LABELS[client.status]}
              tone={clientStatusTone(client.status)}
            />
            {clientRow.clientId ? (
              <span className={ui.profileHeroPill}>
                ID: {clientRow.clientId}
              </span>
            ) : null}
            <span className={ui.profileHeroPill}>
              <Folder size={13} className={ui.profileHeroPillIcon} />
              {activeCount} active project{activeCount === 1 ? "" : "s"}
            </span>
            {!client.isInternal ? (
              <span className={ui.profileHeroPill}>
                <MapPin size={13} className={ui.profileHeroPillIcon} />
                {locationCount} location{locationCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cx(ui.dirCardActions, clientsUi.dirCardActions)}
        onClick={stop}
        onKeyDown={stop}
      >
        <ActionMenu
          row={clientRow}
          actor={actor}
          client={client}
          onAction={onAction}
        />
      </div>
    </article>
  );
}

export function DirectoryTable({
  groups,
  actor,
  emptyKind,
  loading = false,
  error = null,
  fetchClientLogo,
  onOpen,
  onAction,
  onClearFilters,
}: DirectoryTableProps) {
  if (emptyKind === "idle") {
    return (
      <div className={ui.dirEmptyPanel}>
        <DirectoryEmptyState
          icon={<Search size={22} strokeWidth={1.6} aria-hidden />}
          title="No active search query"
          message="Search by client name or ID (at least 2 characters), or select a filter above to view clients."
        />
      </div>
    );
  }

  if (groups.length === 0 && (loading || error)) {
    return (
      <div className={ui.dirEmptyPanel} role={error ? "alert" : "status"}>
        <DirectoryEmptyState
          icon={<Search size={22} strokeWidth={1.6} aria-hidden />}
          title={error ? "Unable to load clients" : "Loading clients…"}
          message={error ?? "Fetching the matching clients."}
        />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={ui.dirEmptyPanel}>
        <DirectoryEmptyState
          icon={<Search size={22} strokeWidth={1.6} aria-hidden />}
          title={
            emptyKind === "filtered"
              ? "No matching clients"
              : "No clients yet"
          }
          message={
            emptyKind === "filtered"
              ? "Nothing matches the current search or filters. Try a different name or clear filters."
              : "Add a client to start tracking accounts and allocations."
          }
          action={
            emptyKind === "filtered" ? (
              <button
                type="button"
                className={clientsUi.btnGhost}
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={ui.dirCardList} role="list">
      {groups.map((group) => (
        <div key={group.client.id} role="listitem">
          <ClientDirectoryCard
            group={group}
            actor={actor}
            fetchClientLogo={fetchClientLogo}
            onOpen={onOpen}
            onAction={onAction}
          />
        </div>
      ))}
    </div>
  );
}
