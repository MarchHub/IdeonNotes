import {
    normalizeCanonicalPath,
} from "../../shared/share-link-contract.ts";
import { baseUrl } from "../../shared/site-config.ts";
import type { PageShareInput } from "./page-share-service.ts";

export function createPageShareInput(input: {
    routePath: string;
    title: string;
    text?: string;
}): PageShareInput {
    const canonicalPath = normalizeCanonicalPath(input.routePath);
    return {
        canonicalPath,
        canonicalUrl: new URL(canonicalPath, `${baseUrl}/`).href,
        title: input.title,
        text: input.text,
    };
}
