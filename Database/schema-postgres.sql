CREATE TYPE "OrgStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CLOSED');

CREATE TYPE "OrgPreset" AS ENUM ('SME_STANDARD', 'MID_MARKET', 'ENTERPRISE_BRSR');

CREATE TYPE "TenantRole" AS ENUM ('ORG_ADMIN', 'PLANT_MANAGER', 'FINANCE_MANAGER', 'SUSTAINABILITY_LEAD', 'INTERNAL_AUDITOR', 'EXECUTIVE_APPROVER', 'EXTERNAL_VERIFIER');

CREATE TYPE "ConsolidationApproach" AS ENUM ('OPERATIONAL_CONTROL', 'FINANCIAL_CONTROL', 'EQUITY_SHARE');

CREATE TYPE "AssuranceStandard" AS ENUM ('INTERNAL_TRACKING', 'SEBI_ISF_ASSESSMENT', 'ICAI_SSAE_3000', 'ICAI_SSAE_3410', 'ISO_14064_3', 'ISSA_5000', 'BEE_CCTS_ACVA');

CREATE TYPE "EngagementType" AS ENUM ('ASSURANCE', 'ASSESSMENT', 'VALIDATION', 'VERIFICATION');

CREATE TYPE "AssuranceLevel" AS ENUM ('LIMITED', 'REASONABLE');

CREATE TYPE "FacilityType" AS ENUM ('MANUFACTURING_PLANT', 'OFFICE', 'WAREHOUSE', 'DATA_CENTER', 'MINE', 'UTILITY_PLANT', 'OTHER');

CREATE TYPE "ResourceDomain" AS ENUM ('FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT');

CREATE TYPE "EmissionScope" AS ENUM ('SCOPE_1', 'SCOPE_2', 'SCOPE_3', 'BIOGENIC', 'NON_GHG');

CREATE TYPE "FuelCategory" AS ENUM ('SOLID_FOSSIL', 'LIQUID_FOSSIL', 'GASEOUS_FOSSIL', 'BIOGENIC', 'BLENDED_BIOFUEL');

CREATE TYPE "CombustionPurpose" AS ENUM ('STATIONARY_BOILER', 'STATIONARY_FURNACE_KILN', 'DG_SET', 'CAPTIVE_POWER', 'MOBILE_FLEET', 'PROCESS_NON_COMBUSTION', 'NON_ENERGY_FEEDSTOCK', 'TRANSFERRED_OUT');

CREATE TYPE "CalorificBasis" AS ENUM ('NCV', 'GCV_CONVERTED');

CREATE TYPE "MeteringMode" AS ENUM ('STANDARD', 'GROSS_METERING', 'NET_METERING');

CREATE TYPE "WaterSource" AS ENUM ('SURFACE', 'GROUNDWATER', 'THIRD_PARTY', 'SEAWATER_DESALINATED', 'OTHERS');

CREATE TYPE "WaterDestination" AS ENUM ('SURFACE', 'GROUNDWATER', 'SEAWATER', 'THIRD_PARTY', 'OTHERS', 'ZLD_RECYCLED');

CREATE TYPE "WasteCategory" AS ENUM ('PLASTIC', 'E_WASTE', 'BIO_MEDICAL', 'CONSTRUCTION_DEMOLITION', 'BATTERY', 'RADIOACTIVE', 'OTHER_HAZARDOUS', 'OTHER_NON_HAZARDOUS');

CREATE TYPE "WasteRoute" AS ENUM ('RECYCLED', 'REUSED', 'OTHER_RECOVERY', 'INCINERATED_WITH_ENERGY', 'INCINERATED_WITHOUT_ENERGY', 'LANDFILLED', 'OTHER_SAFE_DISPOSAL');

CREATE TYPE "AirPollutant" AS ENUM ('NOX', 'SOX', 'PM', 'PM10', 'PM2_5', 'VOC', 'POP', 'HAP');

CREATE TYPE "MaterialOrigin" AS ENUM ('VIRGIN', 'RECYCLED', 'REUSED');

CREATE TYPE "FactorTier" AS ENUM ('SITE_LAB_CUSTOM', 'SUPPLIER_PCF', 'NATIONAL_OFFICIAL', 'GLOBAL_OFFICIAL');

CREATE TYPE "FactorStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'SUPERSEDED');

CREATE TYPE "RegimeTag" AS ENUM ('GENERAL', 'BRSR_GHG_PROTOCOL', 'BEE_CCTS');

CREATE TYPE "DataBasis" AS ENUM ('ACTUAL_METERED', 'SUPPLIER_PRIMARY', 'SPEND_BASED', 'ESTIMATED_PROXY', 'NIL_ACTIVITY');

CREATE TYPE "RefrigerantMethod" AS ENUM ('MATERIAL_BALANCE', 'SIMPLIFIED_MATERIAL_BALANCE', 'SALES_BASED', 'SCREENING');

CREATE TYPE "EntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'SIGNED_OFF', 'REOPENED');

CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "RecalcTriggerType" AS ENUM ('STRUCTURAL_ACQUISITION', 'STRUCTURAL_DIVESTMENT', 'OUTSOURCING_INSOURCING', 'METHODOLOGY_CHANGE', 'FACTOR_TRUE_UP', 'ERROR_CORRECTION', 'BOUNDARY_CHANGE');

CREATE TYPE "SupplierRequestStatus" AS ENUM ('SENT', 'OTP_VERIFIED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

CREATE TYPE "Scope3Method" AS ENUM ('SUPPLIER_PCF', 'HYBRID', 'AVERAGE_DATA', 'SPEND_BASED');

CREATE TYPE "GreenInstrumentClass" AS ENUM ('BEE_CCTS_ICC', 'VOLUNTARY_CARBON_CREDIT', 'MOEFCC_GREEN_CREDIT');

CREATE TYPE "CreditStatus" AS ENUM ('ISSUED', 'PROCURED', 'PENDING_RETIREMENT', 'RETIRED', 'EXTINGUISHED', 'TRANSFERRED_SUBSIDIARY');

CREATE TYPE "FindingSeverity" AS ENUM ('CLARIFICATION', 'MATERIAL_MISSTATEMENT', 'NONCONFORMITY');

CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'RESPONDED', 'RESOLVED', 'UNRESOLVED');

CREATE TYPE "EngagementStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'OPINION_ISSUED', 'CANCELLED');

CREATE TYPE "AssuranceOpinion" AS ENUM ('UNMODIFIED', 'QUALIFIED', 'ADVERSE', 'DISCLAIMER');

CREATE TYPE "InternalAuditStatus" AS ENUM ('PASS', 'DEFICIENCY', 'REMEDIATION_REQUIRED', 'CLOSED');

CREATE TYPE "TargetType" AS ENUM ('ABSOLUTE', 'INTENSITY');

CREATE TYPE "TargetScopeCoverage" AS ENUM ('SCOPE_1', 'SCOPE_2_LOCATION', 'SCOPE_2_MARKET', 'SCOPE_1_AND_2_LOCATION', 'SCOPE_1_AND_2_MARKET', 'SCOPE_3', 'ALL_SCOPES_1_2_3');

CREATE TYPE "TargetFramework" AS ENUM ('CUSTOM_INTERNAL', 'SBTI_SME_ROUTE', 'SBTI_NEAR_TERM', 'SBTI_NET_ZERO', 'BEE_CCTS_GEI');

CREATE TYPE "TargetStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'ACHIEVED', 'REGRESSED', 'MISSED', 'NEEDS_RESTATEMENT');

CREATE TYPE "ReductionLever" AS ENUM ('FUEL_SWITCH', 'ENERGY_EFFICIENCY', 'ONSITE_SOLAR', 'PPA_OPEN_ACCESS', 'REFRIGERANT_SWAP', 'FLEET_ELECTRIFICATION', 'PROCESS_OPTIMIZATION', 'WATER_CIRCULARITY', 'WASTE_DIVERSION', 'SUPPLIER_ENGAGEMENT');

CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'PARTIALLY_ACHIEVED', 'CANCELLED');

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TYPE "ImportChannel" AS ENUM ('CSV_EXCEL', 'TALLY_ERP', 'API_PUSH');

CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'ROLLED_BACK', 'FAILED');

CREATE TYPE "ExportReportType" AS ENUM ('SME_BUYER_SUMMARY_PDF', 'SEBI_BRSR_CORE_P6', 'BEE_CCTS_FORM_A', 'ISO_14064_INVENTORY', 'ASSURANCE_EVIDENCE_PACK');

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "priceInrMonth" DECIMAL(12,2) NOT NULL,
  "maxFacilities" INTEGER NOT NULL,
  "maxUsers" INTEGER NOT NULL,
  "featuresJson" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cin" TEXT,
  "gstin" TEXT,
  "industrySector" TEXT,
  "preset" "OrgPreset" NOT NULL DEFAULT 'SME_STANDARD',
  "status" "OrgStatus" NOT NULL DEFAULT 'TRIAL',
  "trialEndsAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "retentionLockUntil" TIMESTAMP(3),
  "planId" TEXT NOT NULL,
  "billingEmail" TEXT,
  "billingAddress" TEXT,
  "enabledModules" TEXT[] DEFAULT '{}',
  "allowSingleUserMode" BOOLEAN NOT NULL DEFAULT false,
  "fyStartMonth" INTEGER NOT NULL DEFAULT 4,
  "consolidationApproach" "ConsolidationApproach" NOT NULL DEFAULT 'OPERATIONAL_CONTROL',
  "consolidationApprovedById" TEXT,
  "consolidationApprovedAt" TIMESTAMP(3),
  "significanceThresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "dataDueDays" INTEGER NOT NULL DEFAULT 10,
  "assuranceStandard" "AssuranceStandard" NOT NULL DEFAULT 'INTERNAL_TRACKING',
  "cctsObligated" BOOLEAN NOT NULL DEFAULT false,
  "mfaRequiredForPrivileged" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "razorpaySubId" TEXT UNIQUE,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  "sacCode" TEXT NOT NULL DEFAULT '998314',
  "subtotalInr" DECIMAL(12,2) NOT NULL,
  "cgstInr" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgstInr" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igstInr" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalInr" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PAID',
  "razorpayPaymentId" TEXT UNIQUE,
  "gatewayOrderId" TEXT UNIQUE,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "planId" TEXT,
  "planName" TEXT,
  "gstRatePct" DECIMAL(5,2),
  "placeOfSupply" TEXT,
  "supplierGstin" TEXT,
  "customerName" TEXT,
  "customerGstin" TEXT,
  "customerAddress" TEXT,
  "servicePeriodStart" TIMESTAMP(3),
  "servicePeriodEnd" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceCounter" (
  "financialYear" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("financialYear")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
  "externalId" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "fullName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "emailVerifiedAt" TIMESTAMP(3),
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecret" TEXT,
  "recoveryCodeHashes" TEXT[] DEFAULT '{}',
  "lastLoginAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "twoFactorLastStep" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("userId", "role")
);

CREATE TABLE "UserFacilityAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("userId", "facilityId")
);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roles" "TenantRole"[],
  "facilityIds" TEXT[] DEFAULT '{}',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "AccessCertification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "certifiedById" TEXT NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "notes" TEXT,
  "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "Entity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parentEntityId" TEXT,
  "name" TEXT NOT NULL,
  "cin" TEXT,
  "ownershipPct" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "hasOperationalControl" BOOLEAN NOT NULL DEFAULT true,
  "hasFinancialControl" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "boundaryChangeNote" TEXT,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Facility" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "facilityType" "FacilityType" NOT NULL DEFAULT 'MANUFACTURING_PLANT',
  "businessUnit" TEXT,
  "region" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isSharedBuilding" BOOLEAN NOT NULL DEFAULT false,
  "floorAreaSharePct" DECIMAL(5,2),
  "discomConsumerNo" TEXT,
  "contractDemandKw" DECIMAL(12,2),
  "rooftopSolarKwp" DECIMAL(12,2),
  "meteringMode" "MeteringMode" NOT NULL DEFAULT 'STANDARD',
  "isWaterStressArea" BOOLEAN NOT NULL DEFAULT false,
  "spcbWaterLimitKl" DECIMAL(14,2),
  "totalLandAreaHa" DECIMAL(12,4),
  "greenbeltPct" DECIMAL(5,2),
  "nearEcoSensitiveZone" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "ResourceSource" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" "ResourceDomain" NOT NULL,
  "scope" "EmissionScope" NOT NULL,
  "scope3Category" INTEGER,
  "fuelCategory" "FuelCategory",
  "combustionPurpose" "CombustionPurpose",
  "bioBlendPct" DECIMAL(5,2),
  "canonicalUnit" TEXT NOT NULL,
  "defaultFactorId" TEXT,
  "meterSerialNo" TEXT,
  "ownerId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "BoundaryExclusion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "scope" "EmissionScope" NOT NULL,
  "scope3Category" INTEGER,
  "facilityId" TEXT,
  "excludedItemName" TEXT NOT NULL,
  "justification" TEXT NOT NULL,
  "estimatedMaterialityPct" DECIMAL(5,2),
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "GwpTable" (
  "id" TEXT NOT NULL,
  "gasCode" TEXT NOT NULL UNIQUE,
  "gasName" TEXT NOT NULL,
  "isFossilMethane" BOOLEAN NOT NULL DEFAULT false,
  "gwpAr6" DECIMAL(12,4) NOT NULL,
  "gwpAr5" DECIMAL(12,4) NOT NULL,
  "gwpAr2" DECIMAL(12,4) NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "EmissionFactor" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "parentFactorId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" "ResourceDomain" NOT NULL,
  "scope" "EmissionScope" NOT NULL,
  "scope3Category" INTEGER,
  "tier" "FactorTier" NOT NULL,
  "status" "FactorStatus" NOT NULL DEFAULT 'DRAFT',
  "regimeTag" "RegimeTag" NOT NULL DEFAULT 'GENERAL',
  "region" TEXT NOT NULL DEFAULT 'IN',
  "sourceAuthority" TEXT NOT NULL,
  "versionLabel" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "canonicalUnit" TEXT NOT NULL,
  "calorificBasis" "CalorificBasis" NOT NULL DEFAULT 'NCV',
  "ncvMjPerUnit" DECIMAL(14,6),
  "densityKgPerLitre" DECIMAL(10,6),
  "isRenewable" BOOLEAN NOT NULL DEFAULT false,
  "isBiogenic" BOOLEAN NOT NULL DEFAULT false,
  "co2KgPerUnit" DECIMAL(16,8) NOT NULL DEFAULT 0,
  "biogenicCo2KgPerUnit" DECIMAL(16,8) NOT NULL DEFAULT 0,
  "ch4KgPerUnit" DECIMAL(16,8) NOT NULL DEFAULT 0,
  "isFossilMethane" BOOLEAN NOT NULL DEFAULT false,
  "n2oKgPerUnit" DECIMAL(16,8) NOT NULL DEFAULT 0,
  "hfcGasCode" TEXT,
  "wttKgCo2ePerUnit" DECIMAL(16,8),
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "evidenceFileId" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "ReportingPeriod" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "signedOffAt" TIMESTAMP(3),
  "signedOffById" TEXT,
  "reopenCount" INTEGER NOT NULL DEFAULT 0,
  "lastReopenNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("organizationId", "financialYear", "month")
);

CREATE TABLE "ResourceEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "factorId" TEXT,
  "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "dataBasis" "DataBasis" NOT NULL DEFAULT 'ACTUAL_METERED',
  "dataQualityTier" INTEGER NOT NULL DEFAULT 1,
  "estimationMethod" TEXT,
  "needsTrueUp" BOOLEAN NOT NULL DEFAULT false,
  "isProvisionalFactor" BOOLEAN NOT NULL DEFAULT false,
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "rawQuantity" DECIMAL(16,6) NOT NULL,
  "rawUnit" TEXT NOT NULL,
  "normalizedQuantity" DECIMAL(16,6) NOT NULL,
  "normalizedUnit" TEXT NOT NULL,
  "costInr" DECIMAL(14,2),
  "calorificBasis" "CalorificBasis" NOT NULL DEFAULT 'NCV',
  "openingStockQty" DECIMAL(16,6),
  "purchasedQty" DECIMAL(16,6),
  "closingStockQty" DECIMAL(16,6),
  "nonEnergyDeductedQty" DECIMAL(16,6),
  "labNcvOverride" DECIMAL(14,6),
  "labDensityOverride" DECIMAL(10,6),
  "grossGridImportKwh" DECIMAL(16,4),
  "onsiteSolarSelfConsumedKwh" DECIMAL(16,4),
  "solarExportedKwh" DECIMAL(16,4),
  "splitGroupId" TEXT,
  "importBatchId" TEXT,
  "externalRefId" TEXT,
  "ingestApiKeyId" TEXT,
  "invoiceNumber" TEXT,
  "billingStartDate" TIMESTAMP(3),
  "billingEndDate" TIMESTAMP(3),
  "isIntraGroupTransfer" BOOLEAN NOT NULL DEFAULT false,
  "counterpartyEntityId" TEXT,
  "refrigerantEquipmentId" TEXT,
  "refrigerantMethod" "RefrigerantMethod",
  "pinnedFactorSnapshot" JSONB NOT NULL DEFAULT '{}',
  "appliedFloorAreaSharePct" DECIMAL(5,2),
  "calculatedEnergyGj" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedCo2Kg" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedBiogenicCo2Kg" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedCh4Kg" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedN2oKg" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedTco2eAr6" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedTco2eAr2" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "calculatedWttTco2e" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "qualityFlags" JSONB NOT NULL DEFAULT '[]',
  "outlierConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "outlierNote" TEXT,
  "rejectionCount" INTEGER NOT NULL DEFAULT 0,
  "reviewNote" TEXT,
  "submittedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("organizationId", "externalRefId")
);

CREATE TABLE "EntryHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "EntryStatus",
  "toStatus" "EntryStatus",
  "diffJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceFile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "fileSha256" TEXT NOT NULL,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "RefrigerantEquipment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "equipmentName" TEXT NOT NULL,
  "refrigerantCode" TEXT NOT NULL,
  "nameplateKg" DECIMAL(12,4) NOT NULL,
  "defaultLeakPct" DECIMAL(5,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "WaterLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "withdrawalSource" "WaterSource" NOT NULL,
  "withdrawalKl" DECIMAL(14,4) NOT NULL,
  "dischargeDestination" "WaterDestination",
  "treatmentLevel" TEXT,
  "dischargeKl" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "recycledKl" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "consumptionKl" DECIMAL(14,4) NOT NULL,
  "costInr" DECIMAL(14,2),
  "dataBasis" "DataBasis" NOT NULL DEFAULT 'ACTUAL_METERED',
  "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "evidenceFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "WasteLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "wasteCategory" "WasteCategory" NOT NULL,
  "treatmentRoute" "WasteRoute" NOT NULL,
  "isOnsite" BOOLEAN NOT NULL DEFAULT false,
  "quantityMt" DECIMAL(14,6) NOT NULL,
  "costInr" DECIMAL(14,2),
  "manifestRef" TEXT,
  "linkedScope3Tco2e" DECIMAL(14,6) NOT NULL DEFAULT 0,
  "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "evidenceFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "AirEmissionLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "stackId" TEXT NOT NULL,
  "pollutant" "AirPollutant" NOT NULL,
  "quantityKg" DECIMAL(14,4) NOT NULL,
  "spcbLimitKg" DECIMAL(14,4),
  "spcbLimitNote" TEXT,
  "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "evidenceFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "MaterialLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "materialName" TEXT NOT NULL,
  "isPackagingEpr" BOOLEAN NOT NULL DEFAULT false,
  "origin" "MaterialOrigin" NOT NULL,
  "quantityMt" DECIMAL(14,6) NOT NULL,
  "linkedScope3Tco2e" DECIMAL(14,6) NOT NULL DEFAULT 0,
  "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "evidenceFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "FacilityOutputLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "outputValue" DECIMAL(16,4) NOT NULL,
  "outputUnit" TEXT NOT NULL,
  "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "FinancialYearMetrics" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "revenueInr" DECIMAL(18,2) NOT NULL,
  "imfPppFactor" DECIMAL(10,4) NOT NULL,
  "pppReferenceYear" INTEGER NOT NULL,
  "pppAdjustedRevenueUsd" DECIMAL(18,2) NOT NULL,
  "consolidatedOutputValue" DECIMAL(16,4),
  "consolidatedOutputUnit" TEXT,
  "valueChainCoveragePct" DECIMAL(5,2),
  "certifiedById" TEXT NOT NULL,
  "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("organizationId", "financialYear")
);

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "isTop2PctPartner" BOOLEAN NOT NULL DEFAULT false,
  "tradeSharePct" DECIMAL(5,2),
  "approvedFactorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPcfRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productDescription" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "otpHash" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "otpVerifiedAt" TIMESTAMP(3),
  "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  "otpSentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "SupplierRequestStatus" NOT NULL DEFAULT 'SENT',
  "submittedFactorVal" DECIMAL(16,8),
  "submittedUnit" TEXT,
  "methodologyNote" TEXT,
  "evidenceFileId" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Scope3Purchase" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "supplierId" TEXT,
  "scope3Category" INTEGER NOT NULL,
  "method" "Scope3Method" NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(16,4) NOT NULL,
  "unit" TEXT NOT NULL,
  "spendInr" DECIMAL(16,2),
  "factorId" TEXT NOT NULL,
  "calculatedTco2eAr6" DECIMAL(16,6) NOT NULL,
  "dataQualityTier" INTEGER NOT NULL DEFAULT 3,
  "status" "EntryStatus" NOT NULL DEFAULT 'SUBMITTED',
  "isSelfReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "importBatchId" TEXT,
  "enteredById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Scope2Instrument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "instrumentType" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "certificateRef" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "totalMwh" DECIMAL(14,4) NOT NULL,
  "remainingMwh" DECIMAL(14,4) NOT NULL,
  "factorKgCo2ePerKwh" DECIMAL(16,8) NOT NULL,
  "qualityCriteria" JSONB NOT NULL DEFAULT '{}',
  "passesAllChecks" BOOLEAN NOT NULL DEFAULT false,
  "evidenceFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("organizationId", "certificateRef")
);

CREATE TABLE "Scope2Allocation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "allocatedMwh" DECIMAL(14,4) NOT NULL,
  "isReversed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "GreenEconomyCredit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "transferredToEntityId" TEXT,
  "instrumentClass" "GreenInstrumentClass" NOT NULL,
  "registryName" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "serialRange" TEXT NOT NULL,
  "vintageYear" INTEGER NOT NULL,
  "quantity" DECIMAL(14,4) NOT NULL,
  "status" "CreditStatus" NOT NULL DEFAULT 'ISSUED',
  "restorationParcelId" TEXT,
  "canopyDensityPct" DECIMAL(5,2),
  "restorationYears" INTEGER,
  "evidenceFileId" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("organizationId", "registryName", "serialRange")
);

CREATE TABLE "CctsComplianceTarget" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "sectorName" TEXT NOT NULL,
  "baselineGei" DECIMAL(12,6) NOT NULL,
  "targetGei" DECIMAL(12,6) NOT NULL,
  "achievedGei" DECIMAL(12,6),
  "equivalentOutput" DECIMAL(16,4),
  "iccSurplusOrShortfall" DECIMAL(14,4),
  "signedOffById" TEXT,
  "signedOffAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("facilityId", "financialYear")
);

CREATE TABLE "PeriodSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "isRestatement" BOOLEAN NOT NULL DEFAULT false,
  "recalculationRequestId" TEXT,
  "scope1Ar6Tco2e" DECIMAL(16,6) NOT NULL,
  "scope2LocationAr6Tco2e" DECIMAL(16,6) NOT NULL,
  "scope2MarketAr6Tco2e" DECIMAL(16,6) NOT NULL,
  "scope3Ar6Tco2e" DECIMAL(16,6) NOT NULL,
  "biogenicCo2Tco2e" DECIMAL(16,6) NOT NULL,
  "cctsScope1And2Ar2Tco2e" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "totalEnergyGj" DECIMAL(16,6) NOT NULL,
  "renewableEnergyGj" DECIMAL(16,6) NOT NULL,
  "waterWithdrawalKl" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "waterConsumptionKl" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "waterDischargeKl" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "wasteGeneratedMt" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "wasteRecoveredMt" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "wasteDisposedMt" DECIMAL(16,6) NOT NULL DEFAULT 0,
  "isSelfReviewedOnly" BOOLEAN NOT NULL DEFAULT false,
  "snapshotPayload" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("periodId", "version")
);

CREATE TABLE "RecalculationRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "triggerType" "RecalcTriggerType" NOT NULL,
  "affectedPeriodIds" TEXT[] DEFAULT '{}',
  "estimatedImpactPct" DECIMAL(6,2) NOT NULL,
  "cumulativeImpactPct" DECIMAL(6,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "Target" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetType" "TargetType" NOT NULL DEFAULT 'ABSOLUTE',
  "scopeCoverage" "TargetScopeCoverage" NOT NULL DEFAULT 'SCOPE_1_AND_2_LOCATION',
  "framework" "TargetFramework" NOT NULL DEFAULT 'CUSTOM_INTERNAL',
  "baseYear" TEXT NOT NULL,
  "targetYear" TEXT NOT NULL,
  "baseValue" DECIMAL(16,4) NOT NULL,
  "originalBaseValue" DECIMAL(16,4) NOT NULL,
  "intensityUnit" TEXT,
  "targetReductionPct" DECIMAL(5,2) NOT NULL,
  "targetValue" DECIMAL(16,4) NOT NULL,
  "status" "TargetStatus" NOT NULL DEFAULT 'ON_TRACK',
  "needsBaseRestatement" BOOLEAN NOT NULL DEFAULT false,
  "missedExplanation" TEXT,
  "ownerId" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "TargetMilestone" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "plannedValue" DECIMAL(16,4) NOT NULL,
  "actualValue" DECIMAL(16,4),
  "variancePct" DECIMAL(7,2),
  "status" "TargetStatus" NOT NULL DEFAULT 'ON_TRACK',
  "evaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("targetId", "financialYear")
);

CREATE TABLE "ReductionAction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "facilityId" TEXT,
  "sourceId" TEXT,
  "domain" "ResourceDomain" NOT NULL DEFAULT 'FUEL',
  "lever" "ReductionLever" NOT NULL DEFAULT 'ENERGY_EFFICIENCY',
  "title" TEXT NOT NULL,
  "ownerId" TEXT,
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "expectedSavingTco2e" DECIMAL(14,4) NOT NULL,
  "secondaryScope" "EmissionScope",
  "secondaryScopeShiftTco2e" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "biogenicShiftTco2e" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "netExpectedSavingTco2e" DECIMAL(14,4) NOT NULL,
  "achievedSavingTco2e" DECIMAL(14,4),
  "capexInr" DECIMAL(16,2),
  "annualOpexDeltaInr" DECIMAL(16,2),
  "lifetimeYears" INTEGER NOT NULL DEFAULT 5,
  "paybackYears" DECIMAL(8,2),
  "macInrPerTco2e" DECIMAL(14,2),
  "implementationDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3) NOT NULL,
  "revisedEndDate" TIMESTAMP(3),
  "delayReason" TEXT,
  "cancellationReason" TEXT,
  "evidenceFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "InternalAuditFinding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodId" TEXT,
  "controlDomain" TEXT NOT NULL,
  "status" "InternalAuditStatus" NOT NULL DEFAULT 'DEFICIENCY',
  "summary" TEXT NOT NULL,
  "remediation" TEXT,
  "auditorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "AssuranceEngagement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "verifierUserId" TEXT NOT NULL,
  "verifierFirmName" TEXT NOT NULL,
  "acvaAccreditationNo" TEXT,
  "engagementType" "EngagementType" NOT NULL DEFAULT 'ASSURANCE',
  "assuranceLevel" "AssuranceLevel" NOT NULL DEFAULT 'LIMITED',
  "standard" "AssuranceStandard" NOT NULL,
  "materialityThresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "isPreAssurance" BOOLEAN NOT NULL DEFAULT false,
  "status" "EngagementStatus" NOT NULL DEFAULT 'CREATED',
  "periodModifiedAlert" BOOLEAN NOT NULL DEFAULT false,
  "opinion" "AssuranceOpinion",
  "opinionNotes" TEXT,
  "signedReportFileId" TEXT,
  "opinionIssuedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "AssuranceEngagementPeriod" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("engagementId", "periodId")
);

CREATE TABLE "VerificationFinding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "entryId" TEXT,
  "severity" "FindingSeverity" NOT NULL DEFAULT 'CLARIFICATION',
  "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
  "questionText" TEXT NOT NULL,
  "raisedById" TEXT NOT NULL,
  "responseText" TEXT,
  "respondedById" TEXT,
  "respondedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetOrg" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "PlatformActionApproval" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "EmailOutbox" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "category" TEXT NOT NULL DEFAULT 'SYSTEM',
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "channel" "ImportChannel" NOT NULL DEFAULT 'CSV_EXCEL',
  "domain" "ResourceDomain",
  "fileName" TEXT NOT NULL,
  "fileSha256" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "errorSummaryJson" JSONB NOT NULL DEFAULT '[]',
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
  "uploadedById" TEXT NOT NULL,
  "committedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL UNIQUE,
  "facilityIds" TEXT[] DEFAULT '{}',
  "scopes" TEXT[] DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "InventoryManagementPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "consolidationNarrative" TEXT NOT NULL,
  "methodologyNarrative" TEXT NOT NULL,
  "qaQcProcedures" TEXT NOT NULL,
  "exclusionPolicy" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "authoredById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("organizationId", "financialYear", "version")
);

CREATE TABLE "ExportReport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "periodId" TEXT,
  "reportType" "ExportReportType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "fileSha256" TEXT NOT NULL,
  "snapshotVersion" INTEGER,
  "generatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

ALTER TABLE "Organization" ADD FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserRole" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRole" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFacilityAssignment" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFacilityAssignment" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFacilityAssignment" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSession" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailVerificationToken" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetToken" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessCertification" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Entity" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Entity" ADD FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Facility" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Facility" ADD FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceSource" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceSource" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceSource" ADD FOREIGN KEY ("defaultFactorId") REFERENCES "EmissionFactor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceSource" ADD FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BoundaryExclusion" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BoundaryExclusion" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmissionFactor" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmissionFactor" ADD FOREIGN KEY ("parentFactorId") REFERENCES "EmissionFactor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmissionFactor" ADD FOREIGN KEY ("hfcGasCode") REFERENCES "GwpTable"("gasCode") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmissionFactor" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportingPeriod" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("sourceId") REFERENCES "ResourceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("factorId") REFERENCES "EmissionFactor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("counterpartyEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("refrigerantEquipmentId") REFERENCES "RefrigerantEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceEntry" ADD FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EntryHistory" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EntryHistory" ADD FOREIGN KEY ("entryId") REFERENCES "ResourceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceFile" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceFile" ADD FOREIGN KEY ("entryId") REFERENCES "ResourceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefrigerantEquipment" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefrigerantEquipment" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefrigerantEquipment" ADD FOREIGN KEY ("refrigerantCode") REFERENCES "GwpTable"("gasCode") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaterLog" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaterLog" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaterLog" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaterLog" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WasteLog" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WasteLog" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WasteLog" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WasteLog" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AirEmissionLog" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AirEmissionLog" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AirEmissionLog" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AirEmissionLog" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialLog" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialLog" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialLog" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialLog" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FacilityOutputLog" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FacilityOutputLog" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FacilityOutputLog" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialYearMetrics" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Supplier" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Supplier" ADD FOREIGN KEY ("approvedFactorId") REFERENCES "EmissionFactor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPcfRequest" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPcfRequest" ADD FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPcfRequest" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Scope3Purchase" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope3Purchase" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope3Purchase" ADD FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Scope3Purchase" ADD FOREIGN KEY ("factorId") REFERENCES "EmissionFactor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope3Purchase" ADD FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Scope2Instrument" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope2Instrument" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope2Instrument" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Scope2Allocation" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope2Allocation" ADD FOREIGN KEY ("instrumentId") REFERENCES "Scope2Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Scope2Allocation" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenEconomyCredit" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenEconomyCredit" ADD FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenEconomyCredit" ADD FOREIGN KEY ("transferredToEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GreenEconomyCredit" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CctsComplianceTarget" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CctsComplianceTarget" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PeriodSnapshot" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PeriodSnapshot" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PeriodSnapshot" ADD FOREIGN KEY ("recalculationRequestId") REFERENCES "RecalculationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecalculationRequest" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Target" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TargetMilestone" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TargetMilestone" ADD FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReductionAction" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReductionAction" ADD FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReductionAction" ADD FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReductionAction" ADD FOREIGN KEY ("sourceId") REFERENCES "ResourceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReductionAction" ADD FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalAuditFinding" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternalAuditFinding" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssuranceEngagement" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssuranceEngagement" ADD FOREIGN KEY ("verifierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssuranceEngagement" ADD FOREIGN KEY ("signedReportFileId") REFERENCES "EvidenceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssuranceEngagementPeriod" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssuranceEngagementPeriod" ADD FOREIGN KEY ("engagementId") REFERENCES "AssuranceEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssuranceEngagementPeriod" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VerificationFinding" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VerificationFinding" ADD FOREIGN KEY ("engagementId") REFERENCES "AssuranceEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VerificationFinding" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VerificationFinding" ADD FOREIGN KEY ("entryId") REFERENCES "ResourceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlatformActionApproval" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportBatch" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportBatch" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApiKey" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryManagementPlan" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExportReport" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExportReport" ADD FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX ON "Plan" ("id");

CREATE UNIQUE INDEX ON "Plan" ("code");

CREATE INDEX ON "Organization" ("id");

CREATE INDEX ON "Organization" ("status", "planId");

CREATE INDEX ON "Subscription" ("id");

CREATE UNIQUE INDEX ON "Subscription" ("razorpaySubId");

CREATE INDEX ON "Subscription" ("organizationId", "status");

CREATE INDEX ON "Invoice" ("id");

CREATE UNIQUE INDEX ON "Invoice" ("invoiceNumber");

CREATE UNIQUE INDEX ON "Invoice" ("razorpayPaymentId");

CREATE UNIQUE INDEX ON "Invoice" ("gatewayOrderId");

CREATE INDEX ON "Invoice" ("organizationId", "issuedAt");

CREATE INDEX ON "InvoiceCounter" ("financialYear");

CREATE INDEX ON "WebhookEvent" ("id");

CREATE UNIQUE INDEX ON "WebhookEvent" ("externalId");

CREATE INDEX ON "WebhookEvent" ("eventType", "processedAt");

CREATE INDEX ON "User" ("id");

CREATE UNIQUE INDEX ON "User" ("email");

CREATE INDEX ON "User" ("organizationId", "isActive");

CREATE INDEX ON "UserRole" ("id");

CREATE INDEX ON "UserRole" ("organizationId", "role");

CREATE UNIQUE INDEX ON "UserRole" ("userId", "role");

CREATE INDEX ON "UserFacilityAssignment" ("id");

CREATE INDEX ON "UserFacilityAssignment" ("organizationId", "facilityId");

CREATE UNIQUE INDEX ON "UserFacilityAssignment" ("userId", "facilityId");

CREATE INDEX ON "UserSession" ("id");

CREATE UNIQUE INDEX ON "UserSession" ("tokenHash");

CREATE INDEX ON "UserSession" ("userId", "revokedAt");

CREATE INDEX ON "UserSession" ("expiresAt");

CREATE INDEX ON "Invitation" ("id");

CREATE UNIQUE INDEX ON "Invitation" ("tokenHash");

CREATE INDEX ON "Invitation" ("organizationId", "email");

CREATE INDEX ON "EmailVerificationToken" ("id");

CREATE UNIQUE INDEX ON "EmailVerificationToken" ("tokenHash");

CREATE INDEX ON "EmailVerificationToken" ("userId");

CREATE INDEX ON "PasswordResetToken" ("id");

CREATE UNIQUE INDEX ON "PasswordResetToken" ("tokenHash");

CREATE INDEX ON "PasswordResetToken" ("userId");

CREATE INDEX ON "AccessCertification" ("id");

CREATE INDEX ON "AccessCertification" ("organizationId", "certifiedAt");

CREATE INDEX ON "Entity" ("id");

CREATE INDEX ON "Entity" ("organizationId", "effectiveFrom", "effectiveTo");

CREATE INDEX ON "Facility" ("id");

CREATE INDEX ON "Facility" ("organizationId", "entityId");

CREATE INDEX ON "Facility" ("organizationId", "effectiveFrom", "effectiveTo");

CREATE INDEX ON "ResourceSource" ("id");

CREATE INDEX ON "ResourceSource" ("organizationId", "facilityId", "domain");

CREATE INDEX ON "ResourceSource" ("organizationId", "ownerId");

CREATE INDEX ON "BoundaryExclusion" ("id");

CREATE INDEX ON "BoundaryExclusion" ("organizationId", "financialYear");

CREATE INDEX ON "GwpTable" ("id");

CREATE UNIQUE INDEX ON "GwpTable" ("gasCode");

CREATE INDEX ON "EmissionFactor" ("id");

CREATE INDEX ON "EmissionFactor" ("organizationId", "code", "status");

CREATE INDEX ON "EmissionFactor" ("status", "scope", "validFrom", "validTo");

CREATE INDEX ON "ReportingPeriod" ("id");

CREATE INDEX ON "ReportingPeriod" ("organizationId", "status");

CREATE UNIQUE INDEX ON "ReportingPeriod" ("organizationId", "financialYear", "month");

CREATE INDEX ON "ResourceEntry" ("id");

CREATE INDEX ON "ResourceEntry" ("organizationId", "periodId", "status");

CREATE INDEX ON "ResourceEntry" ("organizationId", "sourceId", "invoiceNumber");

CREATE INDEX ON "ResourceEntry" ("organizationId", "splitGroupId");

CREATE UNIQUE INDEX ON "ResourceEntry" ("organizationId", "externalRefId");

CREATE INDEX ON "EntryHistory" ("id");

CREATE INDEX ON "EntryHistory" ("organizationId", "entryId");

CREATE INDEX ON "EvidenceFile" ("id");

CREATE UNIQUE INDEX ON "EvidenceFile" ("storageKey");

CREATE INDEX ON "EvidenceFile" ("organizationId", "entryId");

CREATE INDEX ON "RefrigerantEquipment" ("id");

CREATE INDEX ON "RefrigerantEquipment" ("organizationId", "facilityId");

CREATE INDEX ON "WaterLog" ("id");

CREATE INDEX ON "WaterLog" ("organizationId", "periodId", "facilityId");

CREATE INDEX ON "WasteLog" ("id");

CREATE INDEX ON "WasteLog" ("organizationId", "periodId", "facilityId");

CREATE INDEX ON "AirEmissionLog" ("id");

CREATE INDEX ON "AirEmissionLog" ("organizationId", "periodId", "facilityId");

CREATE INDEX ON "MaterialLog" ("id");

CREATE INDEX ON "MaterialLog" ("organizationId", "periodId", "facilityId");

CREATE INDEX ON "FacilityOutputLog" ("id");

CREATE INDEX ON "FacilityOutputLog" ("organizationId", "periodId", "facilityId");

CREATE INDEX ON "FinancialYearMetrics" ("id");

CREATE UNIQUE INDEX ON "FinancialYearMetrics" ("organizationId", "financialYear");

CREATE INDEX ON "Supplier" ("id");

CREATE INDEX ON "Supplier" ("organizationId", "isTop2PctPartner");

CREATE INDEX ON "SupplierPcfRequest" ("id");

CREATE UNIQUE INDEX ON "SupplierPcfRequest" ("tokenHash");

CREATE INDEX ON "SupplierPcfRequest" ("organizationId", "supplierId", "status");

CREATE INDEX ON "Scope3Purchase" ("id");

CREATE INDEX ON "Scope3Purchase" ("organizationId", "periodId", "scope3Category");

CREATE INDEX ON "Scope2Instrument" ("id");

CREATE INDEX ON "Scope2Instrument" ("organizationId", "facilityId", "validFrom", "validTo");

CREATE UNIQUE INDEX ON "Scope2Instrument" ("organizationId", "certificateRef");

CREATE INDEX ON "Scope2Allocation" ("id");

CREATE INDEX ON "Scope2Allocation" ("organizationId", "periodId", "isReversed");

CREATE INDEX ON "GreenEconomyCredit" ("id");

CREATE INDEX ON "GreenEconomyCredit" ("organizationId", "instrumentClass", "status");

CREATE UNIQUE INDEX ON "GreenEconomyCredit" ("organizationId", "registryName", "serialRange");

CREATE INDEX ON "CctsComplianceTarget" ("id");

CREATE INDEX ON "CctsComplianceTarget" ("organizationId", "financialYear");

CREATE UNIQUE INDEX ON "CctsComplianceTarget" ("facilityId", "financialYear");

CREATE INDEX ON "PeriodSnapshot" ("id");

CREATE INDEX ON "PeriodSnapshot" ("organizationId", "periodId");

CREATE UNIQUE INDEX ON "PeriodSnapshot" ("periodId", "version");

CREATE INDEX ON "RecalculationRequest" ("id");

CREATE INDEX ON "RecalculationRequest" ("organizationId", "status");

CREATE INDEX ON "Target" ("id");

CREATE INDEX ON "Target" ("organizationId", "status");

CREATE INDEX ON "TargetMilestone" ("id");

CREATE INDEX ON "TargetMilestone" ("organizationId", "financialYear");

CREATE UNIQUE INDEX ON "TargetMilestone" ("targetId", "financialYear");

CREATE INDEX ON "ReductionAction" ("id");

CREATE INDEX ON "ReductionAction" ("organizationId", "targetId", "status");

CREATE INDEX ON "ReductionAction" ("organizationId", "facilityId", "sourceId");

CREATE INDEX ON "InternalAuditFinding" ("id");

CREATE INDEX ON "InternalAuditFinding" ("organizationId", "status");

CREATE INDEX ON "AssuranceEngagement" ("id");

CREATE INDEX ON "AssuranceEngagement" ("organizationId", "verifierUserId", "status");

CREATE INDEX ON "AssuranceEngagementPeriod" ("id");

CREATE INDEX ON "AssuranceEngagementPeriod" ("organizationId", "periodId");

CREATE UNIQUE INDEX ON "AssuranceEngagementPeriod" ("engagementId", "periodId");

CREATE INDEX ON "VerificationFinding" ("id");

CREATE INDEX ON "VerificationFinding" ("organizationId", "engagementId", "status");

CREATE INDEX ON "AuditLog" ("id");

CREATE INDEX ON "AuditLog" ("organizationId", "createdAt");

CREATE INDEX ON "PlatformAuditLog" ("id");

CREATE INDEX ON "PlatformAuditLog" ("createdAt");

CREATE INDEX ON "PlatformActionApproval" ("id");

CREATE INDEX ON "PlatformActionApproval" ("status");

CREATE INDEX ON "Notification" ("id");

CREATE INDEX ON "Notification" ("userId", "isRead", "createdAt");

CREATE INDEX ON "EmailOutbox" ("id");

CREATE INDEX ON "EmailOutbox" ("status", "nextRetryAt");

CREATE INDEX ON "EmailOutbox" ("organizationId", "createdAt");

CREATE INDEX ON "ImportBatch" ("id");

CREATE INDEX ON "ImportBatch" ("organizationId", "periodId", "status");

CREATE INDEX ON "ApiKey" ("id");

CREATE UNIQUE INDEX ON "ApiKey" ("keyHash");

CREATE INDEX ON "ApiKey" ("organizationId", "isActive");

CREATE INDEX ON "InventoryManagementPlan" ("id");

CREATE INDEX ON "InventoryManagementPlan" ("organizationId", "financialYear");

CREATE UNIQUE INDEX ON "InventoryManagementPlan" ("organizationId", "financialYear", "version");

CREATE INDEX ON "ExportReport" ("id");

CREATE UNIQUE INDEX ON "ExportReport" ("storageKey");

CREATE INDEX ON "ExportReport" ("organizationId", "financialYear", "reportType");