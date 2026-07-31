<template>
    <div class="phaseshard-wrapper" :class="{ 'is-fullscreen': isFullscreen }">
        <div class="graph-area">
            <button class="fullscreen-btn" @click="toggleFullscreen" title="切换全屏">
                <svg v-if="!isFullscreen" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                    stroke-width="2" fill="none">
                    <path
                        d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3">
                    </path>
                </svg>
                <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                    fill="none">
                    <path
                        d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3">
                    </path>
                </svg>
                <span>{{ isFullscreen ? '退出全屏' : '全屏展示' }}</span>
            </button>

            <div ref="graphContainer" class="svg-container"></div>

            <transition name="fade">
                <div v-if="tooltip.show" class="hover-tooltip"
                    :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
                    <span class="group-dot" :style="{ backgroundColor: getGroupColor(tooltip.node?.group) }"></span>
                    {{ tooltip.node?.title }}
                </div>
            </transition>
        </div>

        <div class="obsidian-panel">
            <div class="panel-section stats-section">
                <div class="section-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path
                            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
                        </path>
                    </svg>
                    全局统计
                </div>
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-value">{{ stats.nodes }}</div>
                        <div class="stat-label">笔记节点</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{{ stats.links }}</div>
                        <div class="stat-label">关联拓扑</div>
                    </div>
                </div>

                <div class="tag-cloud">
                    <span v-for="tag in stats.topGroups" :key="tag.name" class="mini-tag"
                        :style="{ borderColor: getGroupColor(tag.name), color: getGroupColor(tag.name) }"
                        @mouseenter="highlightGroup(tag.name)" @mouseleave="resetHighlight">
                        {{ tag.name }} ({{ tag.count }})
                    </span>
                </div>
            </div>

            <div class="panel-section node-list-section">
                <div class="section-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                    笔记索引
                </div>

                <div class="mobile-node-tools">
                    <label class="node-search-control">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none" aria-hidden="true">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input v-model="nodeSearchQuery" type="search" aria-label="搜索知识节点"
                            placeholder="搜索标题、分类或标签" />
                        <button v-if="nodeSearchQuery" class="search-clear-btn" type="button" aria-label="清空节点搜索"
                            @click="clearNodeSearch">
                            ×
                        </button>
                    </label>
                    <div class="node-list-meta" aria-live="polite">{{ nodeListStatus }}</div>
                </div>

                <div class="node-list" @mouseleave="resetHighlight">
                    <div v-if="visibleNodes.length === 0" class="node-list-empty">
                        没有匹配的知识节点
                    </div>
                    <div class="focus-list-item" v-for="node in visibleNodes" :key="node.id"
                        :class="{ 'is-active': activeNode?.id === node.id }"
                        :style="{ '--node-color': getGroupColor(node.group) }" @mouseenter="highlightNode(node.id)"
                        @click="activeNode = node">
                        <span class="list-dot"
                            :style="{ backgroundColor: getGroupColor(node.group), boxShadow: `0 0 6px ${getGroupColor(node.group)}` }"></span>
                        <span class="list-text">{{ node.title }}</span>
                    </div>
                </div>

                <div v-if="isCompactLayout && !nodeSearchQuery && rawData.nodes.length > mobileNodeLimit"
                    class="mobile-list-actions">
                    <button class="mobile-list-toggle" type="button" @click="showAllMobileNodes = !showAllMobileNodes">
                        {{ showAllMobileNodes ? '收起为精选节点' : `查看全部 ${rawData.nodes.length} 个节点` }}
                    </button>
                </div>
            </div>

            <div class="panel-section detail-section">
                <div class="section-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    节点聚焦
                </div>

                <div v-if="activeNode" class="active-node-card" @mouseenter="highlightNode(activeNode.id)"
                    @mouseleave="resetHighlight">
                    <div class="node-badge"
                        :style="{ backgroundColor: getGroupColor(activeNode.group) + '20', color: getGroupColor(activeNode.group) }">
                        {{ activeNode.group || '未分类' }}
                    </div>
                    <h3 class="node-title">{{ activeNode.title }}</h3>
                    <div class="node-connections">
                        ⇋ 关联了 {{ getNodeConnectionCount(activeNode.id) }} 个知识点
                    </div>
                    <div class="node-summary-scroll">
                        <p class="node-summary">{{ activeNode.summary || '暂无内容摘要...' }}</p>
                    </div>
                    <button class="obsidian-btn" @click="navigateTo(activeNode.path)">打开笔记 ➔</button>
                </div>

                <div v-else class="empty-state">
                    <div class="icon">⚲</div>
                    <p>从上方索引或图谱中选择节点</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vitepress'
import * as d3 from 'd3'

interface GraphNode {
    id: string
    title: string
    group: string
    val: number
    path: string
    summary?: string
    tags?: string[]
}

interface GraphLink {
    source: string | GraphNode
    target: string | GraphNode
    type: 'hard' | 'soft'
    reason?: string
}

interface GraphData {
    nodes: GraphNode[]
    links: GraphLink[]
}

const router = useRouter()
const graphContainer = ref<HTMLElement | null>(null)
let simulation: d3.Simulation<any, any> | null = null
let resizeObserver: ResizeObserver | null = null

// D3 元素选择器
let svgNode: d3.Selection<any, any, any, any> | null = null
let svgLink: d3.Selection<any, any, any, any> | null = null
let svgLabel: d3.Selection<any, any, any, any> | null = null

const isFullscreen = ref(false)
const chargeStrength = ref(-250)
const mobileNodeLimit = 12
const isCompactLayout = ref(false)
const nodeSearchQuery = ref('')
const showAllMobileNodes = ref(false)
let compactLayoutMediaQuery: MediaQueryList | null = null
const tooltip = ref<{
    show: boolean
    x: number
    y: number
    node: GraphNode | null
}>({ show: false, x: 0, y: 0, node: null })
const activeNode = ref<GraphNode | null>(null)
const rawData = ref<GraphData>({ nodes: [], links: [] })

const getLinkEndpointId = (endpoint: string | GraphNode) =>
    typeof endpoint === 'string' ? endpoint : endpoint.id

const connectionCounts = computed(() => {
    const counts = new Map<string, number>()

    rawData.value.links.forEach((link) => {
        const sourceId = getLinkEndpointId(link.source)
        const targetId = getLinkEndpointId(link.target)
        counts.set(sourceId, (counts.get(sourceId) || 0) + 1)
        counts.set(targetId, (counts.get(targetId) || 0) + 1)
    })

    return counts
})

const connectedNodeIds = computed(() => {
    const connected = new Set<string>()
    if (!activeNode.value) return connected

    rawData.value.links.forEach((link) => {
        const sourceId = getLinkEndpointId(link.source)
        const targetId = getLinkEndpointId(link.target)

        if (sourceId === activeNode.value?.id) connected.add(targetId)
        if (targetId === activeNode.value?.id) connected.add(sourceId)
    })

    return connected
})

const mobileRankedNodes = computed(() => {
    const query = nodeSearchQuery.value.trim().toLocaleLowerCase()
    const sourceOrder = new Map(
        rawData.value.nodes.map((node, index) => [node.id, index]),
    )
    const nodes = query
        ? rawData.value.nodes.filter((node) => {
            const searchable = [node.title, node.group, ...(node.tags || [])]
                .join(' ')
                .toLocaleLowerCase()
            return searchable.includes(query)
        })
        : [...rawData.value.nodes]

    return nodes.sort((left, right) => {
        if (query) {
            const leftStartsWith = left.title.toLocaleLowerCase().startsWith(query)
            const rightStartsWith = right.title.toLocaleLowerCase().startsWith(query)
            if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1
        }

        if (activeNode.value) {
            if (left.id === activeNode.value.id) return -1
            if (right.id === activeNode.value.id) return 1

            const leftConnected = connectedNodeIds.value.has(left.id)
            const rightConnected = connectedNodeIds.value.has(right.id)
            if (leftConnected !== rightConnected) return leftConnected ? -1 : 1
        }

        const valueDifference = (right.val || 0) - (left.val || 0)
        if (valueDifference !== 0) return valueDifference

        const connectionDifference =
            (connectionCounts.value.get(right.id) || 0) -
            (connectionCounts.value.get(left.id) || 0)
        if (connectionDifference !== 0) return connectionDifference

        return (sourceOrder.get(left.id) || 0) - (sourceOrder.get(right.id) || 0)
    })
})

const visibleNodes = computed(() => {
    if (!isCompactLayout.value) return rawData.value.nodes
    if (nodeSearchQuery.value.trim() || showAllMobileNodes.value) {
        return mobileRankedNodes.value
    }

    return mobileRankedNodes.value.slice(0, mobileNodeLimit)
})

const nodeListStatus = computed(() => {
    if (nodeSearchQuery.value.trim()) {
        return `${visibleNodes.value.length} 个匹配节点`
    }

    return `显示 ${visibleNodes.value.length} / ${rawData.value.nodes.length} 个节点`
})

const clearNodeSearch = () => {
    nodeSearchQuery.value = ''
    showAllMobileNodes.value = false
}

const stats = computed(() => {
    const groupCounts: Record<string, number> = {}
    rawData.value.nodes.forEach((n: any) => {
        const g = n.group || '未分类'
        groupCounts[g] = (groupCounts[g] || 0) + 1
    })

    const topGroups = Object.entries(groupCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count).slice(0, 6)

    return { nodes: rawData.value.nodes.length, links: rawData.value.links.length, topGroups }
})

const getGroupColor = (str?: string) => {
    if (!str) return '#10b981'
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return `hsl(${Math.abs(hash) % 360}, 75%, 60%)`
}

const getNodeRadius = (val: number) => Math.max(12, Math.sqrt(val || 1) * 6)
const getNodeConnectionCount = (id: string) => connectionCounts.value.get(id) || 0

// -------------------------------------------------------------------------
// 核心修复：联动高亮逻辑 (彻底剥离 D3 动画，交由 CSS transition 接管处理防闪烁)
// -------------------------------------------------------------------------
const highlightGroup = (groupName: string) => {
    if (!svgNode || !svgLink || !svgLabel) return
    svgNode.attr('opacity', (d: any) => d.group === groupName ? 1 : 0.1)
    svgLabel.attr('opacity', (d: any) => d.group === groupName ? 1 : 0.1)
    svgLink.attr('opacity', 0.05)
}

const highlightNode = (nodeId: string) => {
    if (!svgNode || !svgLink || !svgLabel) return
    const connected = new Set([nodeId])
    rawData.value.links.forEach((l: any) => {
        if (l.source.id === nodeId) connected.add(l.target.id)
        if (l.target.id === nodeId) connected.add(l.source.id)
    })

    // 直接赋值，不使用 .transition()
    svgNode.attr('opacity', (d: any) => connected.has(d.id) ? 1 : 0.1)
    svgLabel.attr('opacity', (d: any) => connected.has(d.id) ? 1 : 0.1)

    svgLink.attr('stroke', (l: any) => (l.source.id === nodeId || l.target.id === nodeId) ? 'var(--vp-c-brand-1)' : 'var(--vp-c-text-2)')
        .attr('opacity', (l: any) => (l.source.id === nodeId || l.target.id === nodeId) ? 0.9 : 0.05)
        .attr('stroke-width', (l: any) => (l.source.id === nodeId || l.target.id === nodeId) ? 2.5 : 1)
}

const resetHighlight = () => {
    if (!svgNode || !svgLink || !svgLabel) return
    svgNode.attr('opacity', 1)
    svgLabel.attr('opacity', 1)
    svgLink.attr('stroke', 'var(--vp-c-text-2)')
        .attr('opacity', 0.45)
        .attr('stroke-width', (d: any) => d.type === 'hard' ? 2 : 1)
}

const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
    setTimeout(() => {
        if (graphContainer.value && simulation) {
            const width = graphContainer.value.clientWidth
            const height = graphContainer.value.clientHeight
            simulation.force('center', d3.forceCenter(width / 2, height / 2))
            simulation.alpha(0.3).restart()
        }
    }, 350)
}

const fetchGraphData = async (): Promise<GraphData> => {
    try {
        const res = await fetch('/phaseshard.json')
        if (!res.ok) throw new Error()
        return await res.json()
    } catch (e) {
        return {
            nodes: [
                { id: '1', title: 'Vulkan渲染流程', group: '图形学', val: 8, path: '/posts/vulkan', summary: '图形管线的核心生命周期。' },
                { id: '2', title: 'C++ RAII', group: '编程语言', val: 6, path: '/posts/raii', summary: '资源获取即初始化，C++内存管理基石。' },
                { id: '3', title: 'Descriptor Sets', group: '图形学', val: 5, path: '/posts/desc', summary: '着色器资源绑定机制。' },
                { id: '4', title: '原子操作', group: '多线程', val: 7, path: '/posts/atomic', summary: '底层并发原语。' },
                { id: '5', title: '多级缓存MESI', group: '多线程', val: 5, path: '/posts/mesi', summary: 'CPU 缓存一致性协议深度解析。' },
                { id: '6', title: 'Google Benchmark', group: '工具链', val: 4, path: '/posts/benchmark', summary: '性能基准测试框架' },
                { id: '7', title: 'Rust Ownership', group: '编程语言', val: 7, path: '/posts/rust', summary: '内存安全的编译期保障' }
            ],
            links: [
                { source: '1', target: '3', type: 'hard' },
                { source: '3', target: '2', type: 'soft' },
                { source: '2', target: '4', type: 'soft' },
                { source: '4', target: '5', type: 'hard' },
                { source: '2', target: '7', type: 'soft' }
            ]
        }
    }
}

const renderGraph = (data: any) => {
    if (!graphContainer.value) return
    let width = graphContainer.value.clientWidth
    let height = graphContainer.value.clientHeight

    d3.select(graphContainer.value).selectAll('*').remove()
    const svg = d3.select(graphContainer.value).append('svg').attr('width', '100%').attr('height', '100%')
    const g = svg.append('g')

    const zoom = d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom as any)
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85).translate(-width / 2, -height / 2))

    simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(chargeStrength.value))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('x', d3.forceX(width / 2).strength(0.04))
        .force('y', d3.forceY(height / 2).strength(0.04))
        .force('collide', d3.forceCollide().radius((d: any) => getNodeRadius(d.val) + 15))

    // 为元素添加 CSS class，将动画交还给浏览器原生渲染引擎
    svgLink = g.append('g').selectAll('line').data(data.links).enter().append('line')
        .attr('class', 'graph-link')
        .attr('stroke', 'var(--vp-c-text-2)')
        .attr('stroke-width', (d: any) => d.type === 'hard' ? 2 : 1)
        .attr('stroke-dasharray', (d: any) => d.type === 'soft' ? '4,4' : 'none')
        .attr('opacity', 0.45)

    svgNode = g.append('g').selectAll('circle').data(data.nodes).enter().append('circle')
        .attr('class', 'graph-node')
        .attr('r', (d: any) => getNodeRadius(d.val))
        .attr('fill', (d: any) => getGroupColor(d.group))
        .attr('stroke', 'var(--vp-c-bg)')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended) as any)
        .on('mouseover', (event, d: any) => {
            tooltip.value = { show: true, x: event.clientX + 15, y: event.clientY + 15, node: d }
            highlightNode(d.id)
        })
        .on('mousemove', (event) => {
            tooltip.value.x = event.clientX + 15; tooltip.value.y = event.clientY + 15
        })
        .on('mouseout', (event) => {
            tooltip.value.show = false
            resetHighlight()
        })
        .on('click', (event, d: any) => { activeNode.value = d })

    svgLabel = g.append('g').selectAll('g').data(data.nodes).enter().append('g')
        .attr('class', 'graph-label')
        .style('pointer-events', 'none')

    svgLabel.append('text').text((d: any) => d.title).attr('font-size', '12px').attr('font-weight', '600')
        .attr('dx', (d: any) => getNodeRadius(d.val) + 6).attr('dy', 4)
        .attr('stroke', 'var(--vp-c-bg)').attr('stroke-width', 5).attr('stroke-linejoin', 'round')
    svgLabel.append('text').text((d: any) => d.title).attr('font-size', '12px').attr('font-weight', '600')
        .attr('fill', 'var(--vp-c-text-1)').attr('dx', (d: any) => getNodeRadius(d.val) + 6).attr('dy', 4)

    simulation.on('tick', () => {
        svgLink!.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y).attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
        svgNode!.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)
        svgLabel!.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
    })

    resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            if (simulation) {
                simulation.force('center', d3.forceCenter(entry.contentRect.width / 2, entry.contentRect.height / 2))
                simulation.alpha(0.3).restart()
            }
        }
    })
    resizeObserver.observe(graphContainer.value)

    function dragstarted(event: any, d: any) {
        if (!event.active) simulation?.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y; tooltip.value.show = false
    }
    function dragged(event: any, d: any) { d.fx = event.x; d.fy = event.y }
    function dragended(event: any, d: any) {
        if (!event.active) simulation?.alphaTarget(0)
        d.fx = null; d.fy = null
    }
}

const navigateTo = (path: string) => {
    if (path) {
        isFullscreen.value = false
        router.go(path)
    }
}

onMounted(async () => {
    compactLayoutMediaQuery = window.matchMedia('(max-width: 800px)')
    isCompactLayout.value = compactLayoutMediaQuery.matches
    compactLayoutMediaQuery.addEventListener('change', handleCompactLayoutChange)

    rawData.value = await fetchGraphData()
    renderGraph(rawData.value)
})

onUnmounted(() => {
    if (simulation) simulation.stop()
    if (resizeObserver) resizeObserver.disconnect()
    compactLayoutMediaQuery?.removeEventListener('change', handleCompactLayoutChange)
})

function handleCompactLayoutChange(event: MediaQueryListEvent) {
    isCompactLayout.value = event.matches

    if (!event.matches) {
        nodeSearchQuery.value = ''
        showAllMobileNodes.value = false
    }
}
</script>

<style scoped>
/* ---------------------------------
   1. 基础布局框架
--------------------------------- */
.phaseshard-wrapper {
    display: flex;
    width: 96%;
    margin: 30px auto;
    height: 75vh;
    min-height: 600px;
    background-color: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-border);
    border-radius: 12px;
    overflow: hidden;
    box-sizing: border-box;
    font-family: var(--vp-font-family-base);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.phaseshard-wrapper.is-fullscreen {
    position: fixed !important;
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    border-radius: 0 !important;
    border: none;
    z-index: 9999;
    background-color: var(--vp-c-bg);
}

.graph-area {
    position: relative;
    flex: 1;
    height: 100%;
    overflow: hidden;
    background-color: var(--vp-c-bg-alt);
}

.svg-container {
    width: 100%;
    height: 100%;
    cursor: grab;
}

.svg-container:active {
    cursor: grabbing;
}

.fullscreen-btn {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--vp-c-bg);
    border: 1px solid var(--vp-c-border);
    padding: 8px 14px;
    border-radius: 8px;
    color: var(--vp-c-text-2);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.2s;
}

.fullscreen-btn:hover {
    background-color: var(--vp-c-bg-mute);
    color: var(--vp-c-text-1);
}

.hover-tooltip {
    position: fixed;
    background-color: var(--vp-c-bg);
    border: 1px solid var(--vp-c-border);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--vp-c-text-1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 6px;
}

.group-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

/* ---------------------------------
   2. 右侧控制台 (严格防溢出布局)
--------------------------------- */
.obsidian-panel {
    width: 320px;
    flex-shrink: 0;
    height: 100%;
    background-color: var(--vp-c-bg);
    border-left: 1px solid var(--vp-c-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.panel-section {
    padding: 16px 20px;
    border-bottom: 1px solid var(--vp-c-border);
}

/* 统计区 */
.stats-section {
    flex: 0 0 auto;
}

.section-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--vp-c-text-2);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
}

.stat-box {
    background-color: var(--vp-c-bg-soft);
    padding: 8px;
    border-radius: 6px;
    text-align: center;
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--vp-c-text-1);
    font-family: var(--vp-font-family-mono);
}

.stat-label {
    font-size: 0.7rem;
    color: var(--vp-c-text-3);
    margin-top: 2px;
}

.tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.mini-tag {
    font-size: 0.65rem;
    padding: 2px 8px;
    border: 1px solid;
    border-radius: 12px;
    background-color: var(--vp-c-bg-soft);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

/* ---------------------------------
   3. 🔥 笔记索引 (悬浮放大与平滑滚动修复) 🔥
--------------------------------- */
.node-list-section {
    flex: 1 1 50%;
    /* 与详情区平分剩余空间 */
    min-height: 0;
    /* 阻止内容撑爆父容器 */
    display: flex;
    flex-direction: column;
    padding-bottom: 8px;
}

.mobile-node-tools,
.mobile-list-actions {
    display: none;
}

.node-search-control {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 10px;
    color: var(--vp-c-text-3);
    background-color: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
}

.node-search-control:focus-within {
    color: var(--vp-c-brand-1);
    border-color: var(--vp-c-brand-1);
}

.node-search-control input {
    width: 100%;
    min-width: 0;
    padding: 8px 0;
    color: var(--vp-c-text-1);
    background: transparent;
    border: 0;
    outline: 0;
    font: inherit;
    font-size: 0.85rem;
}

.node-search-control input::placeholder {
    color: var(--vp-c-text-3);
}

.search-clear-btn {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--vp-c-text-2);
    background: transparent;
    border: 0;
    border-radius: 6px;
    font-size: 1.15rem;
    cursor: pointer;
}

.search-clear-btn:hover {
    color: var(--vp-c-text-1);
    background-color: var(--vp-c-bg-mute);
}

.node-list-meta {
    margin-top: 6px;
    color: var(--vp-c-text-3);
    font-size: 0.72rem;
}

.node-list-empty {
    display: grid;
    min-height: 120px;
    place-items: center;
    color: var(--vp-c-text-3);
    font-size: 0.82rem;
    text-align: center;
}

.mobile-list-actions {
    flex: 0 0 auto;
    padding-top: 8px;
}

.mobile-list-toggle {
    width: 100%;
    padding: 9px 12px;
    color: var(--vp-c-brand-1);
    background-color: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-brand-soft);
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
}

.mobile-list-toggle:hover {
    background-color: var(--vp-c-bg-mute);
}

.node-list {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    scroll-behavior: smooth;
    padding: 4px 10px;
    /* 留出放大空间防裁切 */
    display: flex;
    flex-direction: column;
    gap: 8px;

    scrollbar-width: thin;
    scrollbar-color: var(--vp-c-border) transparent;
}

.node-list::-webkit-scrollbar {
    width: 4px;
}

.node-list::-webkit-scrollbar-thumb {
    background: var(--vp-c-border);
    border-radius: 4px;
}

.focus-list-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background-color: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    color: var(--vp-c-text-2);
    cursor: pointer;
    transform-origin: center center;
    transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.25s, background-color 0.25s, border-color 0.25s;
}

/* 悬浮与激活时的放大浮出特效 */
.focus-list-item:hover,
.focus-list-item.is-active {
    transform: scale(1.03);
    background-color: var(--vp-c-bg);
    border-color: var(--node-color);
    color: var(--vp-c-text-1);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08), inset 3px 0 0 var(--node-color);
    z-index: 10;
}

.list-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: transform 0.2s;
}

.focus-list-item:hover .list-dot,
.focus-list-item.is-active .list-dot {
    transform: scale(1.3);
    /* 圆点同步放大 */
}

.list-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.85rem;
    font-weight: 600;
}

/* ---------------------------------
   4. 底部聚焦卡片
--------------------------------- */
.detail-section {
    flex: 1 1 50%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-bottom: none;
}

.active-node-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    cursor: default;
}

.node-badge {
    align-self: flex-start;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    margin-bottom: 10px;
}

.node-title {
    margin: 0 0 10px 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--vp-c-text-1);
}

.node-connections {
    font-size: 0.75rem;
    color: var(--vp-c-text-2);
    margin-bottom: 12px;
    font-family: var(--vp-font-family-mono);
    background-color: var(--vp-c-bg-soft);
    padding: 4px 8px;
    border-radius: 4px;
}

.node-summary-scroll {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 10px;
    min-height: 0;
    scrollbar-width: thin;
}

.node-summary-scroll::-webkit-scrollbar {
    width: 3px;
}

.node-summary-scroll::-webkit-scrollbar-thumb {
    background: var(--vp-c-border);
}

.node-summary {
    font-size: 0.85rem;
    color: var(--vp-c-text-2);
    line-height: 1.6;
    margin: 0;
}

.obsidian-btn {
    width: 100%;
    padding: 10px;
    background-color: var(--vp-c-brand-1);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    flex-shrink: 0;
}

.obsidian-btn:hover {
    background-color: var(--vp-c-brand-2);
}

.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--vp-c-text-3);
    text-align: center;
}

.empty-state .icon {
    font-size: 2rem;
    margin-bottom: 8px;
    opacity: 0.5;
}

.empty-state p {
    font-size: 0.8rem;
    margin: 0;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* ---------------------------------
   5. D3 动画接管 (消除闪烁 Bug)
--------------------------------- */
:deep(.graph-link) {
    transition: stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease;
}

:deep(.graph-node) {
    transition: opacity 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease;
}

:deep(.graph-label) {
    transition: opacity 0.3s ease;
}

@media (max-width: 800px) {
    .phaseshard-wrapper {
        flex-direction: column;
        height: auto;
        min-height: 0;
    }

    .phaseshard-wrapper.is-fullscreen {
        flex-direction: column;
        overflow-y: auto;
    }

    .graph-area {
        flex: 0 0 clamp(320px, 52vh, 420px);
        height: clamp(320px, 52vh, 420px);
        min-height: 320px;
    }

    .obsidian-panel {
        width: 100%;
        height: auto;
        border-left: none;
        border-top: 1px solid var(--vp-c-border);
        overflow: visible;
    }

    .node-list-section {
        flex: 0 0 clamp(360px, 52vh, 440px);
        height: clamp(360px, 52vh, 440px);
        min-height: 360px;
    }

    .mobile-node-tools,
    .mobile-list-actions {
        display: block;
    }

    .detail-section {
        flex: 0 0 auto;
        min-height: 180px;
        max-height: 320px;
    }

    .active-node-card,
    .empty-state {
        min-height: 120px;
    }

    .phaseshard-wrapper.is-fullscreen .graph-area {
        flex-basis: 55vh;
        height: 55vh;
        min-height: 300px;
    }
}
</style>
