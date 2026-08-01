import fs from "fs";
import path from "path";
import { folderNames } from "../ignore";
import { pageIdToPublicHref } from "../utilities/route-paths";

interface navItem {
    text: string;
    link: string;
}

/**
 * @param dir 需要扫描的目录 (相对 __dirname)
 * @param routePath 前缀 (如 "posts")
 * @returns 返回当前目录所有有内容的文件夹导航
 */
export function ScanCurrentDir(dir: string, routePath = ""): navItem[] {
    const absoluteDir = path.join(__dirname, dir);

    if (!fs.existsSync(absoluteDir)) return [];

    const entries = fs
        .readdirSync(absoluteDir)
        .sort((x, y) => x.localeCompare(y, "en"));

    const items: navItem[] = [];

    for (const name of entries) {
        if (folderNames.includes(name)) continue;

        const fullPath = path.join(absoluteDir, name);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            const categoryIndex = path.join(fullPath, "index.md");

            if (!fs.existsSync(categoryIndex)) {
                throw new Error(`分类目录缺少 index.md：${fullPath}`);
            }

            items.push({
                text: name,
                link: pageIdToPublicHref(
                    `${routePath}/${name}/index.md`.replace(/\/+/g, "/"),
                ),
            });
        }
    }

    return items;
}
