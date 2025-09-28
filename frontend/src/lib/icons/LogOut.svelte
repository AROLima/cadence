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

  const iconNode: IconNode = [["path", { "d": "m16 17 5-5-5-5" }], ["path", { "d": "M21 12H9" }], ["path", { "d": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }]];
</script>

<IconBase
  name="log-out"
  {size}
  {stroke}
  {strokeWidth}
  {absoluteStrokeWidth}
  className={className}
  ariaLabel={ariaLabel}
  iconNode={iconNode}
  {...$$restProps}
/>
