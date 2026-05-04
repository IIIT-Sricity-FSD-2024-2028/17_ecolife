"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("./main");
async function writeSwagger() {
    const app = await (0, main_1.createApp)();
    await app.close();
}
void writeSwagger();
//# sourceMappingURL=swagger-file.js.map