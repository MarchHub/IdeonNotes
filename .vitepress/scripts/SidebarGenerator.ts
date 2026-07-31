import fs from "fs";
import path from "path";
import { folderNames } from "../ignore";
import { pageIdToPublicHref } from "../utilities/route-paths";

interface SidebarItem {
    text: string;
    link?: string;
    items?: SidebarItem[];
    collapsed?: boolean;
}

/**
 * 辅助函数：查找目录下第一个存在的 .md 文件（用于让文件夹标题可点击）
 */
// function getFirstFile(dir: string, routePath: string): string | undefined {
//     const entries = fs
//         .readdirSync(dir)
//         .sort((x, y) => x.localeCompare(y, "en"));
//     for (const name of entries) {
//         const fullPath = path.join(dir, name);
//         const stat = fs.statSync(fullPath);
//         if (folderNames.includes(name)) continue;

//         if (stat.isDirectory()) {
//             const childFile = getFirstFile(fullPath, `${routePath}/${name}`);
//             if (childFile) return childFile;
//         } else if (name.endsWith(".md") && name !== "index.md") {
//             return `${routePath}/${name.replace(/\.md$/, "")}`;
//         }
//     }
//     return undefined;
// }

function ScanDir(dir: string, routePath = "", depth = 1): SidebarItem[] {
    const entries = fs
        .readdirSync(dir)
        .sort((x, y) => x.localeCompare(y, "en"));

    const items: SidebarItem[] = [];

    for (const name of entries) {
        const fullPath = path.join(dir, name);
        if (!fs.existsSync(fullPath)) continue;

        const stat = fs.statSync(fullPath);
        if (folderNames.includes(name)) continue;

        if (stat.isDirectory()) {
            const newRoutePath = routePath ? `${routePath}/${name}` : name;
            const childItems = ScanDir(fullPath, newRoutePath, depth + 1);

            if (childItems.length) {
                // 找到该目录下第一个文件作为文件夹的落地页
                // const firstFileLink = getFirstFile(fullPath, newRoutePath);

                items.push({
                    text: name,
                    // link: firstFileLink ? `/${firstFileLink}` : undefined,
                    items: childItems,
                    // 只有深度大于等于 2 的才折叠，或者根据你的 CheckChildrenFolder 逻辑
                    collapsed: depth >= 2,
                });
            }
        } else if (name.endsWith(".md") && name !== "index.md") {
            const slug = name.replace(/\.md$/, "");
            items.push({
                text: slug,
                link: pageIdToPublicHref(`${routePath}/${name}`),
            });
        }
    }
    return items;
}

export const postSidebar: SidebarItem[] = ScanDir(
    path.join(__dirname, "../../posts"),
    "posts",
);

export const aboutSidebar: SidebarItem[] = [
    {
        text: "About",
        link: "/about/index", // 之前你提到的 index.md
        items: ScanDir(path.join(__dirname, "../../about"), "about"),
    },
];
