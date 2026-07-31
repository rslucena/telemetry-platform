<script setup>
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true },
  height: { type: String, default: '340px' }
})
</script>

<template>
  <div class="flow-container" :style="{ height: height }">
    <VueFlow :nodes="nodes" :edges="edges" fit-view-on-init class="interaction-flow">
      <Background pattern-color="#3b82f6" :gap="16" :size="1" />
      <Controls />
    </VueFlow>
  </div>
</template>

<style>
.flow-container {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--vp-c-border);
  margin: 24px 0;
  background: var(--vp-c-bg-alt);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.interaction-flow .vue-flow__node {
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.interaction-flow .vue-flow__node:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-2);
  box-shadow: 0 6px 20px rgba(96, 165, 250, 0.3);
}

.interaction-flow .vue-flow__edge-path {
  stroke: var(--vp-c-brand-1);
  stroke-width: 2.5;
}

.interaction-flow .vue-flow__edge.animated .vue-flow__edge-path {
  stroke-dasharray: 6;
  animation: flowDash 0.6s linear infinite;
}

@keyframes flowDash {
  from {
    stroke-dashoffset: 12;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>
