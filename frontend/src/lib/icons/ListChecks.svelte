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

  const iconNode: IconNode = [["path", { "d": "M13 5h8" }], ["path", { "d": "M13 12h8" }], ["path", { "d": "M13 19h8" }], ["path", { "d": "m3 17 2 2 4-4" }], ["path", { "d": "m3 7 2 2 4-4" }]];
</script>

<IconBase
  name="list-checks"
  {size}
  {stroke}
  {strokeWidth}
  {absoluteStrokeWidth}
  className={className}
  ariaLabel={ariaLabel}
  iconNode={iconNode}
  {...$$restProps}
/>
