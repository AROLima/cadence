<svelte:options runes={false} />

<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  export let id: string | undefined;
  export let name: string | undefined;
  export let label: string | undefined;
  export let type: HTMLInputAttributes['type'] = 'text';
  export let value: HTMLInputAttributes['value'] = undefined;
  export let placeholder: string | undefined;
  export let hint: string | undefined = undefined;
  export let error: string | undefined = undefined;
  export let disabled = false;
  export let required = false;
  export let className = '';
  export let inputClass = '';
  export let autocomplete: HTMLInputAttributes['autocomplete'] = undefined;
  export let autofocus: HTMLInputAttributes['autofocus'] = undefined;

  $: fallbackId = name ? `${name}-input` : undefined;
  $: inputId = id ?? fallbackId;
  $: hasError = Boolean(error);
  $: containerClass = ['space-y-2', className].filter(Boolean).join(' ').trim();
  $: wrapperClass = [
    'rounded-lg border bg-slate-900/80 px-3 py-2 text-sm transition',
    hasError ? 'border-red-400 focus-within:border-red-400' : 'border-slate-700 focus-within:border-indigo-500',
    disabled ? 'opacity-60 cursor-not-allowed' : ''
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
</script>

<div class={containerClass}>
  {#if label}
    <label class="text-sm font-medium text-slate-200" for={inputId}>
      {label}{required ? '*' : ''}
    </label>
  {/if}

  <div class={wrapperClass}>
    <!-- svelte-ignore a11y-autofocus -->
    <input
      {...$$restProps}
      id={inputId}
      name={name}
      class={`w-full bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none ${inputClass} ${$$restProps.class ?? ''}`.trim()}
      type={type}
      bind:value
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      autocomplete={autocomplete}
      autofocus={autofocus}
      aria-invalid={hasError || undefined}
    />
  </div>

  {#if hasError}
    <p class="text-xs text-red-300">{error}</p>
  {:else if hint}
    <p class="text-xs text-slate-500">{hint}</p>
  {/if}
</div>
