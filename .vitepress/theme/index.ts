// https://vitepress.dev/guide/custom-theme
import { Fragment, h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import ArticleMetadata from "./components/ArticleMetadata.vue";
import "./style.css";
import "./styles/index.css";
import "./styles/vars.css";
import Contributors from "./components/Contributors.vue";
import AboutTeam from "./components/AboutTeam.vue";

import mediumZoom from "medium-zoom";
import { onMounted, watch, nextTick } from "vue";
import { useRoute } from "vitepress";
import TagList from "./components/TagList.vue";
import CategoryCards from "./components/CategoryCards.vue";
import RecentPosts from "./components/RecentPosts.vue";
export default {
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            "home-features-after": () =>
                h(Fragment, null, [h(CategoryCards), h(RecentPosts)]),
            "doc-footer-before": () =>
                h(Fragment, null, [h(TagList), h(Contributors)]),
        });
    },
    extends: DefaultTheme,
    setup() {
        const route = useRoute();
        const initZoom = () => {
            // mediumZoom('[data-zoomable]', { background: 'var(--vp-c-bg)' }); // 默认
            mediumZoom(".main img", { background: "var(--vp-c-bg)" }); // 不显式添加{data-zoomable}的情况下为所有图像启用此功能
        };
        const initPet = () => {
            // 桌宠
            const isDesktop =
                !window.matchMedia("(pointer:coarse)").matches &&
                !window.matchMedia("(max-width:900px)").matches;

            if (isDesktop) {
                const pixiScript = document.createElement("script");
                pixiScript.src =
                    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.2/browser/pixi.min.js";

                pixiScript.onload = () => {
                    const petScript = document.createElement("script");

                    const pets = [
                        "https://cdn.harucdn.com/model_haruhi.js",
                        "https://cdn.harucdn.com/model_mikuru.js",
                        "https://cdn.harucdn.com/model_yuki.js",
                    ];

                    const randomPetUrl =
                        pets[Math.floor(Math.random() * pets.length)];

                    petScript.src = randomPetUrl;

                    // petScript.src = "https://cdn.harucdn.com/model_mikuru.js";

                    petScript.onload = () => {
                        const canvases = document.querySelectorAll("canvas");
                        const petCanvas = canvases[canvases.length - 1];

                        if (petCanvas) {
                            petCanvas.style.transform = "scale(0.6)";
                            petCanvas.style.transformOrigin = "bottom right";
                        }
                    };
                    document.body.appendChild(petScript);
                };

                document.head.appendChild(pixiScript);
            }
        };
        onMounted(() => {
            initZoom();
            // initPet();
        });
        watch(
            () => route.path,
            () => nextTick(() => initZoom()),
        );
    },
    enhanceApp({ app, router, siteData }) {
        app.component("ArticleMetadata", ArticleMetadata);
        app.component("Contributors", Contributors);
        app.component("AboutTeam", AboutTeam);
    },
} satisfies Theme;
