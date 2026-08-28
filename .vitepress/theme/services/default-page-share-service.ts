import { StaticManifestShareLinkQuery } from "./share-link-query.ts";
import {
    BrowserClipboardAdapter,
    DefaultPageShareService,
} from "./page-share-service.ts";

export const pageShareService = new DefaultPageShareService(
    new StaticManifestShareLinkQuery(),
    { canShare: () => false, share: async () => undefined },
    new BrowserClipboardAdapter(),
);
