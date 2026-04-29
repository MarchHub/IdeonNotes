import fs from "fs";
import path from "path";
import { folderNames } from "../ignore";
interface SidebarItem {
    text: string;
    link?: string;
    items?: SidebarItem[];
    collapsed?: boolean;
}

/**
 *
 * @param childItems 子项
 * @returns True: 子项全都是文件夹, False: 子项中有 md 文件
 */
function CheckChildrenFolder(childItems: SidebarItem[]): boolean {
    for (const item of childItems) {
        if (item.items != null) {
            return false;
        }
    }
    return true;
}

/**
 * @param dir 需要扫描的当前目录
 * @param rountPath 文件前缀
 * @returns 返回传入的 dir 生成的 sidebar
 */
function ScanDir(dir: string, routePath = "", depth = 1): SidebarItem[] {
    const entries = fs
        .readdirSync(dir)
        .sort((x: string, y: string) => x.localeCompare(y, "en"));

    const items: SidebarItem[] = [];

    for (const name of entries) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        if (folderNames.includes(name)) continue;
        // directory -> gen title item
        if (stat.isDirectory()) {
            const childItems = ScanDir(
                fullPath,
                // path.join(routePath, name),
                routePath + "/" + name,
                depth + 1,
            );
            // 存在子项, 添加为子项, 并且当前节点是折叠的节点
            if (childItems.length) {
                // 存在导航页面, 添加

                items.push({
                    text: name,
                    collapsed: CheckChildrenFolder(childItems) || depth >= 2,
                    items: childItems,
                });
            }
            // 若不存在子项 就直接跳过
        }
        // 作为 md 文件 -> 添加 link
        else if (name.endsWith(".md") && name != "index.md") {
            const slug = name.replace(/\.md$/, "");
            const link = `/${routePath}/${slug}`;
            items.push({
                text: slug,
                link: link,
            });
        }
    }

    return items;
}

//TODO: 是否要对每一个专栏的侧边栏进行简单的重定义？

export const postSidebar: SidebarItem[] = ScanDir(
    path.join(__dirname, "../../posts"),
    "posts",
);

export const aboutSidebar: SidebarItem[] = [
    {
        text: "About", // 添加一个顶级 title
        // link: "/about/",
        items: ScanDir(path.join(__dirname, "../../about"), "about"),
    },
];
