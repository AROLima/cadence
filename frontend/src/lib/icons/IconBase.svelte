<svelte:options runes={false} />

<script lang="ts">
  import type { IconNode } from './types';

  export let name: string | undefined;
  export let iconNode: IconNode = [];
  export let size = 24;
  export let stroke = 'currentColor';
  export let strokeWidth = 2;
  export let absoluteStrokeWidth = false;
  export let className = '';
  export let ariaLabel: string | undefined = undefined;
  export let role: string | undefined = 'img';

  $: computedStrokeWidth = absoluteStrokeWidth
    ? (Number(strokeWidth) * 24) / Number(size)
    : strokeWidth;
  $: dataIcon = name ?? undefined;
</script>

<svg
  {...$$restProps}
  class={`icon ${className} ${$$restProps.class ?? ''}`.trim() || undefined}
  data-icon={dataIcon}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={stroke}
  stroke-width={computedStrokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-label={ariaLabel}
  aria-hidden={ariaLabel ? undefined : 'true'}
  role={ariaLabel ? role : undefined}
>
  {#each iconNode as [tag, attrs]}
    <svelte:element this={tag} {...attrs} />
  {/each}
  <slot />
</svg>
