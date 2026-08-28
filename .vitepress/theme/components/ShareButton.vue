<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useData, useRoute } from "vitepress";
import { pageShareService } from "../services/default-page-share-service.ts";
import { createPageShareInput } from "../services/page-share-context.ts";
import {
    createShareButtonController,
} from "./share-button-state.ts";

const props = defineProps<{
    screenMenu?: boolean;
}>();
const route = useRoute();
const { page, frontmatter } = useData();
const linkInput = ref<HTMLInputElement>();
const controller = createShareButtonController(pageShareService, () =>
    createPageShareInput({
        routePath: route.path,
        title: page.value.title,
        text: typeof frontmatter.value.description === "string"
            ? frontmatter.value.description
            : undefined,
    }),
);

async function copyAndSelect(): Promise<void> {
    await controller.share();

    if (controller.displayUrl.value) {
        await nextTick();
        linkInput.value?.focus();
        linkInput.value?.select();
    }
}

function onFocusOut(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !container.contains(nextTarget)) {
        controller.reset();
    }
}

watch(() => route.path, () => controller.reset());
</script>

<template>
    <div
        class="share-nav"
        :class="{ 'screen-menu': props.screenMenu }"
        @focusout="onFocusOut"
    >
        <button
            type="button"
            class="share-trigger"
            :aria-busy="controller.busy.value"
            :aria-expanded="Boolean(controller.displayUrl.value)"
            aria-controls="share-link-dropdown"
            @click="copyAndSelect"
        >
            分享
        </button>

        <div
            v-if="controller.displayUrl.value"
            id="share-link-dropdown"
            class="share-menu"
            role="dialog"
            aria-label="分享链接"
        >
            <div class="share-link-field">
                <input
                    ref="linkInput"
                    :value="controller.displayUrl.value"
                    aria-label="完整分享链接"
                    readonly
                    @focus="($event.target as HTMLInputElement).select()"
                    @click="($event.target as HTMLInputElement).select()"
                />
                <button
                    type="button"
                    class="share-copy-button"
                    :disabled="controller.busy.value"
                    aria-label="复制分享链接"
                    title="复制链接"
                    @click="copyAndSelect"
                >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                    >
                        <path
                            fill="currentColor"
                            d="M8 7V5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h2Zm3-3a1 1 0 0 0-1 1v2h3a3 3 0 0 1 3 3v3h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-7ZM6 9a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H6Z"
                        />
                    </svg>
                </button>
            </div>
            <p class="share-feedback" aria-live="polite">
                {{ controller.message.value }}
            </p>
        </div>
    </div>
</template>

<style scoped>
.share-nav {
    position: relative;
    display: flex;
    align-items: center;
    margin-left: 8px;
}

.share-nav::before {
    position: absolute;
    top: 50%;
    left: -8px;
    width: 1px;
    height: 24px;
    background: var(--vp-c-divider);
    content: "";
    transform: translateY(-50%);
}

.share-trigger {
    display: flex;
    align-items: center;
    padding: 0 12px;
    height: var(--vp-nav-height);
    color: var(--vp-c-text-1);
    font-size: 14px;
    font-weight: 500;
    line-height: var(--vp-nav-height);
    transition: color 0.25s;
}

.share-trigger:hover,
.share-trigger:focus-visible {
    color: var(--vp-c-brand-1);
}

.share-menu {
    position: absolute;
    z-index: 50;
    top: calc(var(--vp-nav-height) / 2 + 20px);
    right: 0;
    width: min(420px, calc(100vw - 32px));
    padding: 12px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    background-color: var(--vp-c-bg-elv);
    box-shadow: var(--vp-shadow-3);
}

.share-link-field {
    display: flex;
    overflow: hidden;
    border: 1px solid var(--vp-c-divider);
    border-radius: 7px;
    background: var(--vp-c-bg-soft);
}

.share-link-field:focus-within {
    border-color: var(--vp-c-brand-1);
}

.share-link-field input {
    min-width: 0;
    flex: 1;
    padding: 8px 10px;
    border: 0;
    color: var(--vp-c-text-1);
    background: transparent;
    font-size: 13px;
}

.share-copy-button {
    display: grid;
    width: 38px;
    flex: 0 0 38px;
    place-items: center;
    border: 0;
    border-left: 1px solid var(--vp-c-divider);
    color: var(--vp-c-text-2);
    background: var(--vp-c-bg-soft);
    transition: color 0.25s;
}

.share-copy-button:hover,
.share-copy-button:focus-visible {
    color: var(--vp-c-brand-1);
}

.share-feedback {
    margin: 8px 0 0;
    color: var(--vp-c-text-2);
    font-size: 12px;
    line-height: 20px;
}

.share-nav.screen-menu {
    display: block;
    margin-left: 0;
    border-bottom: 1px solid var(--vp-c-divider);
}

.share-nav.screen-menu::before {
    display: none;
}

.share-nav.screen-menu .share-trigger {
    justify-content: flex-start;
    width: 100%;
    height: 48px;
    padding: 12px 0 11px;
    line-height: 24px;
}

.share-nav.screen-menu .share-menu {
    position: static;
    width: 100%;
    margin: 0 0 12px;
    box-shadow: none;
}
</style>
