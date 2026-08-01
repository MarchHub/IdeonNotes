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
            const indexPath = path.join(fullPath, "index.md");

            if (childItems.length) {
                items.push({
                    text: name,
                    link: fs.existsSync(indexPath)
                        ? pageIdToPublicHref(`${newRoutePath}/index.md`)
                        : undefined,
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
