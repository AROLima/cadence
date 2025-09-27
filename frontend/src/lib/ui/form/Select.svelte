<script lang="ts">
  type Option = {
    label: string;
    value: string;
    disabled?: boolean;
  };

  export let id: string | undefined;
  export let label: string | undefined;
  export let options: Option[] = [];
  export let placeholder: string | undefined;
  export let value: string | undefined;
  export let hint: string | undefined;
  export let error: string | undefined;
  export let disabled = false;
  export let required = false;
  export let className = '';

  const selectId = id ?? `select-${crypto.randomUUID()}`;
  const hasError = Boolean(error);
</script>

<div class={`space-y-2 ${className}`.trim()}>
  {#if label}
    <label class="text-sm font-medium text-slate-200" for={selectId}
      >{label}{required ? '*' : ''}</label
    >
  {/if}

  <div
    class={`rounded-lg border bg-slate-900/80 px-3 text-sm transition focus-within:border-indigo-500 ${
      hasError ? 'border-red-500/60 focus-within:border-red-500' : 'border-slate-800'
    } ${disabled ? 'opacity-60' : ''}`}
  >
    <select
      {...$$restProps}
      id={selectId}
      class="w-full bg-transparent py-2 text-slate-100 focus:outline-none"
      disabled={disabled}
      required={required}
      bind:value
    >
      {#if placeholder}
        <option value="" disabled selected={!value}>{placeholder}</option>
      {/if}
      {#each options as option}
        <option value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      {/each}
    </select>
  </div>

  {#if hasError}
    <p class="text-xs text-red-300">{error}</p>
  {:else if hint}
    <p class="text-xs text-slate-500">{hint}</p>
  {/if}
</div>
