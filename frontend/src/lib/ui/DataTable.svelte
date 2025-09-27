<script lang="ts">
  import type { DataTableColumn } from '$lib/ui/types';

  export let columns: DataTableColumn<Record<string, unknown>>[] = [];
  export let rows: Record<string, unknown>[] = [];
  export let getRowId: ((row: Record<string, unknown>, index: number) => string | number) | undefined;
  export let emptyMessage = 'No records to display.';
  export let dense = false;

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (!align) return 'text-left';
    return `text-${align}`;
  };

  const resolveValue = (row: Record<string, unknown>, key: string | keyof typeof row) => {
    const value = row[key as keyof typeof row];
    return value ?? '';
  };
</script>

<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
  <table class={`w-full min-w-full divide-y divide-slate-800 ${dense ? 'text-sm' : 'text-sm md:text-base'}`}>
    <thead class="bg-slate-900/70">
      <tr>
        {#each columns as column}
          <th
            scope="col"
            class={`px-4 py-3 font-semibold uppercase tracking-wide text-slate-400 first:pl-5 last:pr-5 ${alignClass(column.align)} ${column.class ?? ''}`.trim()}
            style={column.width ? `width:${column.width}` : ''}
          >
            {column.header}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-800">
      {#if rows.length === 0}
        <tr>
          <td class="px-5 py-10 text-center text-sm text-slate-400" colspan={columns.length}>
            {emptyMessage}
          </td>
        </tr>
      {:else}
        {#each rows as row, index (getRowId ? getRowId(row, index) : index)}
          <tr class="hover:bg-slate-900/70">
            {#each columns as column}
              <td
                class={`px-4 py-3 align-middle text-slate-200 first:pl-5 last:pr-5 ${alignClass(column.align)} ${column.class ?? ''}`.trim()}
              >
                {#if column.render}
                  {@const rendered = column.render({
                    value: resolveValue(row, column.key),
                    row,
                    index,
                  })}
                  {#if typeof rendered === 'string' || typeof rendered === 'number'}
                    {rendered}
                  {:else}
                    {rendered ?? ''}
                  {/if}
                {:else}
                  {resolveValue(row, column.key)}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
