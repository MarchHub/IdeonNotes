import { promises as fs } from "node:fs";
import path from "node:path";
import { parseShortLinkDeploymentManifest } from "../utilities/short-link-pages.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const expected = parseShortLinkDeploymentManifest(
    JSON.parse(await fs.readFile(path.join(projectRoot, ".shortlink-dist/manifest.json"), "utf8")) as unknown,
);
const rawOrigin = process.env.SHORTLINK_HEALTH_ORIGIN;

if (rawOrigin === undefined) {
    throw new Error("必须设置 SHORTLINK_HEALTH_ORIGIN 才能执行生产短链健康检查");
}

const origin = new URL(rawOrigin);
if (origin.protocol !== "https:") throw new Error("短链健康检查只允许 HTTPS origin");

const deployedResponse = await fetch(new URL("/manifest.json", origin));
if (!deployedResponse.ok) throw new Error(`生产 manifest 响应异常：${deployedResponse.status}`);
const deployed = parseShortLinkDeploymentManifest(await deployedResponse.json());
if (deployed.registryHash !== expected.registryHash) {
    throw new Error(`生产 registry hash 不一致：${deployed.registryHash} != ${expected.registryHash}`);
}

for (const [id, record] of Object.entries(expected.records)) {
    const response = await fetch(new URL(`/s/${id}/`, origin), { redirect: "manual" });
    if (record.status === "gone") {
        if (response.status !== 200 && response.status !== 410) {
            throw new Error(`gone 短链响应异常：${id} -> ${response.status}`);
        }
        continue;
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400) {
        if (location === null || new URL(location, origin).href !== record.target) {
            throw new Error(`短链重定向目标异常：${id}`);
        }
    } else if (response.status === 200) {
        const html = await response.text();
        if (!html.includes(record.target)) throw new Error(`静态短链页面目标异常：${id}`);
    } else {
        throw new Error(`active 短链响应异常：${id} -> ${response.status}`);
    }
}

for (const invalidPath of ["/s/invalid/", "/s/%2e%2e%2fmanifest.json/", "/s/not-found-id/"]) {
    const response = await fetch(new URL(invalidPath, origin), { redirect: "manual" });
    if (response.status !== 404) throw new Error(`非法短链应返回 404：${invalidPath}`);
}

console.info(`[share-links] production health check passed for ${origin.origin}`);
