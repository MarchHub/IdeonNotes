---
layout: page
title: Tag 聚合
description: 查看使用当前 Tag 的全部笔记
sidebar: false
aside: false
pageClass: tag-archive-page
---

<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import TagArchive from '../.vitepress/theme/components/TagArchive.vue'
import { data as tagCatalog } from '../.vitepress/theme/tag-catalog.data'

const { params } = useData()
const tag = computed(() => tagCatalog.tags.find((item) => item.routeId === params.value.tag))
</script>

<TagArchive :tag="tag" />
