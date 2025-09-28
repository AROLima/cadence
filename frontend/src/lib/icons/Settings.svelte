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

  const iconNode: IconNode = [["path", { "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" }], ["circle", { "cx": "12", "cy": "12", "r": "3" }]];
</script>

<IconBase
  name="settings"
  {size}
  {stroke}
  {strokeWidth}
  {absoluteStrokeWidth}
  className={className}
  ariaLabel={ariaLabel}
  iconNode={iconNode}
  {...$$restProps}
/>
