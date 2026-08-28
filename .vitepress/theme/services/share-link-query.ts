import {
    SHARE_LINK_MANIFEST_PATH,
    normalizeCanonicalPath,
    parseShareLinkManifest,
    shareIdToShortUrl,
    type ShareId,
    type ShareLinkManifest,
} from "../../shared/share-link-contract.ts";

export interface ShareLinkValue {
    id: ShareId;
    url: string;
}

export interface ShareLinkQuery {
    findByCanonicalPath(path: string): Promise<ShareLinkValue | undefined>;
}

export type ShareLinkQueryErrorCode = "fetch" | "http" | "schema";

export class ShareLinkQueryError extends Error {
    public readonly code: ShareLinkQueryErrorCode;

    constructor(
        code: ShareLinkQueryErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.code = code;
        this.name = "ShareLinkQueryError";
    }
}

export type ShareLinkFetch = (
    input: string,
    init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class StaticManifestShareLinkQuery implements ShareLinkQuery {
    private manifestPromise: Promise<ShareLinkManifest> | undefined;
    private readonly manifestUrl: string;
    private readonly fetchImpl: ShareLinkFetch;

    constructor(options: {
        manifestUrl?: string;
        fetchImpl?: ShareLinkFetch;
    } = {}) {
        this.manifestUrl = options.manifestUrl ?? SHARE_LINK_MANIFEST_PATH;
        const injected = options.fetchImpl;

        this.fetchImpl = injected ?? (async (input, init) => {
            if (typeof globalThis.fetch !== "function") {
                throw new Error("当前环境不支持 fetch");
            }

            return globalThis.fetch(input, init);
        });
    }

    async findByCanonicalPath(path: string): Promise<ShareLinkValue | undefined> {
        const canonicalPath = normalizeCanonicalPath(path);
        const manifest = await this.loadManifest();
        const id = manifest.byCanonicalPath[canonicalPath];

        return id === undefined ? undefined : { id, url: shareIdToShortUrl(id) };
    }

    private loadManifest(): Promise<ShareLinkManifest> {
        if (this.manifestPromise === undefined) {
            const pending = this.fetchManifest().catch((error: unknown) => {
                if (this.manifestPromise === pending) this.manifestPromise = undefined;
                throw error;
            });
            this.manifestPromise = pending;
        }

        return this.manifestPromise;
    }

    private async fetchManifest(): Promise<ShareLinkManifest> {
        let response: Awaited<ReturnType<ShareLinkFetch>>;

        try {
            response = await this.fetchImpl(this.manifestUrl, {
                headers: { Accept: "application/json" },
            });
        } catch (error) {
            throw new ShareLinkQueryError("fetch", "无法加载分享链接清单", {
                cause: error,
            });
        }

        if (!response.ok) {
            throw new ShareLinkQueryError(
                "http",
                `分享链接清单响应异常：HTTP ${response.status}`,
            );
        }

        try {
            return parseShareLinkManifest(await response.json());
        } catch (error) {
            throw new ShareLinkQueryError("schema", "分享链接清单格式非法", {
                cause: error,
            });
        }
    }
}
