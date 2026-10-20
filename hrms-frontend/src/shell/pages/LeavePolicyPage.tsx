"use client";

import { useMemo } from "react";

import { createHttpCompanyHolidaysGateway } from "@/modules/companyHolidays";
import {
  LeavePolicyModule,
  canWriteLeavePolicy,
  createHttpLeavePoliciesGateway,
} from "@/modules/leavePolicy";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function LeavePolicyPage() {
  const {
    liveSession,
    moduleHostKey,
    activeLocationAllowed,
    heading,
    role,
    accessGrants,
  } = useHrms();

  const holidaysGateway = useMemo(
    () => createHttpCompanyHolidaysGateway({ request: apiRequest }),
    [],
  );
  const policiesGateway = useMemo(
    () => createHttpLeavePoliciesGateway({ request: apiRequest }),
    [],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <LeavePolicyModule
      key={`leave-policy-${moduleHostKey}`}
      policiesGateway={liveSession ? policiesGateway : undefined}
      holidaysGateway={liveSession ? holidaysGateway : undefined}
      canWrite={canWriteLeavePolicy(role, accessGrants)}
    />
  );
}
