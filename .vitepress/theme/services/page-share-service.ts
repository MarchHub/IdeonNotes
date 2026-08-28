import type { ShareLinkQuery } from "./share-link-query.ts";

export type SharePhase = "querying" | "sharing" | "copying";

export interface PageShareInput {
    canonicalPath: string;
    canonicalUrl: string;
    title: string;
    text?: string;
}

export interface SharePayload {
    title: string;
    text?: string;
    url: string;
}

export interface NativeShareAdapter {
    canShare(payload: SharePayload): boolean;
    share(payload: SharePayload): Promise<void>;
}

export interface ClipboardAdapter {
    writeText(value: string): Promise<void>;
}

export type PageShareResult =
    | { status: "shared" | "copied"; url: string; fallback: boolean }
    | { status: "cancelled"; url: string; fallback: boolean }
    | { status: "manual"; url: string; fallback: boolean; error?: unknown };

export interface PageShareService {
    share(
        input: PageShareInput,
        onPhase?: (phase: SharePhase) => void,
    ): Promise<PageShareResult>;
}

function isAbortError(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
    );
}

export class BrowserNativeShareAdapter implements NativeShareAdapter {
    canShare(payload: SharePayload): boolean {
        if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
            return false;
        }

        return typeof navigator.canShare !== "function" || navigator.canShare(payload);
    }

    async share(payload: SharePayload): Promise<void> {
        if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
            throw new Error("当前环境不支持原生分享");
        }

        await navigator.share(payload);
    }
}

export class BrowserClipboardAdapter implements ClipboardAdapter {
    async writeText(value: string): Promise<void> {
        if (
            typeof navigator === "undefined" ||
            navigator.clipboard === undefined ||
            typeof navigator.clipboard.writeText !== "function"
        ) {
            throw new Error("当前环境不支持 Clipboard API");
        }

        await navigator.clipboard.writeText(value);
    }
}

export class DefaultPageShareService implements PageShareService {
    private readonly query: ShareLinkQuery;
    private readonly nativeShare: NativeShareAdapter;
    private readonly clipboard: ClipboardAdapter;

    constructor(
        query: ShareLinkQuery,
        nativeShare: NativeShareAdapter,
        clipboard: ClipboardAdapter,
    ) {
        this.query = query;
        this.nativeShare = nativeShare;
        this.clipboard = clipboard;
    }

    async share(
        input: PageShareInput,
        onPhase?: (phase: SharePhase) => void,
    ): Promise<PageShareResult> {
        onPhase?.("querying");
        let url = input.canonicalUrl;
        let fallback = false;

        try {
            const shortLink = await this.query.findByCanonicalPath(input.canonicalPath);

            if (shortLink === undefined) {
                fallback = true;
            } else {
                url = shortLink.url;
            }
        } catch {
            fallback = true;
        }

        const payload: SharePayload = { title: input.title, text: input.text, url };

        let canUseNativeShare = false;
        try {
            canUseNativeShare = this.nativeShare.canShare(payload);
        } catch {
            canUseNativeShare = false;
        }

        if (canUseNativeShare) {
            onPhase?.("sharing");

            try {
                await this.nativeShare.share(payload);
                return { status: "shared", url, fallback };
            } catch (error) {
                if (isAbortError(error)) {
                    return { status: "cancelled", url, fallback };
                }
            }
        }

        onPhase?.("copying");

        try {
            await this.clipboard.writeText(url);
            return { status: "copied", url, fallback };
        } catch (error) {
            return { status: "manual", url, fallback, error };
        }
    }
}
