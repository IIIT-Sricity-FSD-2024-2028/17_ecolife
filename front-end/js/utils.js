/**
 * RORIZON UI UTILITIES
 * Centralized logic for global UI components, sessions, and notifications.
 */

const Utils = {
    // 1. Storage & State Management
    getDB: () => {
        if (typeof RorizonData !== 'undefined' && typeof RorizonData.initDB === 'function') {
            RorizonData.initDB();
        }
        return JSON.parse(localStorage.getItem('rorizon_db')) || {};
    },
    saveToDB: (key, data) => {
        const db = Utils.getDB();
        db[key] = data;
        localStorage.setItem('rorizon_db', JSON.stringify(db));
        window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db } }));
    },
    replaceDB: (db) => {
        localStorage.setItem('rorizon_db', JSON.stringify(db));
        window.dispatchEvent(new CustomEvent('rorizon-db-updated', { detail: { db } }));
    },
    getCurrentUser: () => JSON.parse(localStorage.getItem('currentUser')) || null,
    parseAmount: (value) => {
        const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
        return match ? Number(match[0]) : 0;
    },
    formatVolume: (value) => `${Math.round(Number(value || 0)).toLocaleString()} L`,
    ensureCollections: (db) => {
        db.users = Array.isArray(db.users) ? db.users : [];
        db.organizations = Array.isArray(db.organizations) ? db.organizations : [];
        db.departments = Array.isArray(db.departments) ? db.departments : [];
        db.submissions = Array.isArray(db.submissions) ? db.submissions : [];
        db.managerSubmissions = Array.isArray(db.managerSubmissions) ? db.managerSubmissions : [];
        db.submissionTracker = Array.isArray(db.submissionTracker) ? db.submissionTracker : [];
        db.alerts = Array.isArray(db.alerts) ? db.alerts : [];
        db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
        db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
        return db;
    },
    generateId: (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    getUserDepartmentScope: (user, db) => {
        const state = Utils.ensureCollections(db || Utils.getDB());
        if (!user) return [];
        if (user.role === 'Manager') return user.departmentId ? [user.departmentId] : [];
        if (user.role === 'Analyst') return Array.isArray(user.assignedDepartmentIds) ? user.assignedDepartmentIds.filter(Boolean) : [];
        if (user.role === 'COO') return (state.departments || []).filter(dept => dept.orgId === user.organizationId).map(dept => dept.id);
        return [];
    },
    syncUserDerivedFields: (db, userId) => {
        const user = (db.users || []).find(entry => String(entry.id) === String(userId));
        if (!user) return;

        if (user.role === 'COO') {
            const organization = (db.organizations || []).find(org => org.id === user.organizationId);
            if (organization) {
                organization.cooName = user.name;
                organization.cooUserId = user.id;
                organization.cooEmail = user.email;
            }
        }

        if (user.role === 'Manager') {
            const department = (db.departments || []).find(dept => dept.id === user.departmentId);
            if (department) {
                department.manager = user.name;
                department.managerUserId = user.id;
            }
        }

        if (user.role === 'Analyst') {
            user.department = 'Multi-Department Review';
            user.departmentId = '';
        }
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
        const overTarget = departments.some(dept => Utils.parseAmount(dept.current) > Utils.parseAmount(dept.threshold || dept.target));

        organization.departmentIds = departments.map(dept => dept.id);
        organization.target = Utils.formatVolume(target);
        organization.threshold = Utils.formatVolume(threshold);
        organization.current = Utils.formatVolume(current);
        organization.co2 = co2.toLocaleString();
        organization.status = overTarget ? 'Needs Attention' : 'Within Target';
        organization.statusType = overTarget ? 'amber' : 'green';
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
        db.submissions = db.submissions.filter(sub => sub.departmentId !== departmentId && sub.organizationId !== department.orgId);
        db.submissionTracker = db.submissionTracker.filter(item => item.id !== departmentId && item.orgId !== department.orgId);
        db.alerts = db.alerts.filter(alert => alert.departmentId !== departmentId && alert.organizationId !== department.orgId);
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
    updateUserPassword: (userId, currentPassword, nextPassword) => {
        const db = Utils.ensureCollections(Utils.getDB());
        const user = db.users.find(entry => String(entry.id) === String(userId));
        if (!user) return { ok: false, message: 'Account not found.' };
        if (user.password !== currentPassword) return { ok: false, message: 'Current password is incorrect.' };
        if (!nextPassword || nextPassword.length < 8) return { ok: false, message: 'New password must be at least 8 characters.' };
        if (nextPassword === currentPassword) return { ok: false, message: 'New password must be different from the current password.' };

        user.password = nextPassword;
        Utils.replaceDB(db);

        const sessionUser = Utils.getCurrentUser();
        if (sessionUser && String(sessionUser.id) === String(user.id)) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        }

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
            action,
            status,
            statusType,
            ip: '192.168.1.1'
        });
        
        if (db.auditLogs.length > 200) db.auditLogs.length = 200;
        localStorage.setItem('rorizon_db', JSON.stringify(db));
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

        const db = Utils.getDB();
        const liveUser = (db.users || []).find(user =>
            String(user.id) === String(currentUser.id) ||
            user.email === currentUser.email
        );

        if (!liveUser || liveUser.status !== 'Active') {
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

        if (userData) {
            if (headerName) headerName.textContent = userData.name;
            if (headerRole) headerRole.textContent = userData.role;
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
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        let role = currentUser ? currentUser.role : 'Manager';
        let sidebarLinks = '';

        if (role === 'Super User') {
            sidebarLinks = `
                <a href="adm-dashboard.html" class="nav-item temp-nav" data-path="adm-dashboard.html">
                  <img src="../assets/icons/icon0.svg" class="nav-item__icon" /><span>System Health</span>
                </a>
                <a href="adm-system-management.html" class="nav-item temp-nav" data-path="adm-system-management.html">
                  <img src="../assets/icons/icon4.svg" class="nav-item__icon" /><span>System Management</span>
                </a>
                <a href="adm-audit-master-logs.html" class="nav-item temp-nav" data-path="adm-audit-master-logs.html">
                  <img src="../assets/icons/icon8.svg" class="nav-item__icon" /><span>Master Audit Trail</span>
                </a>
                <a href="adm-system-settings.html" class="nav-item temp-nav" data-path="adm-system-settings.html">
                  <img src="../assets/icons/settings0.svg" class="nav-item__icon" /><span>System Settings</span>
                </a>
                <a href="adm-profile-settings.html" class="nav-item temp-nav" data-path="adm-profile-settings.html">
                  <img src="../assets/icons/icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        } else if (role === 'COO') {
            sidebarLinks = `
                <a href="coo-dashboard.html" class="nav-item temp-nav" data-path="coo-dashboard.html">
                  <img src="../assets/icons/icon0.svg" class="nav-item__icon" /><span>Dashboard</span>
                </a>
                <a href="coo-organization-staff.html" class="nav-item temp-nav" data-path="coo-organization-staff.html">
                  <img src="../assets/icons/icon4.svg" class="nav-item__icon" /><span>Organization &amp; Staff</span>
                </a>
                <a href="coo-staff-activation.html" class="nav-item temp-nav" data-path="coo-staff-activation.html">
                  <img src="../assets/icons/users0.svg" class="nav-item__icon" /><span>Staff Activation</span>
                </a>
                <a href="coo-targets-thresholds.html" class="nav-item temp-nav" data-path="coo-targets-thresholds.html">
                  <img src="../assets/icons/target0.svg" class="nav-item__icon" /><span>Targets &amp; Thresholds</span>
                </a>
                <a href="coo-report-approval.html" class="nav-item temp-nav" data-path="coo-report-approval.html">
                  <img src="../assets/icons/file-text0.svg" class="nav-item__icon" /><span>Report Approval</span>
                </a>
                <a href="coo-alerts.html" class="nav-item temp-nav" data-path="coo-alerts.html">
                  <img src="../assets/icons/icon6.svg" class="nav-item__icon" /><span>Alerts</span>
                </a>
                <a href="coo-audit-logs.html" class="nav-item temp-nav" data-path="coo-audit-logs.html">
                  <img src="../assets/icons/icon8.svg" class="nav-item__icon" /><span>Audit Trail</span>
                </a>
                <a href="coo-profile-settings.html" class="nav-item temp-nav" data-path="coo-profile-settings.html">
                  <img src="../assets/icons/icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        } else if (role === 'Manager') {
            sidebarLinks = `
                <a href="dm-dashboard.html" class="nav-item temp-nav" data-path="dm-dashboard.html">
                  <img src="../assets/icons/icon0.svg" class="nav-item__icon" /><span>Dashboard</span>
                </a>
                <a href="dm-data-submission.html" class="nav-item temp-nav" data-path="dm-data-submission.html">
                  <img src="../assets/icons/icon4.svg" class="nav-item__icon" /><span>Data Submission</span>
                </a>
                <a href="dm-submission-history.html" class="nav-item temp-nav" data-path="dm-submission-history.html">
                  <img src="../assets/icons/icon5.svg" class="nav-item__icon" /><span>Submission History</span>
                </a>
                <a href="dm-alerts-response.html" class="nav-item temp-nav" data-path="dm-alerts-response.html">
                  <img src="../assets/icons/icon6.svg" class="nav-item__icon" /><span>Alerts &amp; Response</span>
                </a>
                <a href="dm-profile-settings.html" class="nav-item temp-nav" data-path="dm-profile-settings.html">
                  <img src="../assets/icons/icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        } else if (role === 'Analyst') {
            sidebarLinks = `
                <a href="sa-dashboard.html" class="nav-item temp-nav" data-path="sa-dashboard.html">
                  <img src="../assets/icons/icon0.svg" class="nav-item__icon" /><span>Dashboard</span>
                </a>
                <a href="sa-emissions-analysis.html" class="nav-item temp-nav" data-path="sa-emissions-analysis.html">
                  <img src="../assets/icons/users0.svg" class="nav-item__icon" /><span>Emissions Analysis</span>
                </a>
                <a href="sa-report-generation.html" class="nav-item temp-nav" data-path="sa-report-generation.html">
                  <img src="../assets/icons/target0.svg" class="nav-item__icon" /><span>Report Generation</span>
                </a>
                <a href="sa-report-revision.html" class="nav-item temp-nav" data-path="sa-report-revision.html">
                  <img src="../assets/icons/file-text0.svg" class="nav-item__icon" /><span>Report Revision</span>
                </a>
                <a href="sa-submissions-status.html" class="nav-item temp-nav" data-path="sa-submissions-status.html">
                  <img src="../assets/icons/icon6.svg" class="nav-item__icon" /><span>Submissions Status</span>
                </a>
                <a href="sa-profile-settings.html" class="nav-item temp-nav" data-path="sa-profile-settings.html">
                  <img src="../assets/icons/icon9.svg" class="nav-item__icon" /><span>Profile &amp; Settings</span>
                </a>
            `;
        }

        const title = layoutContainer.dataset.title || "Dashboard";
        const subtitle = layoutContainer.dataset.subtitle || "Overview";

        const contentHTML = layoutContainer.innerHTML;
        
        layoutContainer.innerHTML = `
            <div class="layout">
                <aside class="sidebar sidebar--admin">
                    <div class="sidebar__brand">
                        <div class="sidebar__logo"><img src="../assets/icons/leaf0.svg" alt="Rorizon" /></div>
                        <span class="sidebar__name">Rorizon</span>
                    </div>
                    <p class="sidebar__role sidebar__role--admin">${role}</p>
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
                                <img src="../assets/icons/bell0.svg" alt="Notifications" style="width: 24px; height: 24px;" />
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
                        <img src="../assets/icons/x0.svg" alt="X" />
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
                    <img src="../assets/icons/icon9.svg" alt="" />Profile &amp; Settings
                </a>
                <div class="profile-dropdown__divider"></div>
                <div class="profile-dropdown__item profile-dropdown__item--danger" id="logoutTrigger">
                    <img src="../assets/icons/log-out0.svg" alt="" />Logout
                </div>
            </div>

            <div class="toast toast--success" id="toastMessage" role="alert" aria-live="polite">
                <div class="toast__icon"><img src="../assets/icons/check-circle0.svg" alt="" /></div>
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

        const db = Utils.getDB();
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const role = currentUser ? currentUser.role : null;
        
        const notificationList = document.getElementById('notificationList');
        const renderNotifications = () => {
            const latestDb = Utils.getDB();
            const latestNotifs = (latestDb.notifications || []).filter(n => n.role === role).reverse();
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
                    const latestNotifs = (latestDb.notifications || []).filter(n => n.role === role).reverse();
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
                    db.notifications.forEach(n => { n.read = true; });
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Utils.checkSession();
    Utils.injectLayout();
    Utils.initGlobalHeader();
});
