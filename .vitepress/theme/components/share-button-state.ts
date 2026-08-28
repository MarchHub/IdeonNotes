import { ref, type Ref } from "vue";
import type {
    PageShareInput,
    PageShareService,
    SharePhase,
} from "../services/page-share-service.ts";

export function createShareButtonController(
    service: PageShareService,
    createInput: () => PageShareInput,
): {
    message: Ref<string>;
    displayUrl: Ref<string>;
    busy: Ref<boolean>;
    share: () => Promise<void>;
    reset: () => void;
} {
    const message = ref("");
    const displayUrl = ref("");
    const busy = ref(false);

    const onPhase = (phase: SharePhase, preserveMessage: boolean) => {
        if (preserveMessage) return;

        message.value = phase === "querying"
            ? "正在查找分享短链…"
            : "正在复制链接…";
    };

    const share = async () => {
        if (busy.value) return;
        const preserveMessage = displayUrl.value.length > 0;
        busy.value = true;

        try {
            const result = await service.share(
                createInput(),
                (phase) => onPhase(phase, preserveMessage),
            );

            if (result.status === "cancelled") {
                message.value = "";
                return;
            }

            displayUrl.value = result.url;
            const fallbackText = result.fallback ? "（短链不可用，已使用原始链接）" : "";

            if (result.status === "shared") {
                message.value = `分享面板已打开${fallbackText}`;
            } else if (result.status === "copied") {
                message.value = `链接已复制${fallbackText}`;
            } else {
                message.value = `自动复制失败，请手工复制${fallbackText}`;
            }
        } catch {
            message.value = "暂时无法分享，请稍后重试";
        } finally {
            busy.value = false;
        }
    };

    const reset = () => {
        message.value = "";
        displayUrl.value = "";
    };

    return { message, displayUrl, busy, share, reset };
}
