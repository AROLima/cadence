<script lang="ts">
  export let id: string | undefined;
  export let label: string | undefined;
  export let type = 'text';
  export let value: string | undefined;
  export let placeholder: string | undefined;
  export let hint: string | undefined;
  export let error: string | undefined;
  export let disabled = false;
  export let required = false;
  export let className = '';

  const inputId = id ?? `input-${crypto.randomUUID()}`;
  const hasError = Boolean(error);
</script>

<div class={`space-y-2 ${className}`.trim()}>
  {#if label}
    <label class="text-sm font-medium text-slate-200" for={inputId}
      >{label}{required ? '*' : ''}</label
    >
  {/if}

  <div
    class={`rounded-lg border bg-slate-900/80 px-3 py-2 text-sm transition focus-within:border-indigo-500 ${
      hasError ? 'border-red-500/60 focus-within:border-red-500' : 'border-slate-800'
    } ${disabled ? 'opacity-60' : ''}`}
  >
    <input
      {...$$restProps}
      id={inputId}
      class="w-full bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
      type={type}
      bind:value
      placeholder={placeholder}
      disabled={disabled}
      required={required}
    />
  </div>

  {#if hasError}
    <p class="text-xs text-red-300">{error}</p>
  {:else if hint}
    <p class="text-xs text-slate-500">{hint}</p>
  {/if}
</div>
