import fs from "fs";
import path from "path";
import { folderNames } from "../ignore";

interface navItem {
    text: string;
    link: string;
}

/**
 * 辅助函数：深度优先搜索目录下第一个 .md 文件
 * @param dir 绝对路径
 * @returns 相对路径字符串或 null
 */
function findFirstFile(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;

    const entries = fs
        .readdirSync(dir)
        .sort((x, y) => x.localeCompare(y, "en"));

    for (const name of entries) {
        if (folderNames.includes(name)) continue; // 跳过忽略的目录

        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // 如果是目录，递归查找该目录下的第一个文件
            const childFile = findFirstFile(fullPath);
            if (childFile) {
                return `${name}/${childFile}`;
            }
        } else if (name.endsWith(".md")) {
            // 如果是 md 文件，直接返回文件名（去掉 .md 后缀以符合 VitePress 习惯，或保留取决于你）
            // 这里我们返回带后缀的路径，后面拼接时再统一处理
            return name;
        }
    }
    return null;
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
            // 查找该目录下第一个可用的 md 文件
            const firstFileRelativePath = findFirstFile(fullPath);

            // 如果找到了文件（说明文件夹不为空），则添加该目录到导航
            if (firstFileRelativePath) {
                // 移除 .md 后缀以匹配 VitePress 的 cleanUrls 逻辑
                const cleanLink =
                    `/${routePath}/${name}/${firstFileRelativePath}`.replace(
                        /\.md$/,
                        "",
                    );

                items.push({
                    text: name,
                    link: cleanLink.replace(/\/+/g, "/"), // 确保没有双斜杠
                });
            }
            // 如果 firstFileRelativePath 为 null，说明是空目录或没有 md 文件，直接跳过
        }
    }

    return items;
}
