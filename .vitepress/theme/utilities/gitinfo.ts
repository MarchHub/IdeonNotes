import { spawnSync } from "node:child_process";

/**
 * 获取 Git 文件时间戳
 * @param file 文件路径
 * @param type 'created' | 'updated'
 */
export function getGitTimestamp(
    file: string,
    type: "created" | "updated" = "updated",
) {
    const args =
        type === "created"
            ? ["log", "--diff-filter=A", "--format=%at", "-1", file] // 获取首次提交时间
            : ["log", "-1", "--format=%at", file]; // 获取最后一次提交时间

    const { stdout } = spawnSync("git", args, { encoding: "utf-8" });
    const timestamp = parseInt(stdout.trim(), 10);

    return timestamp ? timestamp * 1000 : Date.now();
}
