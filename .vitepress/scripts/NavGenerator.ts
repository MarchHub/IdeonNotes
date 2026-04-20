import fs from "fs";
import path from "path";
import { folderNames } from "../ignore";
interface navItem {
    text: string;
    link: string;
}
/**
 *
 * @param dir 需要扫描的目录
 * @param routePath 前缀
 * @returns 返回当前目录所有有导航页面的文件夹
 */
export function ScanCurrentDir(dir: string, routePath = ""): navItem[] {
    dir = path.join(__dirname, dir);

    const entries = fs
        .readdirSync(dir)
        .sort((x: string, y: string) => x.localeCompare(y, "en"));

    const items: navItem[] = [];
    for (const name of entries) {
        // if (folderNames.includes(name))
        //     continue
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && fs.existsSync(path.join(fullPath))) {
            items.push({
                text: name,
                link: routePath + "/" + name + ".md",
            });
        }
    }

    return items;
}
