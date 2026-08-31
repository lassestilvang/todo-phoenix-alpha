/**
 * Enterprise module - SSO, RBAC, audit trail, and compliance
 */

export { initializeSSO, processOAuth2Token, validateSamlAssertion, getSSOConfig, isSSOEnabled, getSSOUsers, revokeUserAccess } from './sso-integration';
export type { SSOConfig, SSOUser, SSOProvider } from './sso-integration';
export { EnterpriseAuditTrail, logComplianceEvent } from './audit-trail';
export type { ComplianceEvent, AuditReport, ComplianceEventType } from './audit-trail';