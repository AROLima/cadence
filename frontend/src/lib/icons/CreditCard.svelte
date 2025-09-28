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

  const iconNode: IconNode = [["rect", { "width": "20", "height": "14", "x": "2", "y": "5", "rx": "2" }], ["line", { "x1": "2", "x2": "22", "y1": "10", "y2": "10" }]];
</script>

<IconBase
  name="credit-card"
  {size}
  {stroke}
  {strokeWidth}
  {absoluteStrokeWidth}
  className={className}
  ariaLabel={ariaLabel}
  iconNode={iconNode}
  {...$$restProps}
/>
