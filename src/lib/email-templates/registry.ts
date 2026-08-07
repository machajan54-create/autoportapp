import type { ComponentType } from "react";
import { template as approvalRequest } from "./approval-request";
import { template as approvalDecision } from "./approval-decision";
import { template as weeklyReport } from "./weekly-report";
import { template as taskAssigned } from "./task-assigned";
import { template as taskDueSoon } from "./task-due-soon";
import { template as taskOverdue } from "./task-overdue";
import { template as taskDailyDigest } from "./task-daily-digest";
import { template as followupReminder } from "./followup-reminder";
import { template as taskStatusChanged } from "./task-status-changed";
import { template as taskUpdated } from "./task-updated";
import { template as taskComment } from "./task-comment";
import { template as accountWelcome } from "./account-welcome";
import { template as dealStageChanged } from "./deal-stage-changed";
import { template as dochazkaEmployeeWelcome } from "./dochazka-employee-welcome";
import { template as demoOrderSignatureRequest } from "./demo-order-signature-request";
import { template as demoOrderDocuments } from "./demo-order-documents";
import { template as washAssignment } from "./wash-assignment";
import { template as washReminder } from "./wash-reminder";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "approval-request": approvalRequest,
  "approval-decision": approvalDecision,
  "weekly-report": weeklyReport,
  "task-assigned": taskAssigned,
  "task-due-soon": taskDueSoon,
  "task-overdue": taskOverdue,
  "task-daily-digest": taskDailyDigest,
  "followup-reminder": followupReminder,
  "task-status-changed": taskStatusChanged,
  "task-updated": taskUpdated,
  "task-comment": taskComment,
  "account-welcome": accountWelcome,
  "deal-stage-changed": dealStageChanged,
  "dochazka-employee-welcome": dochazkaEmployeeWelcome,
  "demo-order-signature-request": demoOrderSignatureRequest,
  "demo-order-documents": demoOrderDocuments,
  "wash-assignment": washAssignment,
  "wash-reminder": washReminder,
};
