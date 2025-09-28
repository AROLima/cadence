<svelte:options runes={false} />

<script lang="ts">
  import IconBase from './IconBase.svelte';
  import type { IconNode } from './types';

  export let size = 24;
  export let stroke = 'currentColor';
  export let strokeWidth = 2;
  export let absoluteStrokeWidth = false;
  export let className = '';
  export let ariaLabel: string | undefined = undefined;

  const iconNode: IconNode = [["path", { "d": "m6 9 6 6 6-6" }]];
</script>

<IconBase
  name="chevron-down"
  {size}
  {stroke}
  {strokeWidth}
  {absoluteStrokeWidth}
  className={className}
  ariaLabel={ariaLabel}
  iconNode={iconNode}
  {...$$restProps}
/>
