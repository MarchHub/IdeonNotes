import { promises as fs } from "node:fs";
import type { Plugin } from "vite";
import {
    SHARE_LINK_MANIFEST_PATH,
    parseShareLinkManifest,
} from "../shared/share-link-contract.ts";

export async function loadShareLinkManifestSource(file: string): Promise<string> {
    const source = await fs.readFile(file, "utf8");
    parseShareLinkManifest(JSON.parse(source) as unknown);
    return source.endsWith("\n") ? source : `${source}\n`;
}

export function ShareLinkManifestPlugin(options: {
    manifestFile: string;
}): Plugin {
    return {
        name: "yuufrag-share-link-manifest",
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const pathname = request.url?.split(/[?#]/, 1)[0];

                if (pathname !== SHARE_LINK_MANIFEST_PATH) {
                    next();
                    return;
                }

                if (request.method !== "GET" && request.method !== "HEAD") {
                    response.statusCode = 405;
                    response.setHeader("Allow", "GET, HEAD");
                    response.end();
                    return;
                }

                try {
                    const source = await loadShareLinkManifestSource(
                        options.manifestFile,
                    );
                    response.statusCode = 200;
                    response.setHeader("Content-Type", "application/json; charset=utf-8");
                    response.setHeader("Cache-Control", "no-store");
                    response.end(request.method === "HEAD" ? undefined : source);
                } catch (error) {
                    response.statusCode = 500;
                    response.setHeader("Content-Type", "text/plain; charset=utf-8");
                    response.end(`分享 manifest 无法读取：${(error as Error).message}`);
                }
            });
        },
        async generateBundle() {
            const source = await loadShareLinkManifestSource(options.manifestFile);
            this.emitFile({
                type: "asset",
                fileName: SHARE_LINK_MANIFEST_PATH.slice(1),
                source,
            });
        },
    };
}
