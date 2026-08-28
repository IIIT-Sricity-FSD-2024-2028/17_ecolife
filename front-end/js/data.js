/**
 * Rorizon frontend data compatibility constants.
 * Runtime application data is loaded from the NestJS backend through /api/*.
 */
const RorizonData = {
    defaultPassword: "Default@123",
    initDB: () => null,
    factoryReset: () => {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("loginTime");
        localStorage.removeItem("rorizon_notifs_read");
    }
};
