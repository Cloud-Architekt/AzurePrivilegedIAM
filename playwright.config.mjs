import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "ClassificationExplorer",
    testMatch: "**/*.spec.mjs",
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    reporter: process.env.CI ? "github" : "list"
});
