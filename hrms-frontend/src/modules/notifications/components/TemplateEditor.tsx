"use client";

import { useEffect, useState } from "react";

import { mutationErrorMessage } from "@/shared";
import {
  AppButton,
  AppNotice,
  AppTextField,
  ConfirmDialogShell,
} from "@/shared/ui";
import { formatDateTime } from "../selectors";
import type {
  NotificationTemplate,
  TemplatePreview,
  TemplateWording,
} from "../types";

const PREVIEW_DELAY_MS = 350;
const SUBJECT_MAX = 200;
const BODY_MAX = 5000;

export interface TemplateEditorProps {
  readonly template: NotificationTemplate;
  readonly canEdit: boolean;
  readonly onSave: (key: string, wording: TemplateWording) => Promise<void>;
  readonly onReset: (key: string) => Promise<void>;
  readonly onPreview: (
    key: string,
    wording: TemplateWording,
  ) => Promise<TemplatePreview>;
  readonly onSendTest: (key: string, toEmail: string) => Promise<void>;
}

/** Placeholders read like {employee_name}; they are filled in for each email. */
function withPlaceholder(text: string, name: string): string {
  const spacer = text === "" || /\s$/.test(text) ? "" : " ";
  return `${text}${spacer}{${name}}`;
}

/** Subject and message editor with live preview, for one notification email. */
export function TemplateEditor({
  template,
  canEdit,
  onSave,
  onReset,
  onPreview,
  onSendTest,
}: TemplateEditorProps) {
  const savedSubject = template.subject ?? "";
  const savedBody = template.body ?? "";
  const [subject, setSubject] = useState(savedSubject);
  const [body, setBody] = useState(savedBody);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Start again from the saved wording after a save or a reset.
  useEffect(() => {
    setSubject(savedSubject);
    setBody(savedBody);
    setSaveError(null);
  }, [savedSubject, savedBody]);

  const dirty = subject !== savedSubject || body !== savedBody;

  // The preview follows the typing. The server also says what is wrong (an
  // unknown placeholder, a stray curly brace) before anything is saved.
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await onPreview(template.key, { subject, body });
          if (!cancelled) {
            setPreview(next);
            setProblem(null);
          }
        } catch (error) {
          if (!cancelled) setProblem(mutationErrorMessage(error));
        }
      })();
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canEdit, template.key, subject, body]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(template.key, { subject, body });
    } catch (error) {
      setSaveError(mutationErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function openSendTest() {
    setToEmail("");
    setSendError(null);
    setSendOpen(true);
  }

  async function sendTest() {
    const recipient = toEmail.trim();
    if (!recipient.includes("@")) {
      setSendError("Enter a valid email address.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSendTest(template.key, recipient);
      setSendOpen(false);
    } catch (error) {
      setSendError(mutationErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    setConfirmReset(false);
    setSaving(true);
    setSaveError(null);
    try {
      await onReset(template.key);
    } catch (error) {
      setSaveError(mutationErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="grid gap-[0.4rem] rounded-emp bg-emp-raised p-[0.8rem] text-[0.85rem]">
        <p className="m-0">
          <span className="font-semibold text-emp-text">Subject: </span>
          {savedSubject}
        </p>
        <pre className="m-0 whitespace-pre-wrap font-[inherit] text-emp-text">
          {savedBody}
        </pre>
        <p className="m-0 text-emp-muted">
          You need Company Setup full access to change this wording.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-[0.9rem]">
      <div className="grid gap-[1rem] lg:grid-cols-2">
        <div className="grid content-start gap-[0.75rem]">
          <AppTextField
            label="Subject"
            value={subject}
            maxLength={SUBJECT_MAX}
            disabled={saving}
            onChange={setSubject}
          />
          <AppTextField
            label="Message"
            multiline
            rows={9}
            value={body}
            maxLength={BODY_MAX}
            disabled={saving}
            onChange={setBody}
          />
          <div className="grid gap-[0.35rem]">
            <span className="text-[0.85rem] font-semibold text-emp-muted">
              Placeholders: click one to add it to the message. Each is replaced
              with the real value in every email.
            </span>
            <div className="flex flex-wrap gap-[0.35rem]">
              {template.placeholders.map((name) => (
                <AppButton
                  key={name}
                  variant="secondary"
                  size="compact"
                  disabled={saving}
                  aria-label={`Add ${name} to the message`}
                  onClick={() =>
                    setBody((current) => withPlaceholder(current, name))
                  }
                >
                  {`{${name}}`}
                </AppButton>
              ))}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-[0.4rem]">
          <span className="text-[0.85rem] font-semibold text-emp-muted">
            Preview with example values
          </span>
          <div className="grid gap-[0.5rem] rounded-emp border border-emp-line bg-emp-raised p-[0.8rem] text-[0.85rem]">
            {problem ? (
              <span className="text-emp-critical" role="alert">
                {problem}
              </span>
            ) : preview ? (
              <>
                <p className="m-0">
                  <span className="font-semibold text-emp-text">Subject: </span>
                  {preview.subject}
                </p>
                <pre className="m-0 whitespace-pre-wrap font-[inherit] text-emp-text">
                  {preview.body}
                </pre>
              </>
            ) : (
              <span className="text-emp-muted">Preparing the preview…</span>
            )}
          </div>
        </div>
      </div>

      {saveError ? (
        <AppNotice tone="error" onDismiss={() => setSaveError(null)}>
          {saveError}
        </AppNotice>
      ) : null}

      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <AppButton
          disabled={!dirty || saving || problem !== null}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save wording"}
        </AppButton>
        <AppButton
          variant="secondary"
          disabled={!dirty || saving}
          onClick={() => {
            setSubject(savedSubject);
            setBody(savedBody);
            setSaveError(null);
          }}
        >
          Discard changes
        </AppButton>
        <AppButton
          variant="secondary"
          disabled={saving || sending}
          onClick={openSendTest}
        >
          Send test
        </AppButton>
        {template.customized ? (
          <AppButton
            variant="ghost"
            disabled={saving}
            onClick={() => setConfirmReset(true)}
          >
            Reset to default
          </AppButton>
        ) : null}
        <span className="text-[0.85rem] text-emp-muted">
          {template.customized
            ? `Edited${template.updatedBy ? ` by ${template.updatedBy}` : ""} · ${formatDateTime(template.updatedDate)}`
            : "Using the default wording"}
        </span>
      </div>

      <ConfirmDialogShell
        open={confirmReset}
        title={`Reset "${template.name}" to the default wording?`}
        description="Your edited subject and message are removed. New emails use the built-in wording again."
        confirmLabel="Reset to default"
        tone="danger"
        onConfirm={() => void reset()}
        onClose={() => setConfirmReset(false)}
      />
      <ConfirmDialogShell
        open={sendOpen}
        title={`Send a test "${template.name}" email?`}
        description="One sample is queued to this address, using the saved wording and example names and dates. Automatic emails are unchanged."
        confirmLabel="Send test email"
        busy={sending}
        actionError={sendError}
        onConfirm={() => void sendTest()}
        onClose={() => {
          if (!sending) setSendOpen(false);
        }}
      >
        <AppTextField
          label="Send to"
          type="email"
          value={toEmail}
          onChange={setToEmail}
          disabled={sending}
          required
          data-dialog-initial-focus
          autoFocus
        />
      </ConfirmDialogShell>
    </div>
  );
}
