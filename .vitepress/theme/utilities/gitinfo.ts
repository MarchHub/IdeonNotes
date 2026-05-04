import { spawnSync } from "node:child_process";
import path from "node:path";

export function getGitTimestamp(
    file: string,
    type: "created" | "updated" = "updated",
): number {
    try {
        const gitFilePath = file.replace(/\\/g, "/").replace(/^\//, "");

        const args =
            type === "created"
                ? [
                      "log",
                      "--diff-filter=A",
                      "--format=%at",
                      "-1",
                      "--",
                      gitFilePath,
                  ]
                : ["log", "-1", "--format=%at", "--", gitFilePath];

        const { stdout, stderr, status } = spawnSync("git", args, {
            encoding: "utf-8",
            cwd: process.cwd(),
        });

        if (status !== 0) {
            console.warn(`⚠️ Git: ${file} - ${stderr?.trim()}`);
            return Date.now();
        }

        const timestamp = parseInt(stdout.trim(), 10);
        return !isNaN(timestamp) && timestamp > 0
            ? timestamp * 1000
            : Date.now();
    } catch (error) {
        return Date.now();
    }
}
