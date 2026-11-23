-- ============================================================================
-- TROPOS — POSTGRESQL ROW-LEVEL SECURITY (RLS), APPEND-ONLY AUDIT, CHECKS
--          AND HARD COMPLIANCE TRIGGERS (Audited & Hardened)
-- Run after initial Prisma migration to enforce database-level invariants.
-- ============================================================================

-- 1. Grant non-superuser app role (`tropos_app`) standard table privileges
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tropos_app') THEN
    GRANT USAGE ON SCHEMA public TO tropos_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tropos_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tropos_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tropos_app;

    -- 2. TRUE APPEND-ONLY TABLES (No UPDATE or DELETE allowed for app role)
    REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM tropos_app;
    REVOKE UPDATE, DELETE ON TABLE "PlatformAuditLog" FROM tropos_app;
    REVOKE UPDATE, DELETE ON TABLE "PeriodSnapshot" FROM tropos_app;
    REVOKE UPDATE, DELETE ON TABLE "EntryHistory" FROM tropos_app;
    REVOKE UPDATE, DELETE ON TABLE "ExportReport" FROM tropos_app;
  END IF;
END $$;

-- 3. FORCE ROW-LEVEL SECURITY ON EVERY PURE TENANT TABLE
DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'UserRole',
    'UserFacilityAssignment',
    'AccessCertification',
    'Entity',
    'Facility',
    'ResourceSource',
    'BoundaryExclusion',
    'ReportingPeriod',
    'ResourceEntry',
    'EntryHistory',
    'EvidenceFile',
    'RefrigerantEquipment',
    'WaterLog',
    'WasteLog',
    'AirEmissionLog',
    'MaterialLog',
    'FacilityOutputLog',
    'FinancialYearMetrics',
    'Supplier',
    'Scope3Purchase',
    'Scope2Instrument',
    'Scope2Allocation',
    'GreenEconomyCredit',
    'CctsComplianceTarget',
    'PeriodSnapshot',
    'RecalculationRequest',
    'Target',
    'TargetMilestone',
    'ReductionAction',
    'InternalAuditFinding',
    'AssuranceEngagement',
    'AssuranceEngagementPeriod',
    'VerificationFinding',
    'AuditLog',
    'Subscription',
    'Invoice',
    'ImportBatch',
    'ApiKey',
    'InventoryManagementPlan',
    'ExportReport'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org_id'', true));',
      tbl
    );
  END LOOP;
END $$;

-- 4. SPECIAL RLS FOR TOKEN-ACCESSED PORTALS (Invitation & SupplierPcfRequest)
-- Allows pre-auth lookup strictly by exact tokenHash GUC before org context is bound.
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invitation";
CREATE POLICY tenant_isolation ON "Invitation"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
DROP POLICY IF EXISTS invite_token_lookup ON "Invitation";
CREATE POLICY invite_token_lookup ON "Invitation"
  FOR SELECT
  USING (
    current_setting('app.invite_token_hash', true) IS NOT NULL
    AND current_setting('app.invite_token_hash', true) <> ''
    AND "tokenHash" = current_setting('app.invite_token_hash', true)
    AND "acceptedAt" IS NULL
    AND "revokedAt" IS NULL
  );

ALTER TABLE "SupplierPcfRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierPcfRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SupplierPcfRequest";
CREATE POLICY tenant_isolation ON "SupplierPcfRequest"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
DROP POLICY IF EXISTS supplier_token_lookup ON "SupplierPcfRequest";
CREATE POLICY supplier_token_lookup ON "SupplierPcfRequest"
  FOR SELECT
  USING (
    current_setting('app.supplier_token_hash', true) IS NOT NULL
    AND current_setting('app.supplier_token_hash', true) <> ''
    AND "tokenHash" = current_setting('app.supplier_token_hash', true)
    AND "status" NOT IN ('EXPIRED', 'REVOKED')
  );

-- 5. SPECIAL RLS FOR EmissionFactor (Global registry + Platform Admin writes + Tenant isolation)
ALTER TABLE "EmissionFactor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmissionFactor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_read_isolation ON "EmissionFactor";
CREATE POLICY factor_read_isolation ON "EmissionFactor"
  FOR SELECT
  USING (
    ("organizationId" IS NULL AND "status" IN ('PUBLISHED', 'SUPERSEDED'))
    OR ("organizationId" IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
  );
DROP POLICY IF EXISTS factor_write_isolation ON "EmissionFactor";
CREATE POLICY factor_write_isolation ON "EmissionFactor"
  FOR ALL
  USING (
    ("organizationId" IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
  )
  WITH CHECK (
    ("organizationId" IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
  );

-- 6. SPECIAL RLS FOR Notification (Tenant notifications + Platform Admin system notifications)
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_isolation ON "Notification";
CREATE POLICY notification_isolation ON "Notification"
  FOR ALL
  USING (
    ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
    OR ("organizationId" IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
  )
  WITH CHECK (
    ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
    OR ("organizationId" IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
  );

-- ============================================================================
-- 7. HARD DATABASE CHECK CONSTRAINTS (DOMAIN & REGULATORY INTEGRITY)
-- ============================================================================

ALTER TABLE "Organization"
  ADD CONSTRAINT chk_org_single_user_only_internal
    CHECK (NOT "allowSingleUserMode" OR "assuranceStandard" = 'INTERNAL_TRACKING'),
  ADD CONSTRAINT chk_org_fy_start_month
    CHECK ("fyStartMonth" >= 1 AND "fyStartMonth" <= 12),
  ADD CONSTRAINT chk_org_significance_pct
    CHECK ("significanceThresholdPct" > 0 AND "significanceThresholdPct" <= 100);

ALTER TABLE "User"
  ADD CONSTRAINT chk_user_platform_admin_org
    CHECK (
      ("isPlatformAdmin" = true AND "organizationId" IS NULL)
      OR ("isPlatformAdmin" = false AND "organizationId" IS NOT NULL)
    );

ALTER TABLE "Invoice"
  ADD CONSTRAINT chk_invoice_gst_totals
    CHECK (
      "subtotalInr" >= 0
      AND "cgstInr" >= 0
      AND "sgstInr" >= 0
      AND "igstInr" >= 0
      AND ("igstInr" = 0 OR ("cgstInr" = 0 AND "sgstInr" = 0))
      AND "totalInr" = ("subtotalInr" + "cgstInr" + "sgstInr" + "igstInr")
    );

ALTER TABLE "Entity"
  ADD CONSTRAINT chk_entity_effective_dates
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  ADD CONSTRAINT chk_entity_ownership_pct
    CHECK ("ownershipPct" >= 0 AND "ownershipPct" <= 100);

ALTER TABLE "Facility"
  ADD CONSTRAINT chk_facility_effective_dates
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  ADD CONSTRAINT chk_facility_floor_share
    CHECK ("floorAreaSharePct" IS NULL OR ("floorAreaSharePct" > 0 AND "floorAreaSharePct" <= 100)),
  ADD CONSTRAINT chk_facility_greenbelt_pct
    CHECK ("greenbeltPct" IS NULL OR ("greenbeltPct" >= 0 AND "greenbeltPct" <= 100));

ALTER TABLE "ResourceSource"
  ADD CONSTRAINT chk_source_bio_blend_pct
    CHECK ("bioBlendPct" IS NULL OR ("bioBlendPct" >= 0 AND "bioBlendPct" <= 100)),
  ADD CONSTRAINT chk_source_scope3_cat
    CHECK ("scope3Category" IS NULL OR ("scope3Category" >= 1 AND "scope3Category" <= 15)),
  ADD CONSTRAINT chk_source_effective_dates
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");

ALTER TABLE "BoundaryExclusion"
  ADD CONSTRAINT chk_exclusion_scope3_cat
    CHECK ("scope3Category" IS NULL OR ("scope3Category" >= 1 AND "scope3Category" <= 15)),
  ADD CONSTRAINT chk_exclusion_materiality_pct
    CHECK ("estimatedMaterialityPct" IS NULL OR ("estimatedMaterialityPct" >= 0 AND "estimatedMaterialityPct" <= 100));

ALTER TABLE "EmissionFactor"
  ADD CONSTRAINT chk_factor_valid_dates
    CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),
  ADD CONSTRAINT chk_factor_scope3_cat
    CHECK ("scope3Category" IS NULL OR ("scope3Category" >= 1 AND "scope3Category" <= 15)),
  ADD CONSTRAINT chk_factor_non_negative_gases
    CHECK (
      "co2KgPerUnit" >= 0
      AND "biogenicCo2KgPerUnit" >= 0
      AND "ch4KgPerUnit" >= 0
      AND "n2oKgPerUnit" >= 0
      AND ("wttKgCo2ePerUnit" IS NULL OR "wttKgCo2ePerUnit" >= 0)
    ),
  ADD CONSTRAINT chk_factor_positive_phys
    CHECK (
      ("ncvMjPerUnit" IS NULL OR "ncvMjPerUnit" > 0)
      AND ("densityKgPerLitre" IS NULL OR "densityKgPerLitre" > 0)
    ),
  ADD CONSTRAINT chk_factor_custom_no_self_approval
    CHECK (
      "organizationId" IS NULL
      OR "createdById" IS NULL
      OR "approvedById" IS NULL
      OR "createdById" <> "approvedById"
    );

ALTER TABLE "ReportingPeriod"
  ADD CONSTRAINT chk_period_month
    CHECK ("month" >= 1 AND "month" <= 12),
  ADD CONSTRAINT chk_period_dates
    CHECK ("endDate" >= "startDate"),
  ADD CONSTRAINT chk_period_reopen_count
    CHECK ("reopenCount" >= 0);

ALTER TABLE "ResourceEntry"
  ADD CONSTRAINT chk_entry_quality_tier
    CHECK ("dataQualityTier" >= 1 AND "dataQualityTier" <= 5),
  ADD CONSTRAINT chk_entry_non_negative_quantities
    CHECK (
      "rawQuantity" >= 0
      AND "normalizedQuantity" >= 0
      AND ("costInr" IS NULL OR "costInr" >= 0)
      AND ("openingStockQty" IS NULL OR "openingStockQty" >= 0)
      AND ("purchasedQty" IS NULL OR "purchasedQty" >= 0)
      AND ("closingStockQty" IS NULL OR "closingStockQty" >= 0)
      AND ("nonEnergyDeductedQty" IS NULL OR "nonEnergyDeductedQty" >= 0)
      AND ("grossGridImportKwh" IS NULL OR "grossGridImportKwh" >= 0)
      AND ("onsiteSolarSelfConsumedKwh" IS NULL OR "onsiteSolarSelfConsumedKwh" >= 0)
      AND ("solarExportedKwh" IS NULL OR "solarExportedKwh" >= 0)
    ),
  ADD CONSTRAINT chk_entry_stock_balance
    CHECK (
      "openingStockQty" IS NULL
      OR (
        "openingStockQty" + COALESCE("purchasedQty", 0)
        - COALESCE("closingStockQty", 0)
        - COALESCE("nonEnergyDeductedQty", 0)
      ) >= 0
    ),
  ADD CONSTRAINT chk_entry_billing_dates
    CHECK ("billingStartDate" IS NULL OR "billingEndDate" IS NULL OR "billingEndDate" >= "billingStartDate"),
  ADD CONSTRAINT chk_entry_non_negative_emissions
    CHECK (
      "calculatedEnergyGj" >= 0
      AND "calculatedCo2Kg" >= 0
      AND "calculatedBiogenicCo2Kg" >= 0
      AND "calculatedCh4Kg" >= 0
      AND "calculatedN2oKg" >= 0
      AND "calculatedTco2eAr6" >= 0
      AND "calculatedTco2eAr2" >= 0
      AND "calculatedWttTco2e" >= 0
    ),
  ADD CONSTRAINT chk_entry_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "submittedById" IS NULL
      OR "reviewedById" IS NULL
      OR "submittedById" <> "reviewedById"
    );

ALTER TABLE "RefrigerantEquipment"
  ADD CONSTRAINT chk_refrig_nameplate_positive
    CHECK ("nameplateKg" > 0),
  ADD CONSTRAINT chk_refrig_leak_pct
    CHECK ("defaultLeakPct" IS NULL OR ("defaultLeakPct" >= 0 AND "defaultLeakPct" <= 100));

ALTER TABLE "WaterLog"
  ADD CONSTRAINT chk_water_balance
    CHECK (
      "withdrawalKl" >= 0
      AND "dischargeKl" >= 0
      AND "recycledKl" >= 0
      AND "dischargeKl" <= "withdrawalKl"
      AND "consumptionKl" = ("withdrawalKl" - "dischargeKl")
    ),
  ADD CONSTRAINT chk_water_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "submittedById" IS NULL
      OR "reviewedById" IS NULL
      OR "submittedById" <> "reviewedById"
    );

ALTER TABLE "WasteLog"
  ADD CONSTRAINT chk_waste_non_negative
    CHECK ("quantityMt" >= 0 AND "linkedScope3Tco2e" >= 0),
  ADD CONSTRAINT chk_waste_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "submittedById" IS NULL
      OR "reviewedById" IS NULL
      OR "submittedById" <> "reviewedById"
    );

ALTER TABLE "AirEmissionLog"
  ADD CONSTRAINT chk_air_non_negative
    CHECK ("quantityKg" >= 0),
  ADD CONSTRAINT chk_air_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "submittedById" IS NULL
      OR "reviewedById" IS NULL
      OR "submittedById" <> "reviewedById"
    );

ALTER TABLE "MaterialLog"
  ADD CONSTRAINT chk_material_non_negative
    CHECK ("quantityMt" >= 0 AND "linkedScope3Tco2e" >= 0),
  ADD CONSTRAINT chk_material_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "submittedById" IS NULL
      OR "reviewedById" IS NULL
      OR "submittedById" <> "reviewedById"
    );

ALTER TABLE "FacilityOutputLog"
  ADD CONSTRAINT chk_output_non_negative
    CHECK ("outputValue" >= 0),
  ADD CONSTRAINT chk_output_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "submittedById" IS NULL
      OR "reviewedById" IS NULL
      OR "submittedById" <> "reviewedById"
    );

ALTER TABLE "FinancialYearMetrics"
  ADD CONSTRAINT chk_fin_metrics_positive
    CHECK ("revenueInr" > 0 AND "imfPppFactor" > 0 AND "pppAdjustedRevenueUsd" > 0),
  ADD CONSTRAINT chk_fin_value_chain_pct
    CHECK ("valueChainCoveragePct" IS NULL OR ("valueChainCoveragePct" >= 0 AND "valueChainCoveragePct" <= 100));

ALTER TABLE "Scope3Purchase"
  ADD CONSTRAINT chk_scope3_purchase_cat
    CHECK ("scope3Category" >= 1 AND "scope3Category" <= 15),
  ADD CONSTRAINT chk_scope3_purchase_non_negative
    CHECK ("quantity" >= 0 AND "calculatedTco2eAr6" >= 0 AND ("spendInr" IS NULL OR "spendInr" >= 0)),
  ADD CONSTRAINT chk_scope3_no_self_review_unless_flagged
    CHECK (
      "isSelfReviewed" = true
      OR "reviewedById" IS NULL
      OR "enteredById" <> "reviewedById"
    );

ALTER TABLE "Scope2Instrument"
  ADD CONSTRAINT chk_scope2_mwh_balance
    CHECK ("totalMwh" > 0 AND "remainingMwh" >= 0 AND "remainingMwh" <= "totalMwh"),
  ADD CONSTRAINT chk_scope2_valid_dates
    CHECK ("validTo" >= "validFrom"),
  ADD CONSTRAINT chk_scope2_factor_non_negative
    CHECK ("factorKgCo2ePerKwh" >= 0);

ALTER TABLE "Scope2Allocation"
  ADD CONSTRAINT chk_scope2_alloc_positive
    CHECK ("allocatedMwh" > 0);

ALTER TABLE "GreenEconomyCredit"
  ADD CONSTRAINT chk_green_credit_qty_positive
    CHECK ("quantity" > 0),
  ADD CONSTRAINT chk_green_credit_no_self_transfer
    CHECK ("transferredToEntityId" IS NULL OR "transferredToEntityId" <> "entityId"),
  ADD CONSTRAINT chk_green_credit_moefcc_thresholds
    CHECK (
      "instrumentClass" <> 'MOEFCC_GREEN_CREDIT'
      OR "status" NOT IN ('ISSUED', 'EXTINGUISHED', 'TRANSFERRED_SUBSIDIARY')
      OR ("canopyDensityPct" >= 40 AND "restorationYears" >= 5)
    );


ALTER TABLE "Target"
  ADD CONSTRAINT chk_target_bounds
    CHECK (
      "baseValue" > 0
      AND "originalBaseValue" > 0
      AND "targetValue" >= 0
      AND "targetReductionPct" > 0
      AND "targetReductionPct" <= 100
      AND "targetYear" > "baseYear"
    ),
  ADD CONSTRAINT chk_target_intensity_unit
    CHECK ("targetType" <> 'INTENSITY' OR ("intensityUnit" IS NOT NULL AND length(trim("intensityUnit")) > 0)),
  ADD CONSTRAINT chk_target_sbti_absolute_s12
    CHECK (
      "framework" NOT IN ('SBTI_SME_ROUTE', 'SBTI_NEAR_TERM')
      OR "scopeCoverage" NOT IN ('SCOPE_1', 'SCOPE_2_LOCATION', 'SCOPE_2_MARKET', 'SCOPE_1_AND_2_LOCATION', 'SCOPE_1_AND_2_MARKET')
      OR "targetType" = 'ABSOLUTE'
    );

ALTER TABLE "TargetMilestone"
  ADD CONSTRAINT chk_milestone_non_negative
    CHECK ("plannedValue" >= 0 AND ("actualValue" IS NULL OR "actualValue" >= 0));

ALTER TABLE "ReductionAction"
  ADD CONSTRAINT chk_action_bounds
    CHECK (
      "expectedSavingTco2e" >= 0
      AND "secondaryScopeShiftTco2e" >= 0
      AND "biogenicShiftTco2e" >= 0
      AND "lifetimeYears" >= 1
      AND ("capexInr" IS NULL OR "capexInr" >= 0)
      AND ("achievedSavingTco2e" IS NULL OR "achievedSavingTco2e" >= 0)
    ),
  ADD CONSTRAINT chk_action_net_formula
    CHECK ("netExpectedSavingTco2e" = ("expectedSavingTco2e" - "secondaryScopeShiftTco2e")),
  ADD CONSTRAINT chk_action_cancel_reason
    CHECK ("status" <> 'CANCELLED' OR ("cancellationReason" IS NOT NULL AND length(trim("cancellationReason")) > 0)),
  ADD CONSTRAINT chk_action_delay_reason
    CHECK ("status" <> 'DELAYED' OR ("delayReason" IS NOT NULL AND length(trim("delayReason")) > 0));

ALTER TABLE "RecalculationRequest"
  ADD CONSTRAINT chk_recalc_no_self_approval
    CHECK ("decidedById" IS NULL OR "requestedById" <> "decidedById");

ALTER TABLE "PlatformActionApproval"
  ADD CONSTRAINT chk_platform_dual_admin
    CHECK ("approvedById" IS NULL OR "requestedById" <> "approvedById");


ALTER TABLE "ImportBatch"
  ADD CONSTRAINT chk_import_batch_counts
    CHECK (
      "totalRows" >= 0
      AND "validRows" >= 0
      AND "errorRows" >= 0
      AND ("validRows" + "errorRows") <= "totalRows"
    );

ALTER TABLE "ApiKey"
  ADD CONSTRAINT chk_apikey_expiry
    CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt");

ALTER TABLE "InventoryManagementPlan"
  ADD CONSTRAINT chk_imp_no_self_approval
    CHECK ("approvedById" IS NULL OR "authoredById" <> "approvedById"),
  ADD CONSTRAINT chk_imp_version_positive
    CHECK ("version" >= 1);

-- ============================================================================
-- 8. HARD COMPLIANCE & IMMUTABILITY TRIGGERS
-- ============================================================================

-- 8A. COSO ICSR & SEBI BRSR Role Mutual Exclusion Trigger
CREATE OR REPLACE FUNCTION enforce_user_role_mutual_exclusion()
RETURNS TRIGGER AS $$
DECLARE
  org_std TEXT;
  other_roles TEXT[];
BEGIN
  SELECT "assuranceStandard"::text INTO org_std
  FROM "Organization"
  WHERE "id" = NEW."organizationId";

  SELECT COALESCE(array_agg("role"::text), ARRAY[]::text[]) INTO other_roles
  FROM "UserRole"
  WHERE "userId" = NEW."userId"
    AND "organizationId" = NEW."organizationId"
    AND "id" <> COALESCE(NEW."id", '');

  -- Rule 1: EXTERNAL_VERIFIER can NEVER hold any other role (SEBI FAQ / ISO 14064-3 / ISSA 5000)
  IF NEW."role"::text = 'EXTERNAL_VERIFIER' AND array_length(other_roles, 1) > 0 THEN
    RAISE EXCEPTION 'Compliance violation: EXTERNAL_VERIFIER cannot hold any other role.';
  END IF;
  IF 'EXTERNAL_VERIFIER' = ANY(other_roles) THEN
    RAISE EXCEPTION 'Compliance violation: user with EXTERNAL_VERIFIER cannot be assigned additional roles.';
  END IF;

  -- Rule 2: INTERNAL_AUDITOR is 3rd-Line COSO-independent (cannot hold 1st/2nd-line or admin roles)
  IF NEW."role"::text = 'INTERNAL_AUDITOR' AND array_length(other_roles, 1) > 0 THEN
    RAISE EXCEPTION 'COSO ICSR violation: INTERNAL_AUDITOR cannot hold operational, approval, or admin roles.';
  END IF;
  IF 'INTERNAL_AUDITOR' = ANY(other_roles) THEN
    RAISE EXCEPTION 'COSO ICSR violation: user with INTERNAL_AUDITOR cannot be assigned other roles.';
  END IF;

  -- Rule 3: ORG_ADMIN ITGC separation under external assessment/assurance standards
  IF org_std IS NOT NULL AND org_std <> 'INTERNAL_TRACKING' THEN
    IF NEW."role"::text = 'ORG_ADMIN' AND (
      other_roles && ARRAY['PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER', 'EXECUTIVE_APPROVER']
    ) THEN
      RAISE EXCEPTION 'ITGC violation: ORG_ADMIN cannot hold ESG data, finance, or sign-off roles under %.', org_std;
    END IF;
    IF 'ORG_ADMIN' = ANY(other_roles) AND NEW."role"::text = ANY(
      ARRAY['PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER', 'EXECUTIVE_APPROVER']
    ) THEN
      RAISE EXCEPTION 'ITGC violation: ORG_ADMIN cannot be assigned % under %.', NEW."role", org_std;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_role_mutual_exclusion ON "UserRole";
CREATE TRIGGER trg_user_role_mutual_exclusion
  BEFORE INSERT OR UPDATE ON "UserRole"
  FOR EACH ROW EXECUTE FUNCTION enforce_user_role_mutual_exclusion();

-- 8B. SME Single-User Self-Review Guard Trigger
CREATE OR REPLACE FUNCTION enforce_self_review_eligibility()
RETURNS TRIGGER AS $$
DECLARE
  can_self_review BOOLEAN;
BEGIN
  IF NEW."isSelfReviewed" = true THEN
    SELECT ("allowSingleUserMode" = true AND "assuranceStandard" = 'INTERNAL_TRACKING')
    INTO can_self_review
    FROM "Organization"
    WHERE "id" = NEW."organizationId";

    IF NOT COALESCE(can_self_review, false) THEN
      RAISE EXCEPTION 'Maker-Checker violation: self-review is permitted only when Organization.allowSingleUserMode=true and assuranceStandard=INTERNAL_TRACKING.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
  reviewable_tables text[] := ARRAY[
    'ResourceEntry', 'WaterLog', 'WasteLog', 'AirEmissionLog',
    'MaterialLog', 'FacilityOutputLog', 'Scope3Purchase'
  ];
BEGIN
  FOREACH tbl IN ARRAY reviewable_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_self_review_guard ON %I;', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_self_review_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_self_review_eligibility();',
      tbl
    );
  END LOOP;
END $$;

-- 8C. Closed / Signed-Off Reporting Period Write-Lock Trigger
CREATE OR REPLACE FUNCTION prevent_writes_to_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  target_period_id TEXT;
  p_status TEXT;
BEGIN
  target_period_id := COALESCE(NEW."periodId", OLD."periodId");
  SELECT "status"::text INTO p_status
  FROM "ReportingPeriod"
  WHERE "id" = target_period_id;

  IF p_status IN ('CLOSED', 'SIGNED_OFF') THEN
    RAISE EXCEPTION 'Period lock violation: cannot modify records in a % reporting period (reopen via audited workflow first).', p_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
  period_locked_tables text[] := ARRAY[
    'ResourceEntry', 'WaterLog', 'WasteLog', 'AirEmissionLog',
    'MaterialLog', 'FacilityOutputLog', 'Scope3Purchase'
  ];
BEGIN
  FOREACH tbl IN ARRAY period_locked_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_closed_period_lock ON %I;', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_closed_period_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_writes_to_closed_period();',
      tbl
    );
  END LOOP;
END $$;

-- 8D. Locked / Published EmissionFactor Immutability Trigger
CREATE OR REPLACE FUNCTION protect_locked_emission_factor()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."isLocked" = true OR OLD."status" IN ('PUBLISHED', 'SUPERSEDED') THEN
      RAISE EXCEPTION 'Factor immutability violation: cannot delete locked or published EmissionFactor.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."isLocked" = true OR OLD."status" IN ('PUBLISHED', 'SUPERSEDED') THEN
    IF NEW."co2KgPerUnit" IS DISTINCT FROM OLD."co2KgPerUnit"
       OR NEW."biogenicCo2KgPerUnit" IS DISTINCT FROM OLD."biogenicCo2KgPerUnit"
       OR NEW."ch4KgPerUnit" IS DISTINCT FROM OLD."ch4KgPerUnit"
       OR NEW."n2oKgPerUnit" IS DISTINCT FROM OLD."n2oKgPerUnit"
       OR NEW."ncvMjPerUnit" IS DISTINCT FROM OLD."ncvMjPerUnit"
       OR NEW."densityKgPerLitre" IS DISTINCT FROM OLD."densityKgPerLitre"
       OR NEW."canonicalUnit" IS DISTINCT FROM OLD."canonicalUnit"
       OR NEW."calorificBasis" IS DISTINCT FROM OLD."calorificBasis"
       OR NEW."isBiogenic" IS DISTINCT FROM OLD."isBiogenic"
       OR NEW."isRenewable" IS DISTINCT FROM OLD."isRenewable"
       OR NEW."hfcGasCode" IS DISTINCT FROM OLD."hfcGasCode"
       OR NEW."wttKgCo2ePerUnit" IS DISTINCT FROM OLD."wttKgCo2ePerUnit" THEN
      RAISE EXCEPTION 'Factor immutability violation: cannot modify scientific values on a locked or published EmissionFactor; create a new version instead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_locked_factor ON "EmissionFactor";
CREATE TRIGGER trg_protect_locked_factor
  BEFORE UPDATE OR DELETE ON "EmissionFactor"
  FOR EACH ROW EXECUTE FUNCTION protect_locked_emission_factor();

-- 8E. Locked EvidenceFile Chain-of-Custody Trigger
CREATE OR REPLACE FUNCTION protect_locked_evidence_file()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."isLocked" = true THEN
    RAISE EXCEPTION 'Evidence chain-of-custody violation: locked EvidenceFile cannot be modified or deleted.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_locked_evidence ON "EvidenceFile";
CREATE TRIGGER trg_protect_locked_evidence
  BEFORE UPDATE OR DELETE ON "EvidenceFile"
  FOR EACH ROW EXECUTE FUNCTION protect_locked_evidence_file();

-- 8F. 8-Year Statutory Retention Lock Trigger on Organization
CREATE OR REPLACE FUNCTION protect_org_retention_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."retentionLockUntil" IS NOT NULL AND OLD."retentionLockUntil" > NOW() THEN
    RAISE EXCEPTION 'Statutory retention lock violation: Organization cannot be deleted before %.', OLD."retentionLockUntil";
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_org_retention ON "Organization";
CREATE TRIGGER trg_protect_org_retention
  BEFORE DELETE ON "Organization"
  FOR EACH ROW EXECUTE FUNCTION protect_org_retention_lock();

-- 8G. Defense-in-Depth Append-Only Immutability Trigger
CREATE OR REPLACE FUNCTION prevent_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Append-only violation: % is strictly immutable (UPDATE/DELETE forbidden).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
  append_only_tables text[] := ARRAY[
    'AuditLog', 'PlatformAuditLog', 'PeriodSnapshot', 'EntryHistory', 'ExportReport'
  ];
BEGIN
  FOREACH tbl IN ARRAY append_only_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_append_only_immutable ON %I;', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_append_only_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();',
      tbl
    );
  END LOOP;
END $$;

-- 8H. Prevent Moving Goalposts on a Missed Target (Audit Integrity)
CREATE OR REPLACE FUNCTION protect_missed_target_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'MISSED' THEN
    IF NEW."targetYear" IS DISTINCT FROM OLD."targetYear"
       OR NEW."targetReductionPct" IS DISTINCT FROM OLD."targetReductionPct"
       OR NEW."baseValue" IS DISTINCT FROM OLD."baseValue" THEN
      RAISE EXCEPTION 'Target governance violation: cannot alter baseValue, targetYear, or targetReductionPct on a MISSED target; create a new successor target instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_missed_target ON "Target";
CREATE TRIGGER trg_protect_missed_target
  BEFORE UPDATE ON "Target"
  FOR EACH ROW EXECUTE FUNCTION protect_missed_target_tampering();

-- ============================================================================
-- 9. AUTH-CONTEXT & MAIL ISOLATION (security hardening)
--    Before a tenant is known (login, session check) the app binds a narrow
--    identity context (app.auth_user_id / app.auth_email) instead of running unscoped.
-- ============================================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_access ON "User";
CREATE POLICY user_access ON "User"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
    OR "id" = current_setting('app.auth_user_id', true)
    OR "email" = current_setting('app.auth_email', true)
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
    OR "id" = current_setting('app.auth_user_id', true)
  );

DROP POLICY IF EXISTS auth_self_lookup ON "UserRole";
CREATE POLICY auth_self_lookup ON "UserRole"
  FOR SELECT USING ("userId" = current_setting('app.auth_user_id', true));
DROP POLICY IF EXISTS auth_self_lookup ON "UserFacilityAssignment";
CREATE POLICY auth_self_lookup ON "UserFacilityAssignment"
  FOR SELECT USING ("userId" = current_setting('app.auth_user_id', true));

ALTER TABLE "EmailOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailOutbox" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_isolation ON "EmailOutbox";
CREATE POLICY outbox_isolation ON "EmailOutbox"
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR ("organizationId" IS NOT NULL AND "organizationId" = current_setting('app.current_org_id', true))
  );

-- Pre-auth API-key lookup: exact hash match only (SELECT), so ingest can resolve its tenant.
DROP POLICY IF EXISTS api_key_lookup ON "ApiKey";
CREATE POLICY api_key_lookup ON "ApiKey"
  FOR SELECT
  USING (
    current_setting('app.api_key_hash', true) IS NOT NULL
    AND current_setting('app.api_key_hash', true) <> ''
    AND "keyHash" = current_setting('app.api_key_hash', true)
  );

-- Idempotent ingestion: one entry per (organization, external reference).
CREATE UNIQUE INDEX IF NOT EXISTS uq_entry_external_ref ON "ResourceEntry" ("organizationId", "externalRefId") WHERE "externalRefId" IS NOT NULL;

-- 10. An organization cannot hold two live factors with the same code and version (calculations pick by code).
CREATE UNIQUE INDEX IF NOT EXISTS uq_factor_org_code_version
  ON "EmissionFactor" ("organizationId", "code", "versionLabel")
  WHERE "organizationId" IS NOT NULL AND "status" <> 'REJECTED';

-- 11. Platform-admin access. Billing belongs to the platform team (record payments, issue plan changes), and the
--     console shows per-organization facility/entry counts, so those tables need an explicit platform policy.
--     The restricted application role has no other way past FORCE RLS.
DROP POLICY IF EXISTS platform_access ON "Invoice";
CREATE POLICY platform_access ON "Invoice" FOR ALL
  USING (current_setting('app.is_platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_platform_admin', true) = 'true');
DROP POLICY IF EXISTS platform_access ON "Subscription";
CREATE POLICY platform_access ON "Subscription" FOR ALL
  USING (current_setting('app.is_platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_platform_admin', true) = 'true');
DROP POLICY IF EXISTS platform_count_facility ON "Facility";
CREATE POLICY platform_count_facility ON "Facility" FOR SELECT
  USING (current_setting('app.is_platform_admin', true) = 'true');
DROP POLICY IF EXISTS platform_count_entry ON "ResourceEntry";
CREATE POLICY platform_count_entry ON "ResourceEntry" FOR SELECT
  USING (current_setting('app.is_platform_admin', true) = 'true');


-- Fast "contains" search (global search box). Needs the pg_trgm extension.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_trgm_entry_invoice ON "ResourceEntry" USING gin ("invoiceNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_source_name ON "ResourceSource" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_facility_name ON "Facility" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_supplier_name ON "Supplier" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_factor_name ON "EmissionFactor" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_factor_code ON "EmissionFactor" USING gin (code gin_trgm_ops);
