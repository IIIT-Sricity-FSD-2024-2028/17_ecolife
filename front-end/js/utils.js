/**
 * RORIZON UI UTILITIES
 * Centralized logic for global UI components, sessions, and notifications.
 */

const Utils = {
    API_BASE: (() => {
        const isHttpPage = window.location.protocol === 'http:' || window.location.protocol === 'https:';
        return isHttpPage ? window.location.origin : 'http://127.0.0.1:3000';
    })(),
    dbCache: null,
    dbLoadPromise: null,
    normalizeApiPath: (path) => {
        const normalizedPath = String(path || '');
        return normalizedPath.startsWith('/api/') ? normalizedPath : `/api${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
    },
    apiFetch: async (method, path, body = null, role = null) => {
        try {
            const currentUser = Utils.getCurrentUser();
            const response = await fetch(`${Utils.API_BASE}${Utils.normalizeApiPath(path)}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-role': role || Utils.getRoleHeader(),
                    'x-user-id': currentUser?.id ? String(currentUser.id) : '',
                    'x-organization-id': currentUser?.organizationId || '',
                    'x-department-id': currentUser?.departmentId || ''
                },
                body: body ? JSON.stringify(body) : null
            });
            if (!response.ok) {
                let errMsg = `[API] ${method} ${Utils.normalizeApiPath(path)} → HTTP ${response.status}`;
                try { const eb = await response.json(); errMsg += ': ' + (eb?.message || JSON.stringify(eb)); } catch (_) { /* no body */ }
                console.warn(errMsg);
                return null;
            }
            const payload = await response.json();
            return payload.data !== undefined ? payload.data : payload;
        } catch (error) {
            console.warn(`[API] ${method} ${Utils.normalizeApiPath(path)} failed.`, error);
            return null;
        }
    },
    lastPersistedDb: null,
    loadDB: async () => {
        if (Utils.dbLoadPromise) return Utils.dbLoadPromise;
        Utils.dbLoadPromise = Utils.apiFetch('GET', '/api/db')
            .then((remoteDb) => {
                if (remoteDb && typeof remoteDb === 'object') {
                    const sessionUser = Utils.getCurrentUser();
                    if (sessionUser && Array.isArray(remoteDb.users)) {
                        const currentUserInDb = remoteDb.users.find(entry => String(entry.id) === String(sessionUser.id));
                        if (currentUserInDb && (!currentUserInDb.password || !currentUserInDb.password.trim())) {
                            currentUserInDb.password = sessionUser.password;
                        }
                    }
                    Utils.dbCache = remoteDb;
                    Utils.lastPersistedDb = JSON.parse(JSON.stringify(remoteDb));
                    window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db: remoteDb } }));
                }
                return Utils.dbCache || {};
            })
            .finally(() => {
                Utils.dbLoadPromise = null;
            });
        return Utils.dbLoadPromise;
    },
    /** Force-pull /api/db from the backend and notify all listeners. */
    refreshFromBackend: async () => {
        Utils.dbLoadPromise = null;
        return Utils.loadDB();
    },
    /** Start background polling every `intervalMs` ms to sync cross-user changes. Returns the interval handle. */
    startPolling: (intervalMs = 15000) => {
        return setInterval(async () => {
            const fresh = await Utils.apiFetch('GET', '/api/db');
            if (fresh && typeof fresh === 'object') {
                Utils.dbCache = fresh;
                Utils.lastPersistedDb = JSON.parse(JSON.stringify(fresh));
                window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db: fresh } }));
            }
        }, intervalMs);
    },
    syncCollectionCrud: (previousDb, nextDb, collectionName, endpoint) => {
        const before = Array.isArray(previousDb?.[collectionName]) ? previousDb[collectionName] : [];
        const after = Array.isArray(nextDb?.[collectionName]) ? nextDb[collectionName] : [];
        const beforeMap = new Map(before.map(item => [String(item.id), item]));
        const afterMap = new Map(after.map(item => [String(item.id), item]));
        const canSync = (method) => Utils.canSyncResource(method, collectionName);

        after.forEach((item) => {
            const id = String(item.id);
            if (!beforeMap.has(id)) {
                if (canSync('POST')) void Utils.apiFetch('POST', endpoint, item);
                return;
            }
            if (JSON.stringify(beforeMap.get(id)) !== JSON.stringify(item)) {
                if (canSync('PATCH')) void Utils.apiFetch('PATCH', `${endpoint}/${encodeURIComponent(id)}`, item);
            }
        });

        before.forEach((item) => {
            const id = String(item.id);
            if (!afterMap.has(id)) {
                if (canSync('DELETE')) void Utils.apiFetch('DELETE', `${endpoint}/${encodeURIComponent(id)}`);
            }
        });
    },
    canSyncResource: (method, collectionName) => {
        const role = Utils.getRoleHeader();
        if (role === 'Super User') return true;

        const permissions = {
            COO: {
                users: ['POST', 'PATCH', 'DELETE'],
                departments: ['POST', 'PATCH', 'DELETE'],
                organizations: ['PATCH'],
                reports: ['PATCH'],
                alerts: ['POST', 'PATCH'],
                notifications: ['POST', 'PATCH', 'DELETE'],
                evidences: ['POST', 'PATCH'],
                importBatches: ['POST', 'PATCH'],
                resourceRecords: ['POST'],
                subscriptions: ['POST', 'PATCH', 'PUT']
            },
            Manager: {
                users: ['PATCH'],
                submissions: ['POST'],
                alerts: ['PATCH'],
                notifications: ['POST', 'PATCH', 'DELETE']
            },
            Analyst: {
                users: ['PATCH'],
                submissions: ['PATCH'],
                reports: ['POST', 'PATCH'],
                alerts: ['POST', 'PATCH'],
                notifications: ['POST', 'PATCH', 'DELETE']
            }
        };

        return Boolean(permissions[role]?.[collectionName]?.includes(method));
    },
    syncResourceCrud: (previousDb, nextDb) => {
        const resources = [
            ['users', '/api/users'],
            ['departments', '/api/departments'],
            ['organizations', '/api/organizations'],
            ['reports', '/api/reports'],
            ['alerts', '/api/alerts'],
            ['submissions', '/api/submissions'],
            ['notifications', '/api/notifications'],
            ['resourceCategories', '/api/resources/categories'],
            ['units', '/api/resources/units'],
            ['resourceTypes', '/api/resources/types'],
            ['resourceUnitCompatibilities', '/api/resources/compatibilities'],
            ['factorSources', '/api/factors/sources'],
            ['factorVersions', '/api/factors/versions'],
            ['emissionFactors', '/api/factors'],
            ['evidences', '/api/evidence'],
            ['importBatches', '/api/imports'],
            ['resourceRecords', '/api/resource-records'],
            ['plans', '/api/revenue/plans'],
            ['subscriptions', '/api/revenue/subscriptions']
        ];
        resources.forEach(([collectionName, endpoint]) => {
            Utils.syncCollectionCrud(previousDb || {}, nextDb || {}, collectionName, endpoint);
        });
    },
    persistDB: (previousDb, db) => {
        void Utils.apiFetch('PUT', '/api/db/snapshot', db).then((remoteDb) => {
            if (remoteDb && typeof remoteDb === 'object') {
                Utils.dbCache = remoteDb;
                Utils.lastPersistedDb = JSON.parse(JSON.stringify(remoteDb));
                window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db: remoteDb } }));
            }
        });
        Utils.syncResourceCrud(previousDb || {}, db || {});
    },
    getRoleHeader: () => {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            return currentUser && currentUser.role ? currentUser.role : 'Super User';
        } catch (error) {
            return 'Super User';
        }
    },
    // 1. Storage & State Management
    getDB: () => {
        if (!Utils.dbCache) void Utils.loadDB();
        return Utils.dbCache || {};
    },
    saveToDB: (key, data) => {
        const previousDb = Utils.lastPersistedDb ? JSON.parse(JSON.stringify(Utils.lastPersistedDb)) : (Utils.dbCache ? JSON.parse(JSON.stringify(Utils.dbCache)) : {});
        const db = JSON.parse(JSON.stringify(Utils.getDB()));
        db[key] = data;
        Utils.dbCache = db;
        Utils.lastPersistedDb = JSON.parse(JSON.stringify(db));
        window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db } }));
        try { localStorage.setItem('rorizon_db_tick', String(Date.now())); } catch (_) {}
        Utils.persistDB(previousDb, db);
    },
    replaceDB: (db, explicitPreviousDb = null) => {
        const previousDb = explicitPreviousDb || (Utils.lastPersistedDb ? JSON.parse(JSON.stringify(Utils.lastPersistedDb)) : (Utils.dbCache ? JSON.parse(JSON.stringify(Utils.dbCache)) : {}));
        const nextDb = JSON.parse(JSON.stringify(db));
        Utils.dbCache = nextDb;
        Utils.lastPersistedDb = JSON.parse(JSON.stringify(nextDb));
        window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db: nextDb } }));
        try { localStorage.setItem('rorizon_db_tick', String(Date.now())); } catch (_) {}
        Utils.persistDB(previousDb, nextDb);
    },


    getCurrentUser: () => JSON.parse(localStorage.getItem('currentUser')) || null,
    getCurrentOrganization: (user = Utils.getCurrentUser(), db = null) => {
        const state = Utils.ensureCollections(db || Utils.getDB());
        if (!user) return (state.organizations && state.organizations[0]) || null;
        if (user.organizationId) {
            const found = state.organizations.find(org => org.id === user.organizationId);
            if (found) return found;
        }
        if (user.role === 'COO') {
            const foundByCoo = state.organizations.find(org => String(org.cooUserId) === String(user.id) || org.cooEmail?.toLowerCase() === user.email?.toLowerCase());
            if (foundByCoo) return foundByCoo;
        }
        if (user.role === 'Manager' && user.departmentId) {
            const department = state.departments.find(dept => dept.id === user.departmentId);
            if (department) {
                const foundOrg = state.organizations.find(org => org.id === department.orgId);
                if (foundOrg) return foundOrg;
            }
        }
        if (user.role === 'Analyst') {
            const scopedDepartmentId = Array.isArray(user.assignedDepartmentIds) ? user.assignedDepartmentIds.find(Boolean) : null;
            const department = scopedDepartmentId ? state.departments.find(dept => dept.id === scopedDepartmentId) : null;
            if (department) {
                const foundOrg = state.organizations.find(org => org.id === department.orgId);
                if (foundOrg) return foundOrg;
            }
        }
        return (state.organizations && state.organizations[0]) || null;
    },
    getCurrentDepartment: (user = Utils.getCurrentUser(), db = null) => {
        const state = Utils.ensureCollections(db || Utils.getDB());
        if (!user) return (state.departments && state.departments[0]) || null;
        if (user.role === 'Manager') {
            if (user.departmentId) {
                const found = state.departments.find(dept => dept.id === user.departmentId);
                if (found) return found;
            }
            const foundByManager = state.departments.find(dept => String(dept.managerUserId) === String(user.id) || (dept.manager && dept.manager === user.name));
            if (foundByManager) return foundByManager;
        }
        if (user.role === 'Analyst') {
            const scopedDeptId = Array.isArray(user.assignedDepartmentIds) ? user.assignedDepartmentIds.find(Boolean) : null;
            if (scopedDeptId) {
                const found = state.departments.find(dept => dept.id === scopedDeptId);
                if (found) return found;
            }
        }
        return (state.departments && state.departments[0]) || null;
    },
    getContextSubtitle: (user = Utils.getCurrentUser(), db = null) => {
        const state = Utils.ensureCollections(db || Utils.getDB());
        if (!user) return '';
        const organization = Utils.getCurrentOrganization(user, state);
        const department = Utils.getCurrentDepartment(user, state);

        if (['COO', 'Manager', 'Analyst'].includes(user.role)) {
            return organization ? organization.name : (department ? department.name : 'Organization workspace');
        }

        return '';
    },
    parseAmount: (value) => {
        const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
        return match ? Number(match[0]) : 0;
    },
    formatVolume: (value, unit = 'Units') => `${Math.round(Number(value || 0)).toLocaleString()} ${unit}`,
    formatPeriodLabel: (period) => {
        const raw = String(period || '').trim();
        const monthMap = {
            '01': 'January', '1': 'January', Jan: 'January', January: 'January',
            '02': 'February', '2': 'February', Feb: 'February', February: 'February',
            '03': 'March', '3': 'March', Mar: 'March', March: 'March',
            '04': 'April', '4': 'April', Apr: 'April', April: 'April',
            '05': 'May', '5': 'May', May: 'May',
            '06': 'June', '6': 'June', Jun: 'June', June: 'June',
            '07': 'July', '7': 'July', Jul: 'July', July: 'July',
            '08': 'August', '8': 'August', Aug: 'August', August: 'August',
            '09': 'September', '9': 'September', Sep: 'September', September: 'September',
            '10': 'October', Oct: 'October', October: 'October',
            '11': 'November', Nov: 'November', November: 'November',
            '12': 'December', Dec: 'December', December: 'December',
        };
        const parts = raw.split(/\s+/).filter(Boolean);
        if (parts.length >= 2 && monthMap[parts[0]]) return `${monthMap[parts[0]]} ${parts[1]}`;
        return raw || '--';
    },
    periodMonthValue: (period) => {
        const raw = String(period || '').trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        const monthLookup = {
            Jan: '01', January: '01', Feb: '02', February: '02', Mar: '03', March: '03',
            Apr: '04', April: '04', May: '05', Jun: '06', June: '06', Jul: '07', July: '07',
            Aug: '08', August: '08', Sep: '09', September: '09', Oct: '10', October: '10',
            Nov: '11', November: '11', Dec: '12', December: '12'
        };
        if (parts.length >= 2) {
            const month = String(Number(parts[0]) || '').padStart(2, '0');
            return (/^\d{2}$/.test(month) && month !== '00') ? month : (monthLookup[parts[0]] || '01');
        }
        return '01';
    },
    periodYearValue: (period) => {
        const parts = String(period || '').trim().split(/\s+/).filter(Boolean);
        return parts.length >= 2 ? parts[1] : String(new Date().getFullYear());
    },
    periodKey: (period) => {
        const raw = String(period || '').trim();
        const monthMap = {
            Jan: 1, January: 1, Feb: 2, February: 2, Mar: 3, March: 3, Apr: 4, April: 4,
            May: 5, Jun: 6, June: 6, Jul: 7, July: 7, Aug: 8, August: 8,
            Sep: 9, September: 9, Oct: 10, October: 10, Nov: 11, November: 11, Dec: 12, December: 12
        };
        const parts = raw.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const month = Number(parts[0]) || monthMap[parts[0]] || 0;
            const year = Number(parts[1]) || 0;
            return year * 100 + month;
        }
        return 0;
    },
    sortByPeriodDesc: (items) => [...(items || [])].sort((left, right) => Utils.periodKey(right.period) - Utils.periodKey(left.period)),
    sortByPeriodAsc: (items) => [...(items || [])].sort((left, right) => Utils.periodKey(left.period) - Utils.periodKey(right.period)),
    latestByPeriod: (items) => Utils.sortByPeriodDesc(items)[0] || null,
    ensureCollections: (db) => {
        db.users = Array.isArray(db.users) ? db.users : [];
        db.organizations = Array.isArray(db.organizations) ? db.organizations : [];
        db.departments = Array.isArray(db.departments) ? db.departments : [];
        db.submissions = Array.isArray(db.submissions) ? db.submissions : [];
        db.resourceCategories = Array.isArray(db.resourceCategories) ? db.resourceCategories : [];
        db.units = Array.isArray(db.units) ? db.units : [];
        db.resourceTypes = Array.isArray(db.resourceTypes) ? db.resourceTypes : [];
        db.resourceUnitCompatibilities = Array.isArray(db.resourceUnitCompatibilities) ? db.resourceUnitCompatibilities : [];
        db.factorSources = Array.isArray(db.factorSources) ? db.factorSources : [];
        db.factorVersions = Array.isArray(db.factorVersions) ? db.factorVersions : [];
        db.emissionFactors = Array.isArray(db.emissionFactors) ? db.emissionFactors : [];
        db.evidences = Array.isArray(db.evidences) ? db.evidences : [];
        db.importBatches = Array.isArray(db.importBatches) ? db.importBatches : [];
        db.importErrors = Array.isArray(db.importErrors) ? db.importErrors : [];
        db.resourceRecords = Array.isArray(db.resourceRecords) ? db.resourceRecords : [];
        db.impactCalculations = Array.isArray(db.impactCalculations) ? db.impactCalculations : [];
        db.impactResults = Array.isArray(db.impactResults) ? db.impactResults : [];
        db.managerSubmissions = Array.isArray(db.managerSubmissions) ? db.managerSubmissions : [];
        db.submissionTracker = Array.isArray(db.submissionTracker) ? db.submissionTracker : [];
        db.alerts = Array.isArray(db.alerts) ? db.alerts : [];
        db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
        db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
        db.plans = Array.isArray(db.plans) ? db.plans : [];
        db.subscriptions = Array.isArray(db.subscriptions) ? db.subscriptions : [];

        db.globalSettings = db.globalSettings && typeof db.globalSettings === 'object'
            ? db.globalSettings
            : { lockout: '5', session: '240', otpExp: '15', maxUsers: '100', flagMain: false, flagEmail: true, flag2fa: false };

        (db.departments || []).forEach((department) => {
            const managerUser = (db.users || []).find(u => 
                u.role === 'Manager' && (
                    (department.managerUserId && String(u.id) === String(department.managerUserId)) ||
                    (u.departmentId && String(u.departmentId) === String(department.id))
                )
            );
            if (managerUser) {
                department.manager = managerUser.name;
                department.managerUserId = managerUser.id;
            } else {
                department.manager = 'Unassigned';
                department.managerUserId = null;
            }
        });

        return db;
    },
    getGlobalSettings: (db = null) => {
        const state = Utils.ensureCollections(db || Utils.getDB());
        return state.globalSettings || { lockout: '5', session: '240', otpExp: '15', maxUsers: '100', flagMain: false, flagEmail: true, flag2fa: false };
    },
    isMaintenanceMode: (db = null) => {
        const settings = Utils.getGlobalSettings(db);
        return Boolean(settings.flagMain);
    },
    getRoleOptions: () => ['Super User', 'COO', 'Manager', 'Analyst'],
    generateId: (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    nowLabel: () => {
        const now = new Date();
        return now.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    },
    getUserDepartmentScope: (user, db) => {
        const state = Utils.ensureCollections(db || Utils.getDB());
        if (!user) return (state.departments || []).map(dept => dept.id);
        if (user.role === 'Super User') return (state.departments || []).map(dept => dept.id);
        if (user.role === 'Manager') {
            const depts = [];
            if (user.departmentId) depts.push(user.departmentId);
            if (Array.isArray(user.assignedDepartmentIds)) {
                user.assignedDepartmentIds.forEach(id => { if (id && !depts.includes(id)) depts.push(id); });
            }
            (state.departments || []).forEach(dept => {
                if ((String(dept.managerUserId) === String(user.id) || (dept.manager && dept.manager === user.name)) && !depts.includes(dept.id)) {
                    depts.push(dept.id);
                }
            });
            if (depts.length === 0) {
                const org = Utils.getCurrentOrganization(user, state);
                const orgId = org ? org.id : user.organizationId;
                if (orgId) {
                    return (state.departments || []).filter(dept => dept.orgId === orgId).map(dept => dept.id);
                }
            }
            return depts;
        }
        if (user.role === 'Analyst') {
            const assigned = Array.isArray(user.assignedDepartmentIds) ? user.assignedDepartmentIds.filter(Boolean) : [];
            if (assigned.length > 0) return assigned;
            const org = Utils.getCurrentOrganization(user, state);
            const orgId = org ? org.id : user.organizationId;
            if (orgId) {
                return (state.departments || []).filter(dept => !dept.orgId || dept.orgId === orgId).map(dept => dept.id);
            }
            return (state.departments || []).map(dept => dept.id);
        }
        if (user.role === 'COO') {
            const org = Utils.getCurrentOrganization(user, state);
            const orgId = org ? org.id : user.organizationId;
            if (orgId) {
                return (state.departments || []).filter(dept => !dept.orgId || dept.orgId === orgId).map(dept => dept.id);
            }
            return (state.departments || []).map(dept => dept.id);
        }
        return (state.departments || []).map(dept => dept.id);
    },
    syncUserDerivedFields: (db, userId) => {
        const user = (db.users || []).find(entry => String(entry.id) === String(userId));
        if (!user) return;

        (db.organizations || []).forEach((organization) => {
            if (String(organization.cooUserId) === String(user.id) && user.role !== 'COO') {
                organization.cooName = '';
                organization.cooUserId = null;
                organization.cooEmail = '';
            }
        });

        (db.departments || []).forEach((department) => {
            if (String(department.managerUserId) === String(user.id) && user.role !== 'Manager') {
                department.manager = 'Unassigned';
                department.managerUserId = null;
            }
        });

        if (user.role === 'COO') {
            const organization = (db.organizations || []).find(org => org.id === user.organizationId);
            if (organization) {
                user.department = 'Executive Office';
                user.departmentId = `${organization.id}-exec`;
                user.assignedDepartmentIds = [];
                organization.cooName = user.name;
                organization.cooUserId = user.id;
                organization.cooEmail = user.email;
            }
        }

        if (user.role === 'Manager') {
            const department = (db.departments || []).find(dept => dept.id === user.departmentId);
            if (department) {
                user.department = department.name;
                user.assignedDepartmentIds = [];
                user.organizationId = department.orgId;
                department.manager = user.name;
                department.managerUserId = user.id;
            }
        }

        if (user.role === 'Analyst') {
            user.department = 'Multi-Department Review';
            user.departmentId = '';
            if (!Array.isArray(user.assignedDepartmentIds) || !user.assignedDepartmentIds.length) {
                user.assignedDepartmentIds = (db.departments || [])
                    .filter(dept => dept.orgId === user.organizationId)
                    .map(dept => dept.id);
            }
        }

        if (user.role === 'Super User') {
            user.department = 'Platform Governance';
            user.departmentId = '';
            user.organizationId = '';
            user.assignedDepartmentIds = [];
        }
    },
    prepareUserForRole: (db, user, nextRole) => {
        const state = Utils.ensureCollections(db);
        const draft = user;
        draft.role = nextRole;

        if (nextRole === 'Super User') {
            draft.organizationId = '';
            draft.department = 'Platform Governance';
            draft.departmentId = '';
            draft.assignedDepartmentIds = [];
            return draft;
        }

        const organization = draft.organizationId
            ? (state.organizations || []).find(org => org.id === draft.organizationId)
            : (state.organizations || [])[0] || null;

        if (organization) {
            draft.organizationId = organization.id;
        }

        if (nextRole === 'COO') {
            draft.department = 'Executive Office';
            draft.departmentId = organization ? `${organization.id}-exec` : '';
            draft.assignedDepartmentIds = [];
            return draft;
        }

        if (nextRole === 'Manager') {
            const department = draft.departmentId
                ? (state.departments || []).find(dept => dept.id === draft.departmentId)
                : (state.departments || []).find(dept => dept.orgId === draft.organizationId) || null;
            draft.departmentId = department ? department.id : '';
            draft.department = department ? department.name : 'Department Manager';
            draft.assignedDepartmentIds = [];
            if (department) {
                draft.organizationId = department.orgId;
            }
            return draft;
        }

        if (nextRole === 'Analyst') {
            const assignedDepartmentIds = (state.departments || [])
                .filter(dept => dept.orgId === draft.organizationId)
                .map(dept => dept.id);
            draft.department = 'Multi-Department Review';
            draft.departmentId = '';
            draft.assignedDepartmentIds = assignedDepartmentIds;
        }

        return draft;
    },
    syncOrganizationDerivedFields: (db, organizationId) => {
        const organization = (db.organizations || []).find(org => org.id === organizationId);
        if (!organization) return;

        (db.departments || []).forEach(department => {
            if (department.orgId === organizationId) {
                department.orgName = organization.name;
            }
        });

        (db.users || []).forEach(user => {
            if (user.role === 'COO' && user.organizationId === organizationId) {
                organization.cooName = user.name;
                organization.cooEmail = user.email;
                organization.cooUserId = user.id;
            }
        });
    },
    recalculateOrganizationTotals: (db, organizationId) => {
        const organization = (db.organizations || []).find(org => org.id === organizationId);
        if (!organization) return null;

        const departments = (db.departments || []).filter(dept => dept.orgId === organizationId);
        const target = departments.reduce((sum, dept) => sum + Utils.parseAmount(dept.target), 0);
        const threshold = departments.reduce((sum, dept) => sum + Utils.parseAmount(dept.threshold), 0);
        const current = departments.reduce((sum, dept) => sum + Utils.parseAmount(dept.current), 0);
        const co2 = departments.reduce((sum, dept) => sum + Utils.parseAmount(dept.co2), 0);
        const hasBreach = departments.some(dept => dept.statusType === 'red');
        const overTarget = departments.some(dept => dept.statusType === 'amber') || (target > 0 && current > target);

        organization.departmentIds = departments.map(dept => dept.id);
        organization.target = Utils.formatVolume(target);
        organization.threshold = Utils.formatVolume(threshold);
        organization.current = Utils.formatVolume(current);
        organization.co2 = co2.toLocaleString();

        if (organization.accountStatus === 'Inactive' || organization.status === 'Inactive') {
            organization.accountStatus = 'Inactive';
            organization.status = 'Inactive';
            organization.statusType = 'amber';
        } else {
            organization.status = hasBreach || overTarget ? 'Needs Attention' : 'Within Target';
            organization.statusType = hasBreach || overTarget ? 'amber' : 'green';
        }
        Utils.syncOrganizationDerivedFields(db, organizationId);
        return organization;
    },
    deleteDepartmentCascade: (db, departmentId) => {
        Utils.ensureCollections(db);
        const department = db.departments.find(entry => entry.id === departmentId);
        if (!department) return null;

        const linkedUserIds = db.users
            .filter(user => user.departmentId === departmentId && user.organizationId === department.orgId)
            .map(user => user.id);

        db.users = db.users.filter(user => !(user.departmentId === departmentId && user.organizationId === department.orgId));
        db.departments = db.departments.filter(entry => entry.id !== departmentId);
        db.submissions = db.submissions.filter(sub => !(sub.departmentId === departmentId && sub.organizationId === department.orgId));
        db.submissionTracker = db.submissionTracker.filter(item => !(item.id === departmentId && item.orgId === department.orgId));
        db.alerts = db.alerts.filter(alert => !(alert.departmentId === departmentId && alert.organizationId === department.orgId));
        db.organizations = db.organizations.map(org => org.id === department.orgId ? { ...org, departmentIds: (org.departmentIds || []).filter(id => id !== departmentId) } : org);
        Utils.recalculateOrganizationTotals(db, department.orgId);

        return { department, linkedUserIds };
    },
    deleteOrganizationCascade: (db, organizationId) => {
        Utils.ensureCollections(db);
        const organization = db.organizations.find(entry => entry.id === organizationId);
        if (!organization) return null;

        const departmentIds = db.departments.filter(dept => dept.orgId === organizationId).map(dept => dept.id);
        const deletedUsers = db.users.filter(user => user.organizationId === organizationId);

        db.organizations = db.organizations.filter(entry => entry.id !== organizationId);
        db.departments = db.departments.filter(dept => dept.orgId !== organizationId);
        db.users = db.users.filter(user => user.organizationId !== organizationId);
        db.submissions = db.submissions.filter(sub => sub.organizationId !== organizationId);
        db.submissionTracker = db.submissionTracker.filter(item => item.orgId !== organizationId);
        db.alerts = db.alerts.filter(alert => alert.organizationId !== organizationId);

        return { organization, departmentIds, deletedUsers };
    },
    deleteUserCascade: (db, userId) => {
        Utils.ensureCollections(db);
        const user = db.users.find(entry => String(entry.id) === String(userId));
        if (!user) return null;
        if (user.role === 'Super User') return { blocked: true, reason: 'Super User accounts cannot be deleted.' };

        if (user.role === 'COO' && user.organizationId) {
            return {
                user,
                organizationCascade: Utils.deleteOrganizationCascade(db, user.organizationId)
            };
        }

        db.users = db.users.filter(entry => String(entry.id) !== String(userId));

        if (user.role === 'Manager' && user.departmentId) {
            const department = db.departments.find(entry => entry.id === user.departmentId);
            if (department && String(department.managerUserId) === String(user.id)) {
                department.manager = 'Unassigned';
                department.managerUserId = null;
            }
        }

        return { user };
    },
    updateUserPassword: async (userId, currentPassword, nextPassword) => {
        const previousDb = Utils.dbCache ? JSON.parse(JSON.stringify(Utils.dbCache)) : {};
        const db = Utils.ensureCollections(Utils.getDB());
        const user = db.users.find(entry => String(entry.id) === String(userId));
        if (!user) return { ok: false, message: 'Account not found.' };

        const sessionUser = Utils.getCurrentUser();
        const effectiveCurrentPassword = user.password || (sessionUser && String(sessionUser.id) === String(userId) ? sessionUser.password : '');
        if (effectiveCurrentPassword && effectiveCurrentPassword !== currentPassword) {
            return { ok: false, message: 'Current password is incorrect.' };
        }
        if (!nextPassword || nextPassword.length < 8) return { ok: false, message: 'New password must be at least 8 characters.' };
        if (nextPassword === currentPassword) return { ok: false, message: 'New password must be different from the current password.' };

        user.password = nextPassword;

        if (sessionUser && String(sessionUser.id) === String(user.id)) {
            sessionUser.password = nextPassword;
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        }

        Utils.replaceDB(db, previousDb);

        await Utils.apiFetch('PATCH', `/api/users/${encodeURIComponent(userId)}`, { password: nextPassword });

        return { ok: true, user };
    },

    logAction: (action, status = 'Success', statusType = 'green') => {
        const db = Utils.getDB();
        if (!db.auditLogs) db.auditLogs = [];
        const currentUser = Utils.getCurrentUser() || { name: 'System', role: 'Anonymous' };
        
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        
        db.auditLogs.unshift({
            id: Date.now(),
            timestamp,
            actor: `${currentUser.name} (${currentUser.role})`,
            organizationId: currentUser.organizationId || '',
            action,
            status,
            statusType,
            ip: '192.168.1.1'
        });
        
        if (db.auditLogs.length > 200) db.auditLogs.length = 200;
        Utils.dbCache = db;
        void Utils.apiFetch('PUT', '/api/db/snapshot', db);
        window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db } }));
    },

    // 2. Toasts
    showToast: (message, type = 'success') => {
        const toast = document.getElementById('toastMessage');
        const toastText = document.getElementById('toastText');
        if (!toast || !toastText) return;
        
        toastText.textContent = message;
        toast.className = `toast toast--active toast--${type}`;
        
        const iconDiv = toast.querySelector('.toast__icon img');
        if (iconDiv) {
            const isLocal = window.location.pathname.includes('/html');
            const prefix = isLocal ? '../assets/icons/' : 'html/assets/icons/';
            iconDiv.src = type === 'error' ? prefix + 'alert-circle0.svg' : prefix + 'check-circle0.svg';
        }
        
        setTimeout(() => {
            toast.classList.remove('toast--active');
        }, 3000);
    },

    // 3. Modals
    toggleModal: (modalId, show = true) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            if (show) {
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('modal-overlay--active'), 10);
            } else {
                modal.classList.remove('modal-overlay--active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        }
    },
    confirmAction: ({ title = 'Confirm Action', message = 'Are you sure you want to continue?', confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger' } = {}) => {
        const modal = document.getElementById('confirmActionModal');
        const titleEl = document.getElementById('confirmActionTitle');
        const messageEl = document.getElementById('confirmActionMessage');
        const confirmBtn = document.getElementById('confirmActionConfirm');
        const cancelBtn = document.getElementById('confirmActionCancel');
        if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
            return Promise.resolve(window.confirm(message));
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmLabel;
        cancelBtn.textContent = cancelLabel;
        confirmBtn.className = tone === 'danger' ? 'btn-danger' : 'btn-primary';

        return new Promise((resolve) => {
            const cleanup = () => {
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
            };

            confirmBtn.onclick = () => {
                cleanup();
                Utils.toggleModal('confirmActionModal', false);
                resolve(true);
            };

            cancelBtn.onclick = () => {
                cleanup();
                Utils.toggleModal('confirmActionModal', false);
                resolve(false);
            };

            Utils.toggleModal('confirmActionModal', true);
        });
    },
    ensureHoverTooltip: (tooltipId = 'sharedHoverTooltip') => {
        let tooltip = document.getElementById(tooltipId);
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = tooltipId;
            tooltip.style.position = 'fixed';
            tooltip.style.display = 'none';
            tooltip.style.background = '#1e293b';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '8px 12px';
            tooltip.style.borderRadius = '8px';
            tooltip.style.fontSize = '12px';
            tooltip.style.fontWeight = '600';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '1200';
            tooltip.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.2)';
            tooltip.style.transform = 'translate(-50%, -100%)';
            tooltip.style.marginTop = '-12px';
            tooltip.style.whiteSpace = 'nowrap';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    },
    bindHoverTooltip: (selector, options = {}) => {
        const tooltip = Utils.ensureHoverTooltip(options.tooltipId || 'sharedHoverTooltip');
        document.querySelectorAll(selector).forEach((element) => {
            if (element.dataset.tooltipBound === 'true') return;
            element.dataset.tooltipBound = 'true';
            element.addEventListener('mousemove', (event) => {
                const content = element.getAttribute('data-tooltip') || element.getAttribute('title') || '';
                if (!content) return;
                tooltip.textContent = content;
                tooltip.style.display = 'block';
                tooltip.style.left = `${event.clientX}px`;
                tooltip.style.top = `${event.clientY}px`;
            });
            element.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    },

    // 4. Session & RBAC
    checkSession: () => {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const path = window.location.pathname;

        // Skip auth checks on public pages
        if (path.includes('index.html') || path.includes('auth-login.html') || path.includes('auth-registration.html') || path.includes('auth-forgot-password.html') || path.includes('auth-access-denied.html') || path.endsWith('front-end/') || path.endsWith('front-end')) {
            return;
        }

        if (!currentUser) {
            window.location.href = '../common/auth-login.html';
            return;
        }

        if (!Utils.dbCache) {
            void Utils.loadDB().then(() => Utils.checkSession());
            return;
        }

        const db = Utils.getDB();
        const liveUser = (db.users || []).find(user =>
            String(user.id) === String(currentUser.id) ||
            user.email === currentUser.email
        );

        if (!liveUser || liveUser.status !== 'Active') {
            Utils.logout();
            return;
        }

        const org = (db.organizations || []).find(o => o.id === liveUser.organizationId);
        if (org && (org.accountStatus === 'Inactive' || org.status === 'Inactive') && liveUser.role !== 'Super User') {
            localStorage.setItem('rorizon_notice', 'Your organization has been deactivated. Please contact your administrator.');
            Utils.logout();
            return;
        }

        if (Utils.isMaintenanceMode(db) && liveUser.role !== 'Super User') {
            localStorage.setItem('rorizon_notice', 'Maintenance mode is active. Only Super User accounts can access the platform right now.');
            Utils.logout();
            return;
        }

        localStorage.setItem('currentUser', JSON.stringify(liveUser));

        const now = new Date().getTime();
        const sessionLengthStr = localStorage.getItem('loginTime') || "0";
        const sessionAge = now - parseInt(sessionLengthStr, 10);
        // 4 Hour Expiry
        if (sessionAge > 4 * 60 * 60 * 1000) {
            Utils.logout();
            return;
        }

        // RBAC Folder Enforcement
        const rolePaths = {
            'Super User': '/admin/',
            'COO': '/coo/',
            'Manager': '/manager/',
            'Analyst': '/analyst/'
        };

        const targetPath = rolePaths[liveUser.role];
        if (targetPath && !path.includes(targetPath)) {
            let dashboard = '../common/auth-access-denied.html';
            if (liveUser.role === 'Super User') dashboard = '../admin/adm-dashboard.html';
            else if (liveUser.role === 'COO') dashboard = '../coo/coo-dashboard.html';
            else if (liveUser.role === 'Manager') dashboard = '../manager/dm-dashboard.html';
            else if (liveUser.role === 'Analyst') dashboard = '../analyst/sa-dashboard.html';
            window.location.href = dashboard;
        }
    },

    syncSessionUser: () => {
        const userData = JSON.parse(localStorage.getItem('currentUser'));
        const headerName = document.querySelector('.user-pill__name');
        const headerRole = document.querySelector('.user-pill__role');
        const headerAvatar = document.querySelector('.user-pill__avatar');
        const headerSubtitle = document.querySelector('.header__subtitle');

        if (userData) {
            if (headerName) headerName.textContent = userData.name;
            if (headerRole) headerRole.textContent = userData.role;
            if (headerSubtitle) {
                const contextSubtitle = Utils.getContextSubtitle(userData);
                if (contextSubtitle) headerSubtitle.textContent = contextSubtitle;
            }
            if (headerAvatar) {
                const initials = userData.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
                headerAvatar.textContent = initials;
            }
        }
    },

    logout: () => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('rorizon_notifs_read'); 
        window.location.href = "../common/auth-login.html";
    },

    // 5. Global Layout Injection
    injectLayout: () => {
        const layoutContainer = document.getElementById('app-layout');
        if (!layoutContainer) return;
        if (layoutContainer.dataset.injected === 'true' || layoutContainer.querySelector('.layout')) return;
        layoutContainer.dataset.injected = 'true';
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        let role = currentUser ? currentUser.role : 'Manager';
        let sidebarLinks = '';
        const iconPrefix = window.location.pathname.includes('/html/') ? '../assets/icons/' : 'html/assets/icons/';

        if (role === 'Super User') {
            sidebarLinks = `
                <a href="adm-dashboard.html" class="nav-item temp-nav" data-path="adm-dashboard.html">
                  <img src="${iconPrefix}icon0.svg" class="nav-item__icon" /><span>System Health</span>
                </a>
                <a href="adm-revenue-overview.html" class="nav-item temp-nav" data-path="adm-revenue-overview.html">
                  <img src="${iconPrefix}bar-chart-30.svg" class="nav-item__icon" /><span>Revenue Overview</span>
                </a>
                <a href="adm-revenue-management.html" class="nav-item temp-nav" data-path="adm-revenue-management.html">
                  <img src="${iconPrefix}building-20.svg" class="nav-item__icon" /><span>Revenue Management</span>
                </a>

                <a href="adm-system-management.html" class="nav-item temp-nav" data-path="adm-system-management.html">
                  <img src="${iconPrefix}icon4.svg" class="nav-item__icon" /><span>System Management</span>
                </a>
                <a href="adm-resource-governance.html" class="nav-item temp-nav" data-path="adm-resource-governance.html">
                  <img src="${iconPrefix}target0.svg" class="nav-item__icon" /><span>Emission Factors</span>
                </a>
                <a href="adm-audit-master-logs.html" class="nav-item temp-nav" data-path="adm-audit-master-logs.html">
                  <img src="${iconPrefix}icon8.svg" class="nav-item__icon" /><span>Master Audit Trail</span>
                </a>
                <a href="adm-system-settings.html" class="nav-item temp-nav" data-path="adm-system-settings.html">
                  <img src="${iconPrefix}settings0.svg" class="nav-item__icon" /><span>System Settings</span>
                </a>
                <a href="adm-profile-settings.html" class="nav-item temp-nav" data-path="adm-profile-settings.html">
                  <img src="${iconPrefix}icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        } else if (role === 'COO') {
            sidebarLinks = `
                <a href="coo-dashboard.html" class="nav-item temp-nav" data-path="coo-dashboard.html">
                  <img src="${iconPrefix}icon0.svg" class="nav-item__icon" /><span>Dashboard</span>
                </a>
                <a href="coo-organization-staff.html" class="nav-item temp-nav" data-path="coo-organization-staff.html">
                  <img src="${iconPrefix}icon11.svg" class="nav-item__icon" /><span>Organization &amp; Staff</span>
                </a>
                <a href="coo-billing.html" class="nav-item temp-nav" data-path="coo-billing.html">
                  <img src="${iconPrefix}file-text0.svg" class="nav-item__icon" /><span>Billing &amp; Subscription</span>
                </a>
                <a href="coo-staff-activation.html" class="nav-item temp-nav" data-path="coo-staff-activation.html">
                  <img src="${iconPrefix}icon4.svg" class="nav-item__icon" /><span>Staff Activation</span>
                </a>
                <a href="coo-targets-thresholds.html" class="nav-item temp-nav" data-path="coo-targets-thresholds.html">
                  <img src="${iconPrefix}target0.svg" class="nav-item__icon" /><span>Targets &amp; Thresholds</span>
                </a>
                <a href="coo-report-approval.html" class="nav-item temp-nav" data-path="coo-report-approval.html">
                  <img src="${iconPrefix}icon10.svg" class="nav-item__icon" /><span>Report Approval</span>
                </a>
                <a href="coo-alerts.html" class="nav-item temp-nav" data-path="coo-alerts.html">
                  <img src="${iconPrefix}alert-triangle2.svg" class="nav-item__icon" /><span>Alerts</span>
                </a>
                <a href="coo-audit-logs.html" class="nav-item temp-nav" data-path="coo-audit-logs.html">
                  <img src="${iconPrefix}icon8.svg" class="nav-item__icon" /><span>Audit Trail</span>
                </a>
                <a href="coo-profile-settings.html" class="nav-item temp-nav" data-path="coo-profile-settings.html">
                  <img src="${iconPrefix}icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        } else if (role === 'Manager') {
            sidebarLinks = `
                <a href="dm-dashboard.html" class="nav-item temp-nav" data-path="dm-dashboard.html">
                  <img src="${iconPrefix}icon0.svg" class="nav-item__icon" /><span>Dashboard</span>
                </a>
                <a href="dm-data-submission.html" class="nav-item temp-nav" data-path="dm-data-submission.html">
                  <img src="${iconPrefix}icon6.svg" class="nav-item__icon" /><span>Data Submission</span>
                </a>
                <a href="dm-submission-history.html" class="nav-item temp-nav" data-path="dm-submission-history.html">
                  <img src="${iconPrefix}icon15.svg" class="nav-item__icon" /><span>Submission History</span>
                </a>
                <a href="dm-alerts-response.html" class="nav-item temp-nav" data-path="dm-alerts-response.html">
                  <img src="${iconPrefix}alert-triangle2.svg" class="nav-item__icon" /><span>Alerts &amp; Response</span>
                </a>
                <a href="dm-profile-settings.html" class="nav-item temp-nav" data-path="dm-profile-settings.html">
                  <img src="${iconPrefix}icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        } else if (role === 'Analyst') {
            sidebarLinks = `
                <a href="sa-dashboard.html" class="nav-item temp-nav" data-path="sa-dashboard.html">
                  <img src="${iconPrefix}icon0.svg" class="nav-item__icon" /><span>Dashboard</span>
                </a>
                <a href="sa-emissions-analysis.html" class="nav-item temp-nav" data-path="sa-emissions-analysis.html">
                  <img src="${iconPrefix}icon13.svg" class="nav-item__icon" /><span>Emissions Analysis</span>
                </a>
                <a href="sa-report-generation.html" class="nav-item temp-nav" data-path="sa-report-generation.html">
                  <img src="${iconPrefix}icon6.svg" class="nav-item__icon" /><span>Report Generation</span>
                </a>
                <a href="sa-report-revision.html" class="nav-item temp-nav" data-path="sa-report-revision.html">
                  <img src="${iconPrefix}icon12.svg" class="nav-item__icon" /><span>Report Revision</span>
                </a>
                <a href="sa-submissions-status.html" class="nav-item temp-nav" data-path="sa-submissions-status.html">
                  <img src="${iconPrefix}icon14.svg" class="nav-item__icon" /><span>Submissions Status</span>
                </a>
                <a href="sa-alerts.html" class="nav-item temp-nav" data-path="sa-alerts.html">
                  <img src="${iconPrefix}alert-triangle2.svg" class="nav-item__icon" /><span>Alerts</span>
                </a>
                <a href="sa-profile-settings.html" class="nav-item temp-nav" data-path="sa-profile-settings.html">
                  <img src="${iconPrefix}icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        }

        const title = layoutContainer.dataset.title || "Dashboard";
        const contextSubtitle = Utils.getContextSubtitle(currentUser, Utils.getDB());
        const subtitle = contextSubtitle || layoutContainer.dataset.subtitle || "Overview";

        const contentHTML = layoutContainer.innerHTML;
        const roleClass = role === 'Super User' ? 'admin' : (role === 'COO' ? 'coo' : (role === 'Manager' ? 'manager' : 'analyst'));
        
        layoutContainer.innerHTML = `
            <div class="layout">
                <aside class="sidebar sidebar--${roleClass}">
                    <div class="sidebar__brand">
                        <div class="sidebar__logo"><img src="${iconPrefix}leaf0.svg" alt="Rorizon" /></div>
                        <span class="sidebar__name">Rorizon</span>
                    </div>
                    <p class="sidebar__role sidebar__role--${roleClass}">${role}</p>
                    <nav class="sidebar__nav" id="sidebar-nav">
                        ${sidebarLinks}
                    </nav>
                </aside>
                <div class="main-wrapper">
                    <header class="header">
                        <div class="header__left">
                            <h1 class="header__title">${title}</h1>
                            <p class="header__subtitle">${subtitle}</p>
                        </div>
                        <div class="header__right" style="display: flex; align-items: center; gap: 24px;">
                            <button class="header__notif" id="notifToggle" type="button" style="background: none; border: none; cursor: pointer; position: relative;">
                                <img src="${iconPrefix}bell0.svg" alt="Notifications" style="width: 24px; height: 24px;" />
                                <span class="notif-badge" id="notifBadge" style="position: absolute; top: 0; right: 2px; width: 10px; height: 10px; background: red; border-radius: 50%;"></span>
                            </button>
                            <div class="user-pill" id="profileToggle" style="cursor: pointer;">
                                <div class="user-pill__avatar user-pill__avatar--red">--</div>
                                <div class="user-pill__info">
                                    <span class="user-pill__name">Loading...</span>
                                    <span class="user-pill__role">${role}</span>
                                </div>
                            </div>
                        </div>
                    </header>
                    <main class="content">${contentHTML}</main>
                </div>
            </div>

            <!-- Global Injected Modals & Panels -->
            <div class="notif-panel" id="notifPanel">
                <div class="notif-panel__header">
                    <span class="notif-panel__title">Notifications</span>
                    <button class="notif-panel__mark" type="button" id="markAllRead">Mark all as read</button>
                </div>
                <div class="notif-list" id="notificationList"></div>
            </div>

            <div class="modal-overlay" id="notifDetailModal">
                <div class="modal">
                    <button class="modal__close" type="button" onclick="Utils.toggleModal('notifDetailModal', false)">
                        <img src="${iconPrefix}x0.svg" alt="X" />
                    </button>
                    <div class="modal__header">
                        <h2 class="modal__title" id="notifDetailTitle">Notification Details</h2>
                    </div>
                    <div class="modal__body" style="padding-top:16px;">
                        <p class="text--muted" style="margin-bottom:8px; font-size:12px;" id="notifDetailTime"></p>
                        <p style="font-weight:600; margin-top:0; margin-bottom:16px" id="notifDetailBody"></p>
                        <pre style="background:var(--bg-surface); padding:16px; border-radius:8px; white-space:pre-wrap; font-family:inherit; margin:0;" id="notifDetailText"></pre>
                    </div>
                </div>
            </div>

            <div class="profile-dropdown" id="profileDropdown">
                <a href="${role === 'Super User' ? 'adm-profile-settings.html' : role === 'COO' ? 'coo-profile-settings.html' : role === 'Manager' ? 'dm-profile-settings.html' : 'sa-profile-settings.html'}" class="profile-dropdown__item">
                    <img src="${iconPrefix}icon9.svg" alt="" />Profile &amp; Settings
                </a>
                <div class="profile-dropdown__divider"></div>
                <div class="profile-dropdown__item profile-dropdown__item--danger" id="logoutTrigger">
                    <img src="${iconPrefix}log-out0.svg" alt="" />Logout
                </div>
            </div>

            <div class="toast toast--success" id="toastMessage" role="alert" aria-live="polite">
                <div class="toast__icon"><img src="${iconPrefix}check-circle0.svg" alt="" /></div>
                <p class="toast__text" id="toastText">Action completed successfully.</p>
            </div>


            <div class="modal-overlay" id="logoutModal">
                <div class="modal modal--sm">
                    <div class="modal__alert-header">
                        <h2 class="modal__alert-title">Log out?</h2>
                        <p class="modal__alert-desc">You will be returned to the login page.</p>
                    </div>
                    <div class="modal__alert-footer">
                        <button class="btn-outline" type="button" onclick="Utils.toggleModal('logoutModal', false)">Cancel</button>
                        <button class="btn-danger" type="button" onclick="Utils.logout()">Log Out</button>
                    </div>
                </div>
            </div>
            <div class="modal-overlay" id="confirmActionModal">
                <div class="modal modal--sm">
                    <div class="modal__alert-header">
                        <h2 class="modal__alert-title" id="confirmActionTitle">Confirm Action</h2>
                        <p class="modal__alert-desc" id="confirmActionMessage">Are you sure you want to continue?</p>
                    </div>
                    <div class="modal__alert-footer">
                        <button class="btn-outline" type="button" id="confirmActionCancel">Cancel</button>
                        <button class="btn-danger" type="button" id="confirmActionConfirm">Confirm</button>
                    </div>
                </div>
            </div>
            <div class="panel-backdrop" id="panelBackdrop"></div>
        `;

        const currentPath = window.location.pathname.split('/').pop();
        document.querySelectorAll('.temp-nav').forEach(el => {
            if (el.dataset.path === currentPath) {
                el.classList.add('nav-item--active');
            }
        });
    },

    // 6. Init Interactions
    initGlobalHeader: () => {
        Utils.syncSessionUser();

        const profileToggle = document.getElementById('profileToggle');
        const profileDropdown = document.getElementById('profileDropdown');
        const notifToggle = document.getElementById('notifToggle');
        const notifPanel = document.getElementById('notifPanel');
        const markAllReadBtn = document.getElementById('markAllRead');
        const notifBadge = document.getElementById('notifBadge');
        const logoutTrigger = document.getElementById('logoutTrigger');
        const logoutConfirm = document.querySelector('#logoutModal .btn-danger');

        if (!profileToggle) return;
        if (profileToggle.dataset.headerInited === 'true') {
            return;
        }
        profileToggle.dataset.headerInited = 'true';


        const db = Utils.getDB();
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const role = currentUser ? currentUser.role : null;
        
        const notificationList = document.getElementById('notificationList');
        const getScopedNotifications = (latestDb) => {
            const liveUser = Utils.getCurrentUser();
            if (!liveUser) return [];
            const liveRole = liveUser.role;
            const organization = Utils.getCurrentOrganization(liveUser, latestDb);
            const organizationId = liveUser.organizationId || organization?.id || '';
            const scopedDepartmentIds = Utils.getUserDepartmentScope(liveUser, latestDb).map(String);

            return (latestDb.notifications || []).filter((notification) => {
                if (notification.role && notification.role !== liveRole && liveRole !== 'Super User') return false;
                if (liveRole === 'Super User') return true;
                if (notification.userId && String(notification.userId) === String(liveUser.id)) return true;
                if (notification.organizationId && String(notification.organizationId) === String(organizationId)) return true;
                if (notification.departmentId && scopedDepartmentIds.includes(String(notification.departmentId))) return true;
                return !notification.organizationId && !notification.departmentId;
            }).reverse();
        };
        const renderNotifications = () => {
            const latestDb = Utils.getDB();
            const latestNotifs = getScopedNotifications(latestDb);
            if (!notificationList) return;
            if (latestNotifs.length === 0) {
                notificationList.innerHTML = '<p style="padding:16px;text-align:center;color:var(--text-muted);font-size:14px">No notifications</p>';
                if (notifBadge) notifBadge.style.display = 'none';
                return;
            }

            notificationList.innerHTML = latestNotifs.map(n => `
                <div class="notif-item ${!n.read ? 'notif-item--unread' : ''}" data-id="${n.id}" style="cursor:pointer;">
                    <p class="notif-item__title">${n.title}</p>
                    <p class="notif-item__body">${n.body || n.message || ''}</p>
                    <p class="notif-item__time">${n.timestamp || n.createdAt || 'Just now'}</p>
                </div>
            `).join('');

            const hasUnread = latestNotifs.some(n => !n.read);
            if (notifBadge) notifBadge.style.display = hasUnread ? 'block' : 'none';
        };

        if (notificationList) {
            renderNotifications();
            notificationList.addEventListener('click', (e) => {
                const item = e.target.closest('.notif-item');
                if (item) {
                    const id = item.dataset.id;
                    const latestDb = Utils.getDB();
                    const latestNotifs = getScopedNotifications(latestDb);
                    const n = latestNotifs.find(x => String(x.id) === String(id));
                    if (n) {
                        document.getElementById('notifDetailTitle').textContent = n.title;
                        document.getElementById('notifDetailTime').textContent = n.timestamp || n.createdAt || 'Just now';
                        document.getElementById('notifDetailBody').textContent = n.body || n.message || '';
                        document.getElementById('notifDetailText').textContent = n.details || 'No additional details provided.';
                        Utils.toggleModal('notifDetailModal', true);
                        if (!n.read) {
                            n.read = true;
                            Utils.saveToDB('notifications', latestDb.notifications);
                            renderNotifications();
                        }
                    }
                }
            });
        }


        if (profileToggle && profileDropdown) {
            profileToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('profile-dropdown--active');
                if (notifPanel) notifPanel.classList.remove('notif-panel--active');
            });
        }

        if (notifToggle && notifPanel) {
            notifToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                notifPanel.classList.toggle('notif-panel--active');
                if (profileDropdown) profileDropdown.classList.remove('profile-dropdown--active');
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                document.querySelectorAll('.notif-item--unread').forEach(el => el.classList.remove('notif-item--unread'));
                if (notifBadge) notifBadge.style.display = 'none';
                
                const db = Utils.getDB();
                if (db.notifications) {
                    const scopedIds = new Set(getScopedNotifications(db).map(n => String(n.id)));
                    db.notifications.forEach(n => {
                        if (scopedIds.has(String(n.id))) n.read = true;
                    });
                    Utils.saveToDB('notifications', db.notifications);
                }
                
                Utils.showToast("All notifications marked as read.");
                renderNotifications();
            });
        }

        window.addEventListener('rorizon-db-updated', renderNotifications);

        if (logoutTrigger) {
            logoutTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                if (profileDropdown) profileDropdown.classList.remove('profile-dropdown--active');
                Utils.toggleModal('logoutModal', true);
            });
        }

        if (logoutConfirm) {
            logoutConfirm.addEventListener('click', () => {
                Utils.logout();
            });
        }

        document.addEventListener('click', (e) => {
            if (profileDropdown && profileDropdown.classList.contains('profile-dropdown--active') && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('profile-dropdown--active');
            }
            if (notifPanel && notifPanel.classList.contains('notif-panel--active') && !notifPanel.contains(e.target)) {
                notifPanel.classList.remove('notif-panel--active');
            }
        });
    },

    // 7. Validation Helpers
    validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    validatePhone: (phone) => {
        const clean = phone.replace(/[\s\-\(\)]/g, '');
        return /^\+?\d{10,15}$/.test(clean);
    },
    
    // 8. Unsaved Changes Protection
    enableDirtyFormProtection: (formId) => {
        const form = document.getElementById(formId);
        if (!form) return;
        let isDirty = false;
        
        form.addEventListener('input', () => { isDirty = true; });
        form.addEventListener('submit', () => { isDirty = false; });
        
        window.addEventListener('beforeunload', (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    },

    // 9. UI Empty State Renderer
    renderEmptyState: (title = 'No Records Found', message = 'There are no items to display at this time.', iconType = 'inbox', actionBtnHtml = '') => {
        const iconSvgMap = {
            inbox: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8"><path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 002 2h16a2 2 0 002-2v-7z"/><path d="M5.45 5.11L2 12v0h20v0l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>`,
            search: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
            alert: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
            file: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
            check: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        };
        const svg = iconSvgMap[iconType] || iconSvgMap.inbox;
        return `
            <div class="empty-state-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:32px 20px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; margin:12px 0;">
                <div style="margin-bottom:12px; opacity:0.85;">${svg}</div>
                <h4 style="font-size:15px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">${title}</h4>
                <p style="font-size:13px; color:#64748b; margin:0; max-width:440px; line-height:1.5;">${message}</p>
                ${actionBtnHtml ? `<div style="margin-top:14px;">${actionBtnHtml}</div>` : ''}
            </div>
        `;
    },
    renderEmptyTableRow: (colspan = 6, title = 'No Records Found', message = 'No data available for this view.', iconType = 'inbox', actionBtnHtml = '') => {
        return `<tr><td colspan="${colspan}" style="padding:0;">${Utils.renderEmptyState(title, message, iconType, actionBtnHtml)}</td></tr>`;
    }
};

// Immediate layout injection if DOM element is already available
if (document.getElementById('app-layout')) {
    Utils.injectLayout();
}

document.addEventListener('DOMContentLoaded', () => {
    Utils.checkSession();
    Utils.injectLayout();
    Utils.initGlobalHeader();
    window.addEventListener('storage', (e) => {
        Utils.checkSession();
        Utils.syncSessionUser();
        if (!e.key || e.key === 'rorizon_db_tick') {
            void Utils.refreshFromBackend();
        }
    });
    window.addEventListener('rorizon-db-updated', () => {
        Utils.checkSession();
        Utils.syncSessionUser();
    });
    Utils.startPolling(4000);
});
