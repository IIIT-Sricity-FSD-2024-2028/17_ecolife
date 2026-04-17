/**
 * Rorizon Core Data Store
 * Phase 1: shared seed contract with compatibility for existing pages.
 */
const RorizonData = {
    version: 3,

    systemMetrics: {
        uptime: "99.98%",
        latency: "156ms",
        serverLoad: "84%"
    },

    modules: [
        { id: 1, name: "Authentication Service", status: "Active", type: "green" },
        { id: 2, name: "Email Dispatcher (OTP)", status: "Active", type: "green" },
        { id: 3, name: "Database Cluster", status: "Active", type: "green" },
        { id: 4, name: "File Storage (Invoices)", status: "Degraded", type: "amber" }
    ],

    users: [
        {
            id: 101,
            name: "System Admin",
            role: "Super User",
            email: "admin@rorizon.com",
            password: "Admin@123",
            department: "Platform Governance",
            departmentId: "dept-platform",
            organizationId: "",
            phone: "5550198234",
            status: "Active",
            lastLogin: "2026-04-01 08:30 AM"
        },
        {
            id: 102,
            name: "John Anderson",
            role: "COO",
            email: "john@rorizon.com",
            password: "Coo@12345",
            department: "Executive Office",
            departmentId: "dept-exec",
            organizationId: "org-techcorp",
            phone: "5550198235",
            status: "Active",
            lastLogin: "2026-03-31 04:15 PM"
        },
        {
            id: 103,
            name: "Sarah Miller",
            role: "Manager",
            email: "sarah.miller@techcorp.com",
            password: "Manager@123",
            department: "Operations",
            departmentId: "dept-ops",
            organizationId: "org-techcorp",
            phone: "5550198236",
            status: "Active",
            lastLogin: "2026-04-01 09:00 AM"
        },
        {
            id: 104,
            name: "Michael Chen",
            role: "Analyst",
            email: "chen@rorizon.com",
            password: "Analyst@123",
            department: "Multi-Department Review",
            departmentId: "",
            assignedDepartmentIds: ["dept-ops", "dept-mfg", "dept-log", "dept-fac"],
            organizationId: "org-techcorp",
            phone: "5550198237",
            status: "Active",
            lastLogin: "2026-04-01 09:15 AM"
        }
    ],

    organizations: [
        {
            id: "org-techcorp",
            name: "TechCorp Industries",
            industry: "Industrial Manufacturing",
            cooName: "John Anderson",
            cooUserId: 102,
            cooEmail: "john@rorizon.com",
            departmentIds: ["dept-ops", "dept-mfg", "dept-log", "dept-fac"],
            target: "29,450 L",
            threshold: "32,000 L",
            current: "29,450 L",
            co2: "76,800",
            status: "Needs Attention",
            statusType: "amber",
            registrationStatus: "Approved",
            registrationStatusType: "green"
        }
    ],

    departments: [
        {
            id: "dept-ops",
            orgId: "org-techcorp",
            name: "Operations",
            manager: "Sarah Miller",
            managerUserId: 103,
            target: "5,000 L",
            threshold: "5,500 L",
            current: "4,800 L",
            co2: "12,500",
            status: "Within Target",
            statusType: "green"
        },
        {
            id: "dept-mfg",
            orgId: "org-techcorp",
            name: "Manufacturing",
            manager: "Robert Johnson",
            managerUserId: null,
            target: "12,000 L",
            threshold: "13,000 L",
            current: "13,200 L",
            co2: "34,500",
            status: "Exceeded",
            statusType: "red"
        },
        {
            id: "dept-log",
            orgId: "org-techcorp",
            name: "Logistics",
            manager: "Emily Davis",
            managerUserId: null,
            target: "8,000 L",
            threshold: "8,800 L",
            current: "8,600 L",
            co2: "22,400",
            status: "Approaching",
            statusType: "amber"
        },
        {
            id: "dept-fac",
            orgId: "org-techcorp",
            name: "Facilities",
            manager: "David Wilson",
            managerUserId: null,
            target: "3,000 L",
            threshold: "3,300 L",
            current: "2,850 L",
            co2: "7,450",
            status: "Within Target",
            statusType: "green"
        }
    ],

    departmentSnapshots: [
        { id: "dept-ops", orgId: "org-techcorp", name: "Operations", manager: "Sarah Miller", status: "submitted", consumption: "4,800 L", submittedAt: "Mar 31, 2026, 09:10 AM" },
        { id: "dept-mfg", orgId: "org-techcorp", name: "Manufacturing", manager: "Robert Johnson", status: "pending", consumption: "--", submittedAt: "--" },
        { id: "dept-log", orgId: "org-techcorp", name: "Logistics", manager: "Emily Davis", status: "pending", consumption: "--", submittedAt: "--" },
        { id: "dept-fac", orgId: "org-techcorp", name: "Facilities", manager: "David Wilson", status: "pending", consumption: "--", submittedAt: "--" }
    ],

    submissions: [
        {
            id: "sub01",
            organizationId: "org-techcorp",
            departmentId: "dept-ops",
            departmentName: "Operations",
            managerName: "Sarah Miller",
            managerUserId: 103,
            period: "10 2025",
            status: "Approved",
            score: "98%",
            submittedAt: "Oct 31, 2025",
            resources: [
                { type: "Diesel", unit: "Liters", qty: 2100 },
                { type: "LPG", unit: "Kg", qty: 2000 }
            ],
            totalConsumption: 4100,
            totalCO2: 10250,
            validation: { state: "valid", anomalyScore: 2, deviationReason: "" },
            locked: true
        },
        {
            id: "sub02",
            organizationId: "org-techcorp",
            departmentId: "dept-ops",
            departmentName: "Operations",
            managerName: "Sarah Miller",
            managerUserId: 103,
            period: "11 2025",
            status: "Approved",
            score: "95%",
            submittedAt: "Nov 30, 2025",
            resources: [
                { type: "Diesel", unit: "Liters", qty: 2200 },
                { type: "LPG", unit: "Kg", qty: 2100 }
            ],
            totalConsumption: 4300,
            totalCO2: 10750,
            validation: { state: "valid", anomalyScore: 4, deviationReason: "" },
            locked: true
        },
        {
            id: "sub03",
            organizationId: "org-techcorp",
            departmentId: "dept-ops",
            departmentName: "Operations",
            managerName: "Sarah Miller",
            managerUserId: 103,
            period: "12 2025",
            status: "Approved",
            score: "99%",
            submittedAt: "Dec 31, 2025",
            resources: [
                { type: "Diesel", unit: "Liters", qty: 2400 },
                { type: "LPG", unit: "Kg", qty: 2200 }
            ],
            totalConsumption: 4600,
            totalCO2: 11500,
            validation: { state: "valid", anomalyScore: 1, deviationReason: "" },
            locked: true
        },
        {
            id: "sub04",
            organizationId: "org-techcorp",
            departmentId: "dept-ops",
            departmentName: "Operations",
            managerName: "Sarah Miller",
            managerUserId: 103,
            period: "01 2026",
            status: "Approved",
            score: "100%",
            submittedAt: "Jan 31, 2026",
            resources: [
                { type: "Diesel", unit: "Liters", qty: 2300 },
                { type: "LPG", unit: "Kg", qty: 2200 }
            ],
            totalConsumption: 4500,
            totalCO2: 11250,
            validation: { state: "valid", anomalyScore: 0, deviationReason: "" },
            locked: true
        },
        {
            id: "sub05",
            organizationId: "org-techcorp",
            departmentId: "dept-ops",
            departmentName: "Operations",
            managerName: "Sarah Miller",
            managerUserId: 103,
            period: "02 2026",
            status: "Approved",
            score: "97%",
            submittedAt: "Feb 28, 2026",
            resources: [
                { type: "Diesel", unit: "Liters", qty: 2150 },
                { type: "LPG", unit: "Kg", qty: 2050 }
            ],
            totalConsumption: 4200,
            totalCO2: 10500,
            validation: { state: "valid", anomalyScore: 3, deviationReason: "" },
            locked: true
        }
    ],

    reports: [
        {
            id: 9001,
            title: "Emissions Report - February 2026",
            period: "February 2026",
            date: "3/5/2026",
            status: "Pending Review",
            statusClass: "amber",
            analystName: "Michael Chen",
            analystUserId: 104,
            signature: { signedBy: "Michael Chen", signedAt: "2026-03-05 20:00:00" },
            revision: { required: false, comment: "", requestedBy: "", requestedAt: "" },
            content: {
                intro: "This report covers the organizational emissions for February 2026.",
                consumption: "Total consumption decreased by 1.2% this month.",
                analysis: "All thresholds were met. Manufacturing stayed within the 12,000L limit.",
                comparisons: "Compared to January, overall efficiency is up.",
                conclusions: "Maintain current operational parameters."
            }
        },
        {
            id: 9002,
            title: "Emissions Report - January 2026",
            period: "January 2026",
            date: "2/5/2026",
            status: "Approved",
            statusClass: "green",
            analystName: "Michael Chen",
            analystUserId: 104,
            signature: { signedBy: "Michael Chen", signedAt: "2026-02-05 19:10:00" },
            revision: { required: false, comment: "", requestedBy: "", requestedAt: "" },
            content: {
                intro: "January 2026 organizational emissions review.",
                consumption: "High heating fuel usage due to winter temperatures.",
                analysis: "Facilities department exceeded targets by 5%.",
                comparisons: "Highest January usage in 3 years.",
                conclusions: "Approved by COO with note to monitor Facilities in Feb."
            }
        }
    ],

    alerts: [
        {
            id: "alt-001",
            type: "Threshold Breach",
            severity: "Critical",
            roleScope: ["Manager", "COO"],
            organizationId: "org-techcorp",
            departmentId: "dept-mfg",
            departmentName: "Manufacturing",
            status: "Open",
            message: "System detected consumption exceeding the monthly threshold by 200 liters.",
            deviationReason: "Temporary diesel generator use during power grid maintenance.",
            createdAt: "2026-03-07 14:00:00",
            updatedAt: "2026-03-07 14:00:00"
        },
        {
            id: "alt-002",
            type: "Approaching Target",
            severity: "Medium",
            roleScope: ["Manager", "COO"],
            organizationId: "org-techcorp",
            departmentId: "dept-log",
            departmentName: "Logistics",
            status: "Open",
            message: "Current consumption has reached 95% of the monthly target.",
            deviationReason: "",
            createdAt: "2026-03-06 19:50:00",
            updatedAt: "2026-03-06 19:50:00"
        }
    ],

    notifications: [
        {
            id: 1,
            role: "Manager",
            title: "Target Nearing",
            body: "Operations is approaching the 5,000 L target limit.",
            timestamp: "2 hours ago",
            read: false,
            details: "Current consumption is at 4,800 L."
        },
        {
            id: 2,
            role: "Manager",
            title: "Submission Approved",
            body: "Your previous data submission was approved.",
            timestamp: "1 day ago",
            read: false,
            details: "All metrics look good."
        },
        {
            id: 3,
            role: "COO",
            title: "Threshold Breach Raised",
            body: "Manufacturing exceeded its monthly threshold.",
            timestamp: "45 min ago",
            read: false,
            details: "Review the breach and assign a follow-up if needed."
        },
        {
            id: 4,
            role: "Analyst",
            title: "March Submission Received",
            body: "Operations has submitted its March resource data.",
            timestamp: "Just now",
            read: false,
            details: "Validated submission is ready for analyst review."
        },
        {
            id: 5,
            role: "Super User",
            title: "Audit Watch",
            body: "New organization activity was recorded.",
            timestamp: "Today",
            read: false,
            details: "Review platform-wide activity in the master audit trail."
        }
    ],

    auditLogs: [
        { id: 1, timestamp: "2026-03-29 19:45:10", actor: "Michael Chen (Analyst)", action: "Report Generation", status: "Success", statusType: "green" },
        { id: 2, timestamp: "2026-03-29 18:30:05", actor: "John Anderson (COO)", action: "Report Approval", status: "Success", statusType: "green" },
        { id: 3, timestamp: "2026-03-29 17:12:33", actor: "Anonymous", action: "Brute Force Attempt", status: "Blocked", statusType: "red" },
        { id: 4, timestamp: "2026-03-29 16:05:20", actor: "System Admin (Super User)", action: "User Account Created", status: "Success", statusType: "green" },
        { id: 5, timestamp: "2026-03-29 14:50:44", actor: "Sarah Miller (Manager)", action: "Data Submission", status: "Success", statusType: "green" }
    ],

    chartData: {
        months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        emissions: [62.4, 65.1, 64.8, 69.2, 73.0, 76.8]
    },

    managerChartData: {
        months: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
        myDeptUsage: [4100, 4300, 4600, 4500, 4200],
        orgAvgUsage: [4000, 4200, 4700, 4600, 4500, 4900]
    },

    managerDailyUsage: {
        Diesel: Array.from({ length: 31 }, (_, i) => Math.max(0, Math.floor((2500 / 31) + (Math.sin(i / 3) * 5) + (Math.random() * 10 - 5)))),
        LPG: Array.from({ length: 31 }, (_, i) => Math.max(0, Math.floor((1500 / 31) + (Math.cos(i / 3) * 5) + (Math.random() * 6 - 3)))),
        Electricity: Array.from({ length: 31 }, (_, i) => Math.max(0, Math.floor((3000 / 31) + (Math.random() * 20 - 10)))),
        Water: Array.from({ length: 31 }, (_, i) => Math.max(0, Math.floor((800 / 31) + (Math.sin(i / 5) * 4) + (Math.random() * 4 - 2))))
    },

    cooKpis: {
        totalConsumption: "29,450 L",
        totalEmissions: "76.8 t",
        emissionsTrend: "+5.2% vs last month",
        deptsOverTarget: 1,
        activeAlerts: 2,
        envStatus: "Needs Attention",
        envStatusDesc: "1 department over target"
    },

    buildSeedDB: () => {
        return {
            version: RorizonData.version,
            users: RorizonData.users.map(user => ({ ...user })),
            organizations: RorizonData.organizations.map(org => ({ ...org })),
            departments: RorizonData.departments.map(dept => ({ ...dept })),
            submissions: RorizonData.submissions.map(sub => ({ ...sub, resources: sub.resources.map(r => ({ ...r })), validation: { ...sub.validation } })),
            managerSubmissions: RorizonData.submissions.map(sub => ({
                id: sub.id,
                period: sub.period,
                status: sub.status,
                score: sub.score,
                submittedAt: sub.submittedAt,
                resources: sub.resources.map(r => ({ ...r })),
                totalConsumption: sub.totalConsumption,
                totalCO2: sub.totalCO2
            })),
            submissionTracker: RorizonData.departmentSnapshots.map(item => ({ ...item })),
            reports: RorizonData.reports.map(report => ({
                ...report,
                signature: { ...report.signature },
                revision: { ...report.revision },
                content: { ...report.content }
            })),
            alerts: RorizonData.alerts.map(alert => ({ ...alert, roleScope: [...alert.roleScope] })),
            notifications: RorizonData.notifications.map(notification => ({ ...notification })),
            auditLogs: RorizonData.auditLogs.map(log => ({ ...log })),
            systemMetrics: { ...RorizonData.systemMetrics },
            modules: RorizonData.modules.map(mod => ({ ...mod })),
            cooKpis: { ...RorizonData.cooKpis },
            chartData: {
                months: [...RorizonData.chartData.months],
                emissions: [...RorizonData.chartData.emissions]
            },
            managerChartData: {
                months: [...RorizonData.managerChartData.months],
                myDeptUsage: [...RorizonData.managerChartData.myDeptUsage],
                orgAvgUsage: [...RorizonData.managerChartData.orgAvgUsage]
            },
            managerDailyUsage: JSON.parse(JSON.stringify(RorizonData.managerDailyUsage))
        };
    },

    migrateDB: (db) => {
        const seed = RorizonData.buildSeedDB();
        const next = db && typeof db === "object" ? db : {};

        next.version = RorizonData.version;
        next.users = Array.isArray(next.users) && next.users.length ? next.users : seed.users;
        next.organizations = Array.isArray(next.organizations) && next.organizations.length ? next.organizations : seed.organizations;
        next.departments = Array.isArray(next.departments) && next.departments.length ? next.departments : seed.departments;
        next.submissions = Array.isArray(next.submissions) && next.submissions.length ? next.submissions : (Array.isArray(next.managerSubmissions) && next.managerSubmissions.length ? next.managerSubmissions : seed.submissions);
        next.managerSubmissions = Array.isArray(next.managerSubmissions) && next.managerSubmissions.length ? next.managerSubmissions : seed.managerSubmissions;
        next.submissionTracker = Array.isArray(next.submissionTracker) && next.submissionTracker.length ? next.submissionTracker : seed.submissionTracker;
        next.reports = Array.isArray(next.reports) && next.reports.length ? next.reports : (Array.isArray(next.rorizon_sa_reports) && next.rorizon_sa_reports.length ? next.rorizon_sa_reports : seed.reports);
        next.alerts = Array.isArray(next.alerts) && next.alerts.length ? next.alerts : seed.alerts;
        next.notifications = Array.isArray(next.notifications) && next.notifications.length ? next.notifications : seed.notifications;
        next.auditLogs = Array.isArray(next.auditLogs) && next.auditLogs.length ? next.auditLogs : seed.auditLogs;
        next.systemMetrics = next.systemMetrics || seed.systemMetrics;
        next.modules = Array.isArray(next.modules) && next.modules.length ? next.modules : seed.modules;
        next.cooKpis = next.cooKpis || seed.cooKpis;
        next.chartData = next.chartData || seed.chartData;
        next.managerChartData = next.managerChartData || seed.managerChartData;
        next.managerDailyUsage = next.managerDailyUsage || seed.managerDailyUsage;

        next.users = next.users.map(user => {
            const seedUser = seed.users.find(entry => entry.email.toLowerCase() === String(user.email || "").toLowerCase());
            const mergedUser = {
                password: seedUser ? seedUser.password : "ChangeMe@123",
                status: "Active",
                phone: "--",
                departmentId: "",
                assignedDepartmentIds: [],
                organizationId: seedUser ? seedUser.organizationId : "",
                ...seedUser,
                ...user
            };
            const assignedDepartmentIds = Array.isArray(mergedUser.assignedDepartmentIds) ? mergedUser.assignedDepartmentIds.filter(Boolean) : [];
            if (mergedUser.role === "Analyst") {
                mergedUser.assignedDepartmentIds = assignedDepartmentIds.length
                    ? assignedDepartmentIds
                    : (mergedUser.departmentId ? [mergedUser.departmentId] : []);
                mergedUser.department = mergedUser.organizationId ? "Multi-Department Review" : (mergedUser.department || "--");
                mergedUser.departmentId = "";
            } else {
                mergedUser.assignedDepartmentIds = [];
            }
            return {
                ...mergedUser
            };
        });

        next.departments = next.departments.map(dept => {
            const organization = next.organizations.find(org => org.id === dept.orgId) || null;
            return {
                orgName: organization ? organization.name : "",
                ...dept
            };
        });

        next.departments = next.departments.filter(dept => next.organizations.some(org => org.id === dept.orgId));

        next.organizations = next.organizations.map(org => ({
            departmentIds: next.departments.filter(dept => dept.orgId === org.id).map(dept => dept.id),
            ...org
        }));

        next.submissions = next.submissions.map(sub => {
            const department = next.departments.find(dept => dept.id === sub.departmentId || dept.name === sub.departmentName) || null;
            return {
                organizationId: sub.organizationId || department?.orgId || "",
                departmentId: department?.id || sub.departmentId || "",
                departmentName: department?.name || sub.departmentName || "",
                ...sub
            };
        });

        next.alerts = next.alerts.map(alert => {
            const department = next.departments.find(dept => dept.id === alert.departmentId || dept.name === alert.departmentName) || null;
            return {
                organizationId: alert.organizationId || department?.orgId || "",
                departmentId: department?.id || alert.departmentId || "",
                departmentName: department?.name || alert.departmentName || "",
                ...alert
            };
        });

        next.organizations = next.organizations.filter(org => {
            const coo = next.users.find(user => user.id === org.cooUserId && user.role === "COO");
            return Boolean(coo);
        });

        const validOrgIds = new Set(next.organizations.map(org => org.id));
        const validDeptIds = new Set(next.departments.filter(dept => validOrgIds.has(dept.orgId)).map(dept => dept.id));

        next.departments = next.departments.filter(dept => validOrgIds.has(dept.orgId));
        next.users = next.users.filter(user => {
            if (user.role === "Super User") return true;
            if (user.role === "COO") return validOrgIds.has(user.organizationId);
            if (!user.organizationId) return false;
            if (!validOrgIds.has(user.organizationId)) return false;
            if (user.role === "Analyst") {
                const assigned = Array.isArray(user.assignedDepartmentIds) ? user.assignedDepartmentIds : [];
                user.assignedDepartmentIds = assigned.filter(id => validDeptIds.has(id));
                return true;
            }
            return !user.departmentId || validDeptIds.has(user.departmentId);
        });
        next.submissions = next.submissions.filter(sub => validOrgIds.has(sub.organizationId) && validDeptIds.has(sub.departmentId));
        next.managerSubmissions = Array.isArray(next.managerSubmissions) ? next.managerSubmissions : seed.managerSubmissions;
        next.submissionTracker = (next.submissionTracker || []).filter(item => validOrgIds.has(item.orgId) && validDeptIds.has(item.id));
        next.alerts = next.alerts.filter(alert => validOrgIds.has(alert.organizationId) && validDeptIds.has(alert.departmentId));

        next.organizations = next.organizations.map(org => ({
            ...org,
            departmentIds: next.departments.filter(dept => dept.orgId === org.id).map(dept => dept.id)
        }));

        return next;
    },

    initDB: () => {
        const stored = localStorage.getItem("rorizon_db");
        if (!stored) {
            localStorage.setItem("rorizon_db", JSON.stringify(RorizonData.buildSeedDB()));
            return;
        }

        try {
            const migrated = RorizonData.migrateDB(JSON.parse(stored));
            localStorage.setItem("rorizon_db", JSON.stringify(migrated));
        } catch (error) {
            localStorage.setItem("rorizon_db", JSON.stringify(RorizonData.buildSeedDB()));
        }
    },

    factoryReset: () => {
        localStorage.removeItem("rorizon_db");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("loginTime");
        localStorage.removeItem("rorizon_notifs_read");
        RorizonData.initDB();
    }
};

RorizonData.initDB();
