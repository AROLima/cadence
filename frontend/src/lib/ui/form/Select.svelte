<svelte:options runes={false} />

<script lang="ts">
  type Option = {
    label: string;
    value: string;
    disabled?: boolean;
  };

  export let id: string | undefined;
  export let name: string | undefined;
  export let label: string | undefined;
  export let options: Option[] = [];
  export let placeholder: string | undefined;
  export let value: string | undefined;
  export let hint: string | undefined;
  export let error: string | undefined;
  export let disabled = false;
  export let required = false;
  export let className = '';
  export let selectClass = '';

  $: fallbackId = name ? `${name}-select` : undefined;
  $: selectId = id ?? fallbackId;
  $: hasError = Boolean(error);
  $: containerClass = ['space-y-2', className].filter(Boolean).join(' ').trim();
  $: wrapperClass = [
    'rounded-lg border bg-slate-900/80 px-3 text-sm transition',
    hasError ? 'border-red-400 focus-within:border-red-400' : 'border-slate-700 focus-within:border-indigo-500',
    disabled ? 'opacity-60 cursor-not-allowed' : ''
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
</script>

<div class={containerClass}>
  {#if label}
    <label class="text-sm font-medium text-slate-200" for={selectId}>
      {label}{required ? '*' : ''}
    </label>
  {/if}

  <div class={wrapperClass}>
    <select
      {...$$restProps}
      id={selectId}
      name={name}
      class={`w-full bg-transparent py-2 text-slate-100 focus:outline-none ${selectClass} ${$$restProps.class ?? ''}`.trim()}
      disabled={disabled}
      required={required}
      bind:value
      aria-invalid={hasError || undefined}
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
